<script>
    import { onMount, onDestroy } from 'svelte'
    import { settings } from '../stores/settings-store.svelte.js'
    import SunArc from './SunArc.svelte'

    let currentHrs = $state('')
    let currentMin = $state('')
    let currentSec = $state('')
    let currentAmPm = $state('')
    let currentDate = $state('')
    let greeting = $state('')

    let clockInterval = null
    let clockTimeout = null

    // Building an Intl formatter is expensive relative to a clock tick, and the
    // date it renders only changes at midnight. Keep both the formatter and the
    // day it was last rendered for.
    let dateFormatter = null
    let dateFormatterLocale = ''
    let renderedDateKey = ''

    // Without a seconds display nothing on screen changes more than once a
    // minute, so there is no reason to wake up every second.
    let tickPeriod = $derived(settings.showSeconds ? 1000 : 60000)

    function getGreeting(hour) {
        if (hour >= 5 && hour < 12) return 'Good morning'
        if (hour >= 12 && hour < 17) return 'Good afternoon'
        return 'Good evening'
    }

    function formatDate(now, locale) {
        if (!dateFormatter || dateFormatterLocale !== locale) {
            dateFormatterLocale = locale
            dateFormatter = new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
        }
        return dateFormatter.format(now).toLowerCase()
    }

    function updateTime() {
        const now = new Date()

        let hours = now.getHours()

        // Update greeting
        const greetingText = getGreeting(hours)
        greeting = settings.userName
            ? `${greetingText}, ${settings.userName}`
            : greetingText

        if (settings.timeFormat === '12hr') {
            currentAmPm = hours >= 12 ? 'pm' : 'am'
            hours = hours % 12
            if (hours === 0) hours = 12
        } else {
            currentAmPm = ''
        }

        currentHrs = hours.toString().padStart(2, '0')
        currentMin = now.getMinutes().toString().padStart(2, '0')
        currentSec = now.getSeconds().toString().padStart(2, '0')

        const locale = settings.dateFormat === 'dmy' ? 'en-GB' : 'en-US'
        const dateKey = `${locale}|${now.toDateString()}`
        if (dateKey !== renderedDateKey) {
            renderedDateKey = dateKey
            currentDate = formatDate(now, locale)
        }
    }

    function stopClock() {
        if (clockTimeout) {
            clearTimeout(clockTimeout)
            clockTimeout = null
        }
        if (clockInterval) {
            clearInterval(clockInterval)
            clockInterval = null
        }
    }

    function startClock(period) {
        // Always tear down first: a visible -> hidden -> visible cycle used to
        // strand the previous interval, so every round trip added a live timer.
        stopClock()
        updateTime()

        const delay = period - (Date.now() % period)
        clockTimeout = setTimeout(() => {
            clockTimeout = null
            updateTime()
            clockInterval = setInterval(updateTime, period)
        }, delay)
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            startClock(tickPeriod)
        } else {
            stopClock()
        }
    }

    // Restarts on its own when the seconds setting changes the cadence.
    $effect(() => {
        const period = tickPeriod
        if (document.visibilityState === 'visible') startClock(period)
        return stopClock
    })

    onMount(() => {
        document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onDestroy(() => {
        stopClock()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
</script>

<div class="panel-wrapper">
    <div class="panel-label">datetime</div>
    <div class="panel">
        <div class="readout">
            <div class="greeting">{greeting}</div>
            <div class="clock">
                {currentHrs}<span class="colon">:</span>{currentMin}{#if settings.showSeconds}<span
                        class="colon">:</span
                    >{currentSec}{/if}
                {#if settings.timeFormat === '12hr'}
                    <span class="ampm">{currentAmPm}</span>
                {/if}
            </div>
            <div class="date">{currentDate}</div>
        </div>
        {#if settings.showDaylightArc}
            <SunArc />
        {/if}
    </div>
</div>

<style>
    .panel-wrapper {
        flex-grow: 1;
    }
    .panel {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 2rem;
    }
    .readout {
        min-width: 0;
    }
    .greeting {
        font-size: 1.25rem;
        color: var(--txt-2);
        margin-bottom: 0.25rem;
    }
    .clock {
        font-size: 3.125rem;
        font-weight: var(--font-weight-light);
        color: var(--txt-num);
        line-height: 3.5rem;
        margin: 0 0 0.5rem 0;
    }
    .colon,
    .ampm {
        color: var(--txt-num);
    }
    .date {
        font-size: 1.5rem;
        color: var(--txt-3);
        line-height: 2rem;
        margin: 0;
    }
</style>
