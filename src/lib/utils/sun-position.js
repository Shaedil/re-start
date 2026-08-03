/**
 * Solar position math for the daylight arc.
 *
 * Sunrise and sunset are computed locally with the standard NOAA solar
 * equations rather than fetched, so the arc works offline and costs no extra
 * request beyond the coordinates the weather widget already resolves.
 *
 * Accurate to roughly a minute for ordinary latitudes, which is well inside
 * what a decorative arc needs.
 */

const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545

// Earth's axial tilt.
const OBLIQUITY = RAD * 23.4397

// Solar altitude that counts as sunrise/sunset: the sun's upper limb touching
// the horizon, corrected for atmospheric refraction.
const HORIZON = RAD * -0.833

// Standard twilight boundaries, as solar altitude below the horizon.
export const TWILIGHT_ALTITUDES = {
    civil: -6,
    nautical: -12,
    astronomical: -18,
}

// Leading fraction of the julian cycle calculation.
const J0 = 0.0009

// cos(latitude) hits zero at the poles and the hour-angle division blows up,
// so keep coordinates just shy of them.
const MAX_LATITUDE = 89.9

function toJulian(date) {
    return date.valueOf() / DAY_MS - 0.5 + J1970
}

function fromJulian(julian) {
    return new Date((julian + 0.5 - J1970) * DAY_MS)
}

function toDays(date) {
    return toJulian(date) - J2000
}

function solarMeanAnomaly(days) {
    return RAD * (357.5291 + 0.98560028 * days)
}

function eclipticLongitude(meanAnomaly) {
    const center =
        RAD *
        (1.9148 * Math.sin(meanAnomaly) +
            0.02 * Math.sin(2 * meanAnomaly) +
            0.0003 * Math.sin(3 * meanAnomaly))
    const perihelion = RAD * 102.9372
    return meanAnomaly + center + perihelion + Math.PI
}

function declination(eclipticLong) {
    return Math.asin(Math.sin(OBLIQUITY) * Math.sin(eclipticLong))
}

function approxTransit(hourAngle, lw, cycle) {
    return J0 + (hourAngle + lw) / (2 * Math.PI) + cycle
}

function solarTransitJ(approx, meanAnomaly, eclipticLong) {
    return (
        J2000 +
        approx +
        0.0053 * Math.sin(meanAnomaly) -
        0.0069 * Math.sin(2 * eclipticLong)
    )
}

function clampLatitude(latitude) {
    return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude))
}

/**
 * The per-day solar quantities every threshold crossing shares.
 */
function dayContext(date, latitude, longitude) {
    const lw = RAD * -longitude
    const phi = RAD * clampLatitude(latitude)
    const days = toDays(date)

    const cycle = Math.round(days - J0 - lw / (2 * Math.PI))
    const approx = approxTransit(0, lw, cycle)
    const meanAnomaly = solarMeanAnomaly(approx)
    const eclipticLong = eclipticLongitude(meanAnomaly)

    return {
        lw,
        phi,
        cycle,
        meanAnomaly,
        eclipticLong,
        dec: declination(eclipticLong),
        jNoon: solarTransitJ(approx, meanAnomaly, eclipticLong),
    }
}

/**
 * When the sun crosses a given altitude on the way up and back down.
 *
 * `polar` is 'day' when the sun stays above that altitude all day and 'night'
 * when it never reaches it.
 */
function crossingsAtAltitude(context, altitudeRad) {
    const { lw, phi, cycle, meanAnomaly, eclipticLong, dec, jNoon } = context

    const cosHourAngle =
        (Math.sin(altitudeRad) - Math.sin(phi) * Math.sin(dec)) /
        (Math.cos(phi) * Math.cos(dec))

    // Out of range means the sun stays entirely above or entirely below the
    // threshold for the whole day.
    if (cosHourAngle <= -1) return { rise: null, set: null, polar: 'day' }
    if (cosHourAngle >= 1) return { rise: null, set: null, polar: 'night' }

    const hourAngle = Math.acos(cosHourAngle)
    const jSet = solarTransitJ(
        approxTransit(hourAngle, lw, cycle),
        meanAnomaly,
        eclipticLong
    )
    // The upward crossing mirrors the downward one across solar noon.
    return {
        rise: fromJulian(jNoon - (jSet - jNoon)),
        set: fromJulian(jSet),
        polar: null,
    }
}

/**
 * Sunrise, sunset and solar noon for the local day containing `date`.
 *
 * When the sun never crosses the horizon, `sunrise` and `sunset` are null and
 * `polar` is 'day' (midnight sun) or 'night' (polar night).
 *
 * @returns {{sunrise: Date|null, sunset: Date|null, solarNoon: Date, polar: 'day'|'night'|null}}
 */
export function getSunTimes(date, latitude, longitude) {
    const context = dayContext(date, latitude, longitude)
    const { rise, set, polar } = crossingsAtAltitude(context, HORIZON)

    return {
        sunrise: rise,
        sunset: set,
        solarNoon: fromJulian(context.jNoon),
        polar,
    }
}

/**
 * Civil, nautical and astronomical twilight boundaries for the local day.
 *
 * Each entry is the moment the sun passes that altitude before sunrise
 * (`dawn`) and after sunset (`dusk`). Either can be null at high latitudes
 * where the sun never sinks that far, which is why the arc must treat a
 * missing boundary as "this twilight never ends" rather than as an error.
 *
 * @returns {{civil: {dawn: Date|null, dusk: Date|null}, nautical: {...}, astronomical: {...}}}
 */
export function getTwilightTimes(date, latitude, longitude) {
    const context = dayContext(date, latitude, longitude)
    const result = {}

    for (const [name, degrees] of Object.entries(TWILIGHT_ALTITUDES)) {
        const { rise, set } = crossingsAtAltitude(context, RAD * degrees)
        result[name] = { dawn: rise, dusk: set }
    }

    return result
}

/**
 * The sun's altitude above the horizon at an instant, in degrees.
 *
 * Negative below the horizon. This drives the sky tint, which shifts
 * continuously rather than snapping between day and night.
 */
export function getSolarAltitude(date, latitude, longitude) {
    const lw = RAD * -longitude
    const phi = RAD * clampLatitude(latitude)
    const days = toDays(date)

    const meanAnomaly = solarMeanAnomaly(days)
    const eclipticLong = eclipticLongitude(meanAnomaly)
    const dec = declination(eclipticLong)

    const rightAscension = Math.atan2(
        Math.sin(eclipticLong) * Math.cos(OBLIQUITY),
        Math.cos(eclipticLong)
    )
    const siderealTime = RAD * (280.16 + 360.9856235 * days) - lw
    const hourAngle = siderealTime - rightAscension

    const altitude = Math.asin(
        Math.sin(phi) * Math.sin(dec) +
            Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle)
    )
    return altitude / RAD
}

/**
 * Where the sun is in its current day or night span.
 *
 * `progress` runs 0..1 across whichever phase is active: sunrise to sunset
 * during the day, sunset to the next sunrise at night. It is null during polar
 * day or polar night, when there is no span to be part-way through.
 *
 * `spanStart` and `spanEnd` bound that same active phase, so at night they are
 * the sunset this night began at and the sunrise it ends at — not today's pair.
 *
 * @returns {{
 *   phase: 'day'|'night'|'polar-day'|'polar-night',
 *   progress: number|null,
 *   sunrise: Date|null,
 *   sunset: Date|null,
 *   spanStart: Date|null,
 *   spanEnd: Date|null,
 *   nextEvent: {kind: 'sunrise'|'sunset', at: Date}|null,
 *   remainingMs: number|null,
 *   daylightMs: number|null,
 * }}
 */
export function getSunState(now, latitude, longitude) {
    const today = getSunTimes(now, latitude, longitude)

    if (today.polar) {
        return {
            phase: today.polar === 'day' ? 'polar-day' : 'polar-night',
            progress: null,
            sunrise: null,
            sunset: null,
            spanStart: null,
            spanEnd: null,
            nextEvent: null,
            remainingMs: null,
            daylightMs: today.polar === 'day' ? DAY_MS : 0,
        }
    }

    const daylightMs = today.sunset - today.sunrise

    if (now >= today.sunrise && now <= today.sunset) {
        return {
            phase: 'day',
            progress: span(today.sunrise, today.sunset, now),
            sunrise: today.sunrise,
            sunset: today.sunset,
            spanStart: today.sunrise,
            spanEnd: today.sunset,
            nextEvent: { kind: 'sunset', at: today.sunset },
            remainingMs: today.sunset - now,
            daylightMs,
        }
    }

    // Before dawn the night began at yesterday's sunset; after dusk it ends at
    // tomorrow's sunrise.
    const beforeSunrise = now < today.sunrise
    const adjacent = getSunTimes(
        new Date(now.valueOf() + (beforeSunrise ? -DAY_MS : DAY_MS)),
        latitude,
        longitude
    )
    const nightStart = beforeSunrise ? adjacent.sunset : today.sunset
    const nightEnd = beforeSunrise ? today.sunrise : adjacent.sunrise

    return {
        phase: 'night',
        // The adjacent day can be polar, leaving the span open-ended.
        progress:
            nightStart && nightEnd ? span(nightStart, nightEnd, now) : null,
        sunrise: today.sunrise,
        sunset: today.sunset,
        spanStart: nightStart,
        spanEnd: nightEnd,
        nextEvent: nightEnd ? { kind: 'sunrise', at: nightEnd } : null,
        remainingMs: nightEnd ? nightEnd - now : null,
        daylightMs,
    }
}

function span(start, end, now) {
    const total = end - start
    if (total <= 0) return 0
    return Math.min(1, Math.max(0, (now - start) / total))
}

/**
 * Duration as compact TUI text, e.g. "13h 52m" or "48m".
 */
export function formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.round(ms / 60000))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}
