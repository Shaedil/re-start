/**
 * Google Calendar API client with OAuth flow
 * Uses user-provided credentials (client_id + client_secret)
 */
class GoogleCalendarBackend {
    constructor(clientId, clientSecret) {
        this.clientId = clientId
        this.clientSecret = clientSecret
        this.scope = 'https://www.googleapis.com/auth/calendar.readonly'
        this.tokenEndpoint = 'https://oauth2.googleapis.com/token'
        this.calendarEndpoint = 'https://www.googleapis.com/calendar/v3'
    }

    /**
     * Get the redirect URI for OAuth
     * Uses Chrome's extension redirect URL when available
     */
    static getRedirectUrl() {
        if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
            return chrome.identity.getRedirectURL()
        }
        return 'http://localhost'
    }

    /**
     * Instance convenience method — delegates to static getRedirectUrl()
     */
    getRedirectUri() {
        return GoogleCalendarBackend.getRedirectUrl()
    }

    /**
     * Start OAuth flow
     * Uses chrome.identity.launchWebAuthFlow in Chrome extensions,
     * falls back to manual code entry otherwise
     */
    async signIn() {
        // Check if we're in a Chrome extension context
        if (typeof chrome !== 'undefined' && chrome.identity?.launchWebAuthFlow) {
            return this._signInWithChromeIdentity()
        } else {
            throw new Error('OAuth sign-in requires Chrome extension environment')
        }
    }

    /**
     * Sign in using Chrome's identity API
     * This intercepts the localhost redirect automatically
     */
    async _signInWithChromeIdentity() {
        const authUrl = this._buildAuthUrl()

        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: authUrl,
                    interactive: true,
                },
                async (redirectUrl) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                        return
                    }

                    if (!redirectUrl) {
                        reject(new Error('No redirect URL received'))
                        return
                    }

                    try {
                        // Extract auth code from redirect URL
                        const url = new URL(redirectUrl)
                        const code = url.searchParams.get('code')
                        const error = url.searchParams.get('error')

                        if (error) {
                            reject(new Error(`OAuth error: ${error}`))
                            return
                        }

                        if (!code) {
                            reject(new Error('No authorization code received'))
                            return
                        }

                        // Exchange code for tokens
                        const tokens = await this._exchangeCodeForTokens(code)
                        resolve(tokens)
                    } catch (e) {
                        reject(e)
                    }
                }
            )
        })
    }

    /**
     * Build the Google OAuth authorization URL
     */
    _buildAuthUrl() {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.getRedirectUri(),
            response_type: 'code',
            scope: this.scope,
            access_type: 'offline',
            prompt: 'consent', // Force consent to get refresh token
        })

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    }

    /**
     * Exchange authorization code for access + refresh tokens
     */
    async _exchangeCodeForTokens(code) {
        const response = await fetch(this.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: this.getRedirectUri(),
            }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
        }

        const tokens = await response.json()
        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
        }
    }

    /**
     * Get a fresh access token using refresh token
     */
    async refreshAccessToken(refreshToken) {
        const response = await fetch(this.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
        }

        const tokens = await response.json()
        return {
            accessToken: tokens.access_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
        }
    }

    /**
     * Fetch list of calendars the user has access to
     */
    async getCalendarList(accessToken) {
        const response = await fetch(
            `${this.calendarEndpoint}/users/me/calendarList`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        )

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('ACCESS_TOKEN_EXPIRED')
            }
            const errBody = await response.json().catch(() => ({}))
            console.error('Calendar list API error:', errBody)
            throw new Error(`Failed to fetch calendar list: ${response.status} - ${errBody?.error?.message || 'unknown'}`)
        }

        const data = await response.json()
        
        // Map to a simpler structure
        return (data.items || []).map(cal => ({
            id: cal.id,
            name: cal.summary || cal.id,
            primary: cal.primary || false,
            backgroundColor: cal.backgroundColor || '#4285f4',
        }))
    }

    /**
     * Fetch upcoming calendar events from specified calendars
     * @param {string} accessToken
     * @param {string[]} calendarIds - Array of calendar IDs to fetch from (defaults to ['primary'])
     * @param {Object.<string, string>} calendarColors - Map of calendarId to hex color string (e.g. { 'primary': '#4285f4' })
     * @param {number} days - Number of days ahead to fetch (default 1 = today only)
     */
    async getTodayEvents(accessToken, calendarIds = ['primary'], calendarColors = {}, days = 1) {
        // Get start of today and end of range in local timezone
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)

        const params = new URLSearchParams({
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime',
        })

        // Fetch events from all calendars in parallel
        const eventPromises = calendarIds.map(async (calendarId) => {
            const response = await fetch(
                `${this.calendarEndpoint}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            )

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('ACCESS_TOKEN_EXPIRED')
                }
                // Skip calendars that fail (might be permission issues)
                const errBody = await response.json().catch(() => ({}))
                console.warn(`Failed to fetch events from calendar ${calendarId}: ${response.status}`, errBody)
                return []
            }

            const data = await response.json()
            
            // Map to our event structure
            return (data.items || []).map(event => ({
                id: event.id,
                title: event.summary || '(no title)',
                start: event.start.dateTime || event.start.date,
                end: event.end.dateTime || event.end.date,
                allDay: !event.start.dateTime,
                description: event.description || '',
                location: event.location || '',
                calendarId: calendarId,
                calendarColor: calendarColors[calendarId] || '#4285f4',
            }))
        })

        const eventArrays = await Promise.all(eventPromises)
        const allEvents = eventArrays.flat()

        // Sort by start time (all-day events first, then by time)
        return allEvents.sort((a, b) => {
            // All-day events come first
            if (a.allDay && !b.allDay) return -1
            if (!a.allDay && b.allDay) return 1
            // Then sort by start time
            return new Date(a.start) - new Date(b.start)
        })
    }
}

export default GoogleCalendarBackend
