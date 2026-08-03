<script>
    import { onMount, onDestroy } from 'svelte'
    import { settings } from '../stores/settings-store.svelte.js'
    import {
        getSunState,
        getSolarAltitude,
        formatDuration,
    } from '../utils/sun-position.js'
    import { getMoonPosition } from '../utils/moon-position.js'

    // A symmetric half-ellipse spanning the active phase. The shape is fixed;
    // the height is real, tracking the peak altitude the sun or moon reaches
    // over the span, so summer arcs tower over winter ones.
    const WIDTH = 240
    const LEFT = 14
    const RIGHT = 226
    const HORIZON = 70
    // Vertical scale: degrees of altitude to viewBox units.
    const DEG = 0.62
    // Only used to find the peak altitude over the span, not to shape the line.
    const SAMPLES = 25
    const VIEWBOX = `0 0 ${WIDTH} 96`

    const TICK_MS = 60000

    // Fixed star field so it holds still between ticks instead of twinkling.
    const STARS = createStars(24)

    function createStars(count) {
        let seed = 20260802
        const random = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296
            return seed / 4294967296
        }
        return Array.from({ length: count }, () => ({
            x: 6 + random() * (WIDTH - 12),
            y: 4 + random() * (HORIZON - 14),
            r: 0.35 + random() * 0.7,
            opacity: 0.35 + random() * 0.65,
        }))
    }

    function clamp01(value) {
        return Math.min(1, Math.max(0, value))
    }

    function smoothstep(value, edge0, edge1) {
        const t = clamp01((value - edge0) / (edge1 - edge0))
        return t * t * (3 - 2 * t)
    }

    // Smooth 0..1 hump peaking at `center`, reaching zero `halfWidth` away.
    function hump(value, center, halfWidth) {
        return smoothstep(1 - Math.abs(value - center) / halfWidth, 0, 1)
    }

    // Height of the arc at a given fraction across it. A half ellipse, so the
    // curve is symmetric by construction and round at the top.
    function domeHeight(fraction) {
        const offset = 2 * clamp01(fraction) - 1
        return Math.sqrt(Math.max(0, 1 - offset * offset))
    }

    let now = $state(new Date())
    let tickInterval = null

    // Manual coordinates win. In auto mode the weather widget has already
    // resolved a position and cached it, so reuse that rather than firing a
    // second geolocation prompt from the clock.
    let coordinates = $derived.by(() => {
        if (settings.latitude != null && settings.longitude != null) {
            return {
                latitude: settings.latitude,
                longitude: settings.longitude,
            }
        }
        try {
            const cached = JSON.parse(localStorage.getItem('weather_data'))
            if (cached?.latitude != null && cached?.longitude != null) {
                return {
                    latitude: cached.latitude,
                    longitude: cached.longitude,
                }
            }
        } catch {}
        return null
    })

    let state = $derived(
        coordinates
            ? getSunState(now, coordinates.latitude, coordinates.longitude)
            : null
    )

    // The sky is driven by where the sun actually is, so dawn and dusk shade
    // through rather than snapping between day and night.
    let altitude = $derived(
        coordinates
            ? getSolarAltitude(now, coordinates.latitude, coordinates.longitude)
            : 0
    )

    // Keyed to the sun's depth so the sky tracks the twilight phases. The warm
    // band is deliberately narrow: golden hour is roughly -5 to +6 degrees, and
    // a wider hump left the sky reading brown well into civil twilight instead
    // of turning blue.
    let sky = $derived({
        day: smoothstep(altitude, 2, 20) * 0.16,
        golden: hump(altitude, 0, 6) * 0.26,
        // Civil and nautical twilight: the blue hour.
        twilight: hump(altitude, -6, 9) * 0.42,
        // Astronomical twilight fading into night.
        deep: hump(altitude, -13, 9) * 0.2,
    })
    let starOpacity = $derived(smoothstep(-altitude, 6, 16))

    let isNight = $derived(altitude <= 0)
    let progress = $derived(state?.progress ?? 0.5)

    // One solar position per sample, but the shape only changes when the span
    // does, so this must not recompute on every tick.
    let curveCache = { key: '', peak: 0 }

    // The arc is a symmetric dome spanning the active phase. Its shape is fixed
    // so it always reads as an arc; what stays real is its height, which is the
    // peak altitude the body actually reaches over the span. Plotting altitude
    // point by point was tried and rejected: by day it drew a straight-sided
    // tent, and by night the moon often rises late and is still climbing at
    // sunrise, so the curve ran off the edge instead of coming back down.
    let peakAltitude = $derived.by(() => {
        if (!coordinates || !state?.spanStart || !state?.spanEnd) return 0

        const { latitude, longitude } = coordinates
        const start = state.spanStart.valueOf()
        const end = state.spanEnd.valueOf()
        const body = isNight ? 'moon' : 'sun'
        const key = `${start}|${end}|${latitude}|${longitude}|${body}`
        if (curveCache.key === key) return curveCache.peak

        let peak = 0
        for (let i = 0; i < SAMPLES; i++) {
            const at = new Date(start + ((end - start) * i) / (SAMPLES - 1))
            const sampled = isNight
                ? getMoonPosition(at, latitude, longitude).altitude
                : getSolarAltitude(at, latitude, longitude)
            if (sampled > peak) peak = sampled
        }

        curveCache = { key, peak }
        return peak
    })

    let arcHeight = $derived(peakAltitude * DEG)
    let arcPath = $derived(
        `M ${LEFT} ${HORIZON} A ${(RIGHT - LEFT) / 2} ${arcHeight.toFixed(2)} 0 0 1 ${RIGHT} ${HORIZON}`
    )

    // x is linear in time so the marker tracks the clock; y puts it on the dome.
    let markerX = $derived(LEFT + (RIGHT - LEFT) * progress)
    let markerY = $derived(HORIZON - arcHeight * domeHeight(progress))

    // The arc always runs left to right through the active phase, so at night
    // the left end is the sunset it began at and the right end is the sunrise
    // it ends at.
    let endpoints = $derived.by(() => {
        if (isNight) {
            return {
                start: { at: state?.spanStart, tag: 'sunset' },
                end: { at: state?.spanEnd, tag: 'sunrise' },
            }
        }
        return {
            start: { at: state?.spanStart ?? state?.sunrise, tag: 'sunrise' },
            end: { at: state?.spanEnd ?? state?.sunset, tag: 'sunset' },
        }
    })

    let caption = $derived.by(() => {
        if (!state) return null
        if (state.phase === 'polar-day') return { text: 'midnight sun' }
        if (state.phase === 'polar-night') return { text: 'polar night' }
        if (state.remainingMs == null) return null
        return {
            value: formatDuration(state.remainingMs),
            text: isNight ? 'until sunrise' : 'of daylight left',
        }
    })

    let label = $derived.by(() => {
        if (!state) return ''
        if (state.phase === 'polar-day')
            return 'midnight sun, the sun does not set'
        if (state.phase === 'polar-night')
            return 'polar night, the sun does not rise'
        if (isNight) {
            return `night, ${Math.round(progress * 100)}% of the way to sunrise`
        }
        return `sun ${Math.round(altitude)} degrees above the horizon`
    })

    function formatClockTime(date) {
        if (!date) return '--'
        const hours = date.getHours()
        const minutes = date.getMinutes().toString().padStart(2, '0')

        if (settings.timeFormat === '24hr') {
            return `${hours.toString().padStart(2, '0')}:${minutes}`
        }
        const period = hours >= 12 ? 'pm' : 'am'
        const hour12 = hours % 12 || 12
        return `${hour12}:${minutes} ${period}`
    }

    function startTicking() {
        now = new Date()
        stopTicking()
        tickInterval = setInterval(() => (now = new Date()), TICK_MS)
    }

    function stopTicking() {
        if (tickInterval) {
            clearInterval(tickInterval)
            tickInterval = null
        }
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            startTicking()
        } else {
            stopTicking()
        }
    }

    onMount(() => {
        startTicking()
        document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onDestroy(() => {
        stopTicking()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
</script>

{#if state}
    <div class="sun-arc" class:night={isNight} role="img" aria-label={label}>
        <svg viewBox={VIEWBOX} aria-hidden="true">
            <defs>
                <!-- Fades the sky out at the left and right so it reads as
                     ambient light rather than a pasted rectangle. -->
                <linearGradient id="arc-sky-edges" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stop-color="#000" />
                    <stop offset="0.15" stop-color="#fff" />
                    <stop offset="0.85" stop-color="#fff" />
                    <stop offset="1" stop-color="#000" />
                </linearGradient>
                <mask id="arc-sky-mask">
                    <rect
                        x="0"
                        y="0"
                        width={WIDTH}
                        height={HORIZON}
                        fill="url(#arc-sky-edges)"
                    />
                </mask>
                <linearGradient id="arc-day" x1="0" y1="0" x2="0" y2="1">
                    <stop class="stop-day" offset="0" stop-opacity="0" />
                    <stop class="stop-day" offset="1" stop-opacity="1" />
                </linearGradient>
                <linearGradient id="arc-golden" x1="0" y1="0" x2="0" y2="1">
                    <stop class="stop-golden" offset="0" stop-opacity="0" />
                    <stop class="stop-golden" offset="1" stop-opacity="1" />
                </linearGradient>
                <linearGradient id="arc-twilight" x1="0" y1="0" x2="0" y2="1">
                    <stop class="stop-twilight" offset="0" stop-opacity="0" />
                    <stop class="stop-twilight" offset="1" stop-opacity="1" />
                </linearGradient>
                <linearGradient id="arc-deep" x1="0" y1="0" x2="0" y2="1">
                    <stop class="stop-deep" offset="0" stop-opacity="0" />
                    <stop class="stop-deep" offset="1" stop-opacity="1" />
                </linearGradient>
            </defs>

            <g mask="url(#arc-sky-mask)">
                <rect
                    x="0"
                    y="0"
                    width={WIDTH}
                    height={HORIZON}
                    fill="url(#arc-day)"
                    opacity={sky.day}
                />
                <rect
                    x="0"
                    y="0"
                    width={WIDTH}
                    height={HORIZON}
                    fill="url(#arc-golden)"
                    opacity={sky.golden}
                />
                <rect
                    x="0"
                    y="0"
                    width={WIDTH}
                    height={HORIZON}
                    fill="url(#arc-twilight)"
                    opacity={sky.twilight}
                />
                <rect
                    x="0"
                    y="0"
                    width={WIDTH}
                    height={HORIZON}
                    fill="url(#arc-deep)"
                    opacity={sky.deep}
                />
            </g>

            {#if starOpacity > 0}
                <g class="stars" opacity={starOpacity}>
                    {#each STARS as star}
                        <circle
                            cx={star.x}
                            cy={star.y}
                            r={star.r}
                            opacity={star.opacity}
                        />
                    {/each}
                </g>
            {/if}

            <line class="horizon" x1="0" y1={HORIZON} x2={WIDTH} y2={HORIZON} />

            <path class="track" d={arcPath} />
            <path
                class="traveled"
                d={arcPath}
                pathLength="1"
                stroke-dasharray="{progress} 1"
            />

            <circle class="glow" cx={markerX} cy={markerY} r="8.5" />
            <circle class="marker" cx={markerX} cy={markerY} r="4.5" />
        </svg>

        <div class="endpoints">
            <span class="endpoint">
                <span class="time">{formatClockTime(endpoints.start.at)}</span>
                <span class="tag">{endpoints.start.tag}</span>
            </span>
            <span class="endpoint right">
                <span class="time">{formatClockTime(endpoints.end.at)}</span>
                <span class="tag">{endpoints.end.tag}</span>
            </span>
        </div>

        {#if caption}
            <div class="caption">
                {#if caption.value}
                    <span class="value">{caption.value}</span>
                {/if}
                <span>{caption.text}</span>
            </div>
        {/if}

    </div>
{/if}

<style>
    .sun-arc {
        flex-shrink: 0;
        width: 15rem;
        max-width: 100%;
    }
    svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
    }
    .stop-day {
        stop-color: var(--txt-link);
    }
    .stop-golden {
        stop-color: var(--txt-orange);
    }
    /* The blue hour, then the violet cast of astronomical twilight. */
    .stop-twilight {
        stop-color: var(--txt-link);
    }
    .stop-deep {
        stop-color: var(--txt-violet);
    }
    .stars circle {
        fill: var(--txt-1);
    }
    .horizon {
        stroke: var(--bg-3);
        stroke-width: 2;
    }
    /* Not --bg-3: a background-tier colour disappears against the night sky,
       which leaves the yet-to-come part of the arc invisible. */
    .track {
        fill: none;
        stroke: var(--txt-3);
        stroke-width: 2.5;
        opacity: 0.55;
    }
    .traveled {
        fill: none;
        stroke: var(--txt-orange);
        stroke-width: 2.5;
        stroke-linecap: round;
    }
    .night .traveled {
        stroke: var(--txt-violet);
    }
    .marker {
        fill: var(--txt-num);
    }
    .night .marker {
        fill: var(--txt-link);
    }
    .glow {
        fill: var(--txt-num);
        opacity: 0.2;
    }
    .night .glow {
        fill: var(--txt-link);
    }
    .marker,
    .glow {
        transition:
            cx 0.6s ease-out,
            cy 0.6s ease-out;
    }
    .endpoints {
        display: flex;
        justify-content: space-between;
        margin-top: 0.25rem;
    }
    .endpoint {
        display: flex;
        flex-direction: column;
        font-size: 0.8rem;
        line-height: 1.3;
    }
    .endpoint.right {
        text-align: end;
    }
    .time {
        color: var(--txt-num);
    }
    .tag {
        color: var(--txt-3);
        font-size: 0.7rem;
    }
    .caption {
        display: flex;
        justify-content: center;
        gap: 0.6ch;
        margin-top: 0.4rem;
        font-size: 0.8rem;
        color: var(--txt-3);
    }
    .caption span {
        white-space: nowrap;
    }
    .caption .value {
        color: var(--txt-num);
    }
    @media (prefers-reduced-motion: reduce) {
        .marker,
        .glow {
            transition: none;
        }
    }
</style>
