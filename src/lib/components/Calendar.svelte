<script>
    import { onMount } from 'svelte'
    import { settings } from '../stores/settings-store.svelte.js'
    import GoogleCalendarBackend from '../backends/google-calendar-backend.js'
    import { getEventDurationMinutes, getTimelineBounds, getMinuteOfDay, layoutEvents, PX_PER_HOUR } from '../utils/calendar-helpers.js'

    let { class: className = '' } = $props()

    let events = $state([])
    let loading = $state(false)
    let error = $state(null)
    let calendarColorCache = $state({})

    // Check if we have credentials and are signed in
    let hasCredentials = $derived(
        settings.googleCalendarClientId && settings.googleCalendarClientSecret
    )
    let isSignedIn = $derived(hasCredentials && settings.googleCalendarRefreshToken)

    // Timeline derived state
    let timedEvents = $derived(events.filter(e => !e.allDay))
    let allDayEvents = $derived(events.filter(e => e.allDay))
    let bounds = $derived(getTimelineBounds(timedEvents))
    let positioned = $derived(layoutEvents(timedEvents))
    let timelineHeight = $derived((bounds.endHour - bounds.startHour) * PX_PER_HOUR)

    function formatTimeRange(event) {
        const start = formatTime(event.start, false, { short: true })
        const end = formatTime(event.end, false, { short: true })
        return `${start}\u2013${end}`
    }

    async function loadEvents() {
        if (!isSignedIn) return

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

            // Fetch today's events from selected calendars, with color info
            events = await backend.getTodayEvents(accessToken, calendarIds, calendarColorCache)
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

    function formatTime(dateString, allDay, { short = false } = {}) {
        if (allDay) return 'all day'

        const date = new Date(dateString)
        const hours = date.getHours()
        const minutes = date.getMinutes()

        if (settings.timeFormat === '24hr') {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        } else {
            const period = short ? '' : (hours >= 12 ? 'PM' : 'AM')
            const hour12 = hours % 12 || 12
            if (minutes === 0) {
                return `${hour12}${period}`
            }
            return `${hour12}:${minutes.toString().padStart(2, '0')}${period}`
        }
    }

    function isEventPast(event) {
        if (event.allDay) return false
        const endTime = new Date(event.end)
        return endTime < new Date()
    }

    function isEventNow(event) {
        if (event.allDay) {
            // All-day events are "now" all day
            return true
        }
        const now = new Date()
        const startTime = new Date(event.start)
        const endTime = new Date(event.end)
        return now >= startTime && now < endTime
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
    <button class="widget-label" onclick={loadEvents} disabled={loading || !isSignedIn}>
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
            <div class="message">no events today</div>
        {:else}
            <!-- All-day events at top if any -->
            {#if allDayEvents.length > 0}
                <div class="all-day-events">
                    {#each allDayEvents as event}
                        <div class="all-day-event" style="color: {event.calendarColor};">
                            <span class="bar" style="background-color: {event.calendarColor};"></span>
                            <span class="title">{event.title}</span>
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- Timeline -->
            <div class="timeline" style="height: {timelineHeight}px;">
                <!-- Hour markers -->
                {#each Array.from({length: bounds.endHour - bounds.startHour + 1}, (_, i) => bounds.startHour + i) as hour}
                    <div class="hour-marker" style="top: {(hour - bounds.startHour) * PX_PER_HOUR}px;">
                        <span class="hour-label">{hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}</span>
                    </div>
                {/each}

                <!-- Event cards -->
                {#each positioned as { event, column, totalColumns }}
                    {@const top = ((getMinuteOfDay(event.start) - bounds.startHour * 60) / 60) * PX_PER_HOUR}
                    {@const height = Math.max(24, (getEventDurationMinutes(event) / 60) * PX_PER_HOUR)}
                    {@const colFraction = column / totalColumns}
                    {@const widthFraction = 1 / totalColumns}
                    <div
                        class="event-card"
                        class:past={isEventPast(event)}
                        style="top: {top}px; height: {height}px; left: calc(1.5rem + (100% - 1.5rem) * {colFraction}); width: calc((100% - 1.5rem) * {widthFraction}); background-color: color-mix(in srgb, {event.calendarColor} 25%, transparent); border-color: color-mix(in srgb, {event.calendarColor} 40%, transparent);"
                    >
                        <span class="event-title" style="color: {event.calendarColor};">{event.title}</span>
                        <span class="event-time" style="color: {event.calendarColor};">{formatTimeRange(event)}</span>
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
    .all-day-events {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.5rem;
    }
    .all-day-event {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .all-day-event .bar {
        width: 3px;
        height: 1em;
        flex-shrink: 0;
        border-radius: 1.5px;
    }
    .all-day-event .title {
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .timeline {
        position: relative;
        margin-left: 0;
    }
    .hour-marker {
        position: absolute;
        width: 100%;
        display: flex;
        align-items: flex-start;
    }
    .hour-label {
        color: var(--txt-3);
        min-width: 1.25rem;
        text-align: right;
        font-size: 0.85em;
    }
    .event-card {
        position: absolute;
        z-index: 1;
        border: 1px solid;
        border-radius: 4px;
        padding: 2px 4px;
        overflow: hidden;
        box-sizing: border-box;
    }
    .event-card.past {
        opacity: 0.5;
    }
    .event-title {
        font-weight: bold;
        display: block;
    }
    .event-time {
        font-size: 0.7em;
        display: block;
    }
</style>
