<script>
    import { onMount, onDestroy } from 'svelte'
    import { settings } from '../stores/settings-store.svelte.js'
    import {
        getSunState,
        getSolarAltitude,
        formatDuration,
    } from '../utils/sun-position.js'

    // A symmetric circular arc spanning the active phase, and the same arc all
    // round the clock: the height rides on how high the sun climbs that day, so
    // summer arcs tower over winter ones and the night is the day's arc walked
    // a second time in the dark.
    const WIDTH = 240
    const LEFT = 14
    const RIGHT = 226
    const HORIZON = 70
    const HALF_WIDTH = (RIGHT - LEFT) / 2
    // The dome's height in viewBox units, from a sun that never clears the
    // horizon to one at the zenith. The floor is what keeps this reading as an
    // arc at all: the winter sun barely rises up north, and a height taken
    // straight from its altitude flattened the curve into a line there.
    const MIN_HEIGHT = 22
    const MAX_HEIGHT = 60
    // Vertical scale: degrees of altitude to viewBox units, sized so the zenith
    // lands on MAX_HEIGHT and the arc stays inside the sky band.
    const DEG = (MAX_HEIGHT - MIN_HEIGHT) / 90
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

    // Horizontal offset from the middle of the span, in viewBox units.
    function offsetAt(fraction) {
        return (2 * clamp01(fraction) - 1) * HALF_WIDTH
    }

    // How far the circle rises above the horizon at a given offset from the
    // middle. The centre sits `radius - height` below the horizon, so this is
    // the circle's own height there less that drop.
    function arcRise(offset, radius, height) {
        const span = Math.max(0, radius * radius - offset * offset)
        return Math.sqrt(span) - (radius - height)
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

    // Keyed to the span the arc is actually drawing, not to the sky. Those part
    // ways for the four minutes between the sun reaching 0 degrees and true
    // sunset at -0.833, and keying to altitude there put the widget in night
    // dress while it was still tracking the daylight span -- violet marker, and
    // an endpoint reading the sunrise time under a "sunset" label.
    let isNight = $derived(
        state?.phase === 'night' || state?.phase === 'polar-night'
    )
    let progress = $derived(state?.progress ?? 0.5)

    // At the handover the marker teleports: the outgoing span ends at progress 1
    // and the incoming one starts at 0, which is the far end of the arc. Letting
    // it slide there reads as the sun running backwards through the whole day,
    // so it instead sets below the horizon, crosses unseen, and rises again at
    // the other end. These bounds are shared with the CSS keyframes below.
    const HANDOFF_MS = 1700
    // When the marker gives up its outgoing position, in the middle of the
    // window where the keyframes hold it under the horizon at zero opacity.
    const HANDOFF_SWAP_MS = 880
    let handoff = $state(false)
    // The outgoing progress, held until the swap so the jump happens unseen.
    let heldProgress = $state(null)
    let handoffTimer = null
    let swapTimer = null
    // Plain, not $state: the effect writes them, and reading them reactively
    // would re-run the effect they were written from.
    let lastPhaseWasNight = null
    let lastProgress = 0

    $effect(() => {
        const night = isNight
        // Read so this re-runs each tick and keeps `lastProgress` one step
        // behind, which is the position the outgoing body has to hold.
        const current = progress
        // The first run only establishes the baseline. Animating here would play
        // the handover on every page load.
        const flipped =
            lastPhaseWasNight !== null && lastPhaseWasNight !== night
        lastPhaseWasNight = night
        if (!flipped) {
            lastProgress = current
            return
        }

        heldProgress = lastProgress
        lastProgress = current
        handoff = true
        clearTimeout(swapTimer)
        clearTimeout(handoffTimer)
        swapTimer = setTimeout(() => (heldProgress = null), HANDOFF_SWAP_MS)
        handoffTimer = setTimeout(() => (handoff = false), HANDOFF_MS)
    })

    // The arc is a symmetric dome spanning the active phase. Its shape is fixed
    // so it always reads as an arc; what stays real is how tall it stands, which
    // follows how high the sun gets that day. The sun sets the height at night
    // too, so day and night draw the same dome and the marker simply crosses it
    // twice. Sizing the night to the moon instead was tried and rejected: the
    // moon is below the horizon for most of many nights, which flattened the
    // curve to a line, and it left the two halves of the day unrelated in shape.
    // Plotting altitude point by point was also tried, and drew a straight-sided
    // tent rather than an arc.
    let peakAltitude = $derived.by(() => {
        if (!coordinates || !state?.sunrise || !state?.sunset) return 0

        // Sunrise and sunset are mirrored about solar noon, so their midpoint is
        // solar noon exactly -- which is where the day's peak altitude is.
        const solarNoon = new Date(
            (state.sunrise.valueOf() + state.sunset.valueOf()) / 2
        )
        return getSolarAltitude(
            solarNoon,
            coordinates.latitude,
            coordinates.longitude
        )
    })

    let arcHeight = $derived(
        MIN_HEIGHT + Math.min(90, Math.max(0, peakAltitude)) * DEG
    )

    // The circle through both endpoints that rises `arcHeight` in the middle:
    // for a chord of half-width w and a sagitta h, the radius is (w^2+h^2)/2h.
    // A circle rather than a half ellipse because constant curvature is what
    // reads as round -- an ellipse this wide stands up vertically at the two
    // ends and then runs flat across the top, which is the shape it was drawn
    // as before and did not look like an arc.
    let arcRadius = $derived(
        (HALF_WIDTH * HALF_WIDTH + arcHeight * arcHeight) / (2 * arcHeight)
    )
    // arcHeight never reaches HALF_WIDTH, so this is always the minor arc and
    // the large-arc flag stays 0.
    let arcPath = $derived(
        `M ${LEFT} ${HORIZON} A ${arcRadius.toFixed(2)} ${arcRadius.toFixed(2)} 0 0 1 ${RIGHT} ${HORIZON}`
    )

    // x is linear in time so the marker tracks the clock; y puts it on the arc.
    // Mid-handover it is pinned to where the outgoing span left it.
    let markerProgress = $derived(heldProgress ?? progress)
    let markerX = $derived(LEFT + (RIGHT - LEFT) * markerProgress)
    let markerY = $derived(
        HORIZON - arcRise(offsetAt(markerProgress), arcRadius, arcHeight)
    )

    // The traveled stroke is dashed off by *length* along the arc, but the
    // marker sits at a fraction of the *width*. Those two advance at different
    // rates -- the sloped ends cover more length per unit of width than the top
    // does -- and dashing at `progress` directly left the stroke visibly out in
    // front of the sun. On a circle length is exactly proportional to the
    // central angle, so convert through that.
    let traveledLength = $derived.by(() => {
        const half = Math.asin(Math.min(1, HALF_WIDTH / arcRadius))
        if (half <= 0) return progress
        const angle = Math.asin(offsetAt(progress) / arcRadius)
        return clamp01((angle + half) / (2 * half))
    })

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
        clearTimeout(handoffTimer)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
</script>

{#if state}
    <div
        class="sun-arc"
        class:night={isNight}
        class:handoff
        style="--handoff: {HANDOFF_MS}ms"
        role="img"
        aria-label={label}
    >
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
                stroke-dasharray="{traveledLength} 1"
            />

            <g class="body">
                <circle class="glow" cx={markerX} cy={markerY} r="8.5" />
                <circle class="marker" cx={markerX} cy={markerY} r="4.5" />
            </g>
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
    /* Length eases so the minute ticks creep rather than jump, and so the
       handover reads as the day's light draining back off the arc alongside the
       body's descent. The colour is held until 0.72s, by which point the trail
       has drained to nothing and the swap lands on a stroke too short to show
       it. */
    .traveled {
        fill: none;
        stroke: var(--txt-orange);
        stroke-width: 2.5;
        stroke-linecap: round;
        transition:
            stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s,
            stroke 0.3s linear 0.72s;
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
        /* So the flare scales about the disc rather than the viewBox origin. */
        transform-box: fill-box;
        transform-origin: center;
    }
    .night .glow {
        fill: var(--txt-link);
    }
    /* Like the trail's stroke, the fills are held back to the point where the
       body is under the horizon, so day and night colours never cross in view. */
    .marker,
    .glow {
        transition:
            cx 0.6s ease-out,
            cy 0.6s ease-out,
            fill 0.3s linear 0.72s;
    }

    /* The one moment the marker must not tween between its two positions. */
    .handoff .marker,
    .handoff .glow {
        transition: fill 0.3s linear 0.72s;
    }

    .body {
        transform-box: fill-box;
        transform-origin: center;
    }
    .handoff .body {
        animation: arc-handoff var(--handoff) both;
    }
    .handoff .glow {
        animation: arc-flare var(--handoff) both;
    }

    /* Sets, holds under the horizon while the position swaps ends, then rises.
       The hold from 38% to 66% -- 646ms to 1122ms -- is the cover the swap needs,
       and HANDOFF_SWAP_MS is timed into the middle of it. */
    @keyframes arc-handoff {
        0%,
        14% {
            animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.4);
            transform: translateY(0);
            opacity: 1;
        }
        38%,
        66% {
            animation-timing-function: cubic-bezier(0.1, 0.75, 0.3, 1);
            transform: translateY(13px);
            opacity: 0;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }

    /* The flare as the body meets the horizon on the way down, and the softer
       bloom as the incoming one clears it coming back up. */
    @keyframes arc-flare {
        0%,
        14% {
            transform: scale(1);
            opacity: 0.2;
        }
        24% {
            transform: scale(2.4);
            opacity: 0.34;
        }
        38%,
        66% {
            transform: scale(1);
            opacity: 0;
        }
        84% {
            transform: scale(1.9);
            opacity: 0.3;
        }
        100% {
            transform: scale(1);
            opacity: 0.2;
        }
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
    /* The handover is the most motion this widget ever makes, so it is the first
       thing to go. Everything still lands in the right place, just instantly. */
    @media (prefers-reduced-motion: reduce) {
        .marker,
        .glow,
        .traveled,
        .handoff .marker,
        .handoff .glow {
            transition: none;
        }
        .handoff .body,
        .handoff .glow {
            animation: none;
        }
    }
</style>
