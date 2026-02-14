<script>
    import { onMount } from 'svelte'
    import { settings } from '../stores/settings-store.svelte.js'
    import GoogleCalendarBackend from '../backends/google-calendar-backend.js'

    let { class: className = '' } = $props()

    let events = $state([])
    let loading = $state(false)
    let error = $state(null)
    let calendarColorCache = $state({})

    const DAYS_AHEAD = 3
    const CACHE_KEY = 'calendarEventsCache'

    function getCachedEvents() {
        try {
            const raw = localStorage.getItem(CACHE_KEY)
            if (!raw) return null
            const cached = JSON.parse(raw)
            const today = new Date().toLocaleDateString('en-CA')
            if (cached.date === today) return cached.events
        } catch {}
        return null
    }

    function setCachedEvents(eventData) {
        try {
            const today = new Date().toLocaleDateString('en-CA')
            localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, events: eventData }))
        } catch {}
    }

    // Check if we have credentials and are signed in
    let hasCredentials = $derived(
        settings.googleCalendarClientId && settings.googleCalendarClientSecret
    )
    let isSignedIn = $derived(hasCredentials && settings.googleCalendarRefreshToken)

    // Group events by date, sorted within each day
    let groupedEvents = $derived.by(() => {
        const groups = new Map()

        for (const event of events) {
            // For all-day events, start is a date string like "2026-02-14"
            // For timed events, start is an ISO datetime
            const dateKey = event.allDay
                ? event.start
                : new Date(event.start).toLocaleDateString('en-CA') // YYYY-MM-DD

            if (!groups.has(dateKey)) {
                groups.set(dateKey, [])
            }
            groups.get(dateKey).push(event)
        }

        // Sort each group: all-day first, then by start time
        for (const [, dayEvents] of groups) {
            dayEvents.sort((a, b) => {
                if (a.allDay && !b.allDay) return -1
                if (!a.allDay && b.allDay) return 1
                return new Date(a.start) - new Date(b.start)
            })
        }

        // Sort groups by date
        return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
    })

    function formatDayLabel(dateKey) {
        const date = new Date(dateKey + 'T00:00:00')
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        if (date.toDateString() === today.toDateString()) return 'today'
        if (date.toDateString() === tomorrow.toDateString()) return 'tomorrow'

        const day = date.toLocaleDateString('en-US', { weekday: 'short' })
        const num = date.getDate()
        return `${day} ${num}`
    }

    function formatTimeRange(event) {
        if (event.allDay) return 'all day'
        const start = formatTime(event.start)
        const end = formatTime(event.end)
        return `${start}\u2013${end}`
    }

    async function loadEvents(force = false) {
        if (!isSignedIn) return

        // Use cached events if available and not forcing refresh
        if (!force) {
            const cached = getCachedEvents()
            if (cached) {
                events = cached
                return
            }
        }

        loading = true
        error = null

        try {
            const backend = new GoogleCalendarBackend(
                settings.googleCalendarClientId,
                settings.googleCalendarClientSecret
            )

            // Get fresh access token
            const { accessToken } = await backend.refreshAccessToken(
                settings.googleCalendarRefreshToken
            )

            // Determine which calendars to fetch
            const calendarIds = settings.googleCalendarSelectedCalendars.length > 0
                ? settings.googleCalendarSelectedCalendars
                : ['primary']

            // Only fetch calendar list if cache is empty
            if (Object.keys(calendarColorCache).length === 0) {
                const calendars = await backend.getCalendarList(accessToken)
                calendarColorCache = Object.fromEntries(
                    calendars.map(c => [c.id, c.backgroundColor])
                )
            }

            // Fetch events for the next 3 days
            events = await backend.getTodayEvents(accessToken, calendarIds, calendarColorCache, DAYS_AHEAD)
            setCachedEvents(events)
        } catch (err) {
            console.error('Failed to load calendar events:', err)
            if (err.message === 'ACCESS_TOKEN_EXPIRED' || err.message.includes('Token refresh failed')) {
                error = 'session expired - please sign in again'
                // Clear the invalid refresh token
                settings.googleCalendarRefreshToken = ''
            } else {
                error = 'failed to load events'
            }
        } finally {
            loading = false
        }
    }

    function formatTime(dateString) {
        const date = new Date(dateString)
        const hours = date.getHours()
        const minutes = date.getMinutes()

        if (settings.timeFormat === '24hr') {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        } else {
            const period = hours >= 12 ? 'PM' : 'AM'
            const hour12 = hours % 12 || 12
            if (minutes === 0) {
                return `${hour12} ${period}`
            }
            return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
        }
    }

    function isEventPast(event) {
        if (event.allDay) {
            const endDate = new Date(event.end)
            return endDate < new Date()
        }
        const endTime = new Date(event.end)
        return endTime < new Date()
    }

    onMount(() => {
        if (isSignedIn) {
            loadEvents()
        }
    })

    // Reload events when sign-in state changes
    $effect(() => {
        if (isSignedIn) {
            loadEvents()
        } else {
            events = []
        }
    })
</script>

<div class="panel-wrapper {className}">
    <button class="widget-label" onclick={() => loadEvents(true)} disabled={loading || !isSignedIn}>
        {loading ? 'loading...' : 'calendar'}
    </button>

    <div class="panel">
        {#if !hasCredentials}
            <div class="message">
                <button class="sign-in-link" onclick={() => window.dispatchEvent(new CustomEvent('open-settings'))}>
                    upload credentials in settings
                </button>
            </div>
        {:else if !isSignedIn}
            <div class="message">
                <button class="sign-in-link" onclick={() => window.dispatchEvent(new CustomEvent('open-settings'))}>
                    sign in to google calendar
                </button>
            </div>
        {:else if error}
            <div class="error">{error}</div>
        {:else if events.length === 0}
            <div class="message">no events</div>
        {:else}
            <div class="agenda">
                {#each groupedEvents as [dateKey, dayEvents]}
                    <div class="day-group">
                        <div class="day-label">{formatDayLabel(dateKey)}</div>
                        {#each dayEvents as event}
                            <div
                                class="event-card"
                                class:past={isEventPast(event)}
                                style="background-color: color-mix(in srgb, {event.calendarColor} 25%, transparent); border-color: color-mix(in srgb, {event.calendarColor} 40%, transparent);"
                            >
                                <span class="event-title" style="color: {event.calendarColor};">{event.title}</span>
                                <span class="event-time" style="color: {event.calendarColor};">{formatTimeRange(event)}</span>
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .panel-wrapper {
        flex: 1;
        max-width: 40rem;
    }
    .panel {
        height: 21.25rem;
        overflow-y: auto;
        scrollbar-width: none;
    }
    .panel::-webkit-scrollbar {
        display: none;
    }
    .message {
        color: var(--txt-3);
    }
    .sign-in-link {
        color: var(--txt-link);
        text-decoration: none;
    }
    .sign-in-link:hover {
        color: var(--txt-1);
    }
    .agenda {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .day-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .day-label {
        color: var(--txt-3);
        font-size: 0.85em;
    }
    .event-card {
        border: 1px solid;
        border-radius: 4px;
        padding: 2px 6px;
        overflow: hidden;
    }
    .event-card.past {
        opacity: 0.5;
    }
    .event-title {
        font-weight: bold;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .event-time {
        font-size: 0.7em;
        display: block;
    }
</style>
