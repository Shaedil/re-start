/**
 * Lunar phase math for the moon widget.
 *
 * The phase is computed locally from the date alone rather than fetched, so the
 * widget works offline and needs no coordinates — unlike the sun arc, the
 * illuminated fraction is essentially the same everywhere on earth.
 *
 * This is the truncated series from Meeus' Astronomical Algorithms (the same
 * formulation suncalc uses): only the largest periodic term in longitude and
 * latitude is kept. That costs a few tenths of a percent in the illuminated
 * fraction and puts the named phases within a couple of hours of the real
 * event, which no one can tell apart on a text startpage.
 */

const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545

// Earth's axial tilt.
const OBLIQUITY = RAD * 23.4397

// Mean earth-sun distance in km. The real distance swings about 1.7% over the
// year, which shifts the phase angle by far less than the truncated lunar
// series already does, so a constant is enough here.
const SUN_DISTANCE = 149598000

// Mean earth-moon distance in km and the amplitude of its monthly variation.
const MOON_DISTANCE = 385001
const MOON_DISTANCE_AMPLITUDE = 20905

// Half-width, in cycles, of the window that still reads as an exact phase.
// One day either side of new/full/quarter — about how long each stays
// visually unchanged.
const PHASE_WINDOW = 1 / 29.530588

// cos(latitude) hits zero at the poles and the azimuth loses meaning there, so
// keep coordinates just shy of them.
const MAX_LATITUDE = 89.9

function toJulian(date) {
    return date.valueOf() / DAY_MS - 0.5 + J1970
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

// Ecliptic longitude/latitude to equatorial. The elongation could be taken
// straight from ecliptic coordinates, but the bright-limb angle needs the
// equatorial pair anyway, so both are derived from one conversion.
function rightAscension(eclipticLong, eclipticLat) {
    return Math.atan2(
        Math.sin(eclipticLong) * Math.cos(OBLIQUITY) -
            Math.tan(eclipticLat) * Math.sin(OBLIQUITY),
        Math.cos(eclipticLong)
    )
}

function declination(eclipticLong, eclipticLat) {
    return Math.asin(
        Math.sin(eclipticLat) * Math.cos(OBLIQUITY) +
            Math.cos(eclipticLat) * Math.sin(OBLIQUITY) * Math.sin(eclipticLong)
    )
}

function sunCoords(days) {
    const meanAnomaly = solarMeanAnomaly(days)
    const eclipticLong = eclipticLongitude(meanAnomaly)
    return {
        ra: rightAscension(eclipticLong, 0),
        dec: declination(eclipticLong, 0),
    }
}

function moonCoords(days) {
    // Mean longitude, mean anomaly, and mean distance from the ascending node.
    const meanLong = RAD * (218.316 + 13.176396 * days)
    const meanAnomaly = RAD * (134.963 + 13.064993 * days)
    const meanNodeDistance = RAD * (93.272 + 13.2293 * days)

    const eclipticLong = meanLong + RAD * 6.289 * Math.sin(meanAnomaly)
    const eclipticLat = RAD * 5.128 * Math.sin(meanNodeDistance)
    const distance =
        MOON_DISTANCE - MOON_DISTANCE_AMPLITUDE * Math.cos(meanAnomaly)

    return {
        ra: rightAscension(eclipticLong, eclipticLat),
        dec: declination(eclipticLong, eclipticLat),
        distance,
    }
}

function wrapCycle(value) {
    return ((value % 1) + 1) % 1
}

function wrapDegrees(value) {
    return ((value % 360) + 360) % 360
}

function clampLatitude(latitude) {
    return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude))
}

// Meeus 16.4: how much the atmosphere lifts an object's apparent altitude.
// Worth applying to the moon because the effect peaks at about half a degree
// right at the horizon, which is where a moonrise readout is most scrutinised.
// Takes and returns radians.
function astroRefraction(altitude) {
    // The series only holds above the horizon; below it, hold the horizon value
    // rather than let the tangent run away.
    const h = Math.max(0, altitude)
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179))
}

/**
 * How much of the moon's disc is lit, and where it sits in the synodic cycle.
 *
 * `phase` runs 0..1 through new -> first quarter -> full -> last quarter, so it
 * distinguishes the two halves of the cycle that `fraction` alone cannot.
 *
 * @param {Date} date
 * @returns {{
 *   fraction: number,
 *   phase: number,
 *   angle: number,
 *   waxing: boolean,
 * }}
 */
export function getMoonIllumination(date) {
    const days = toDays(date)
    const sun = sunCoords(days)
    const moon = moonCoords(days)

    // Angular separation of the moon from the sun as seen from earth.
    const elongation = Math.acos(
        Math.sin(sun.dec) * Math.sin(moon.dec) +
            Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra)
    )

    // The sun-moon-earth angle, which is what actually sets the terminator.
    // It differs from the elongation because the sun is not infinitely far off.
    const phaseAngle = Math.atan2(
        SUN_DISTANCE * Math.sin(elongation),
        moon.distance - SUN_DISTANCE * Math.cos(elongation)
    )

    // Position angle of the bright limb's midpoint. Its sign says which side of
    // the sun the moon is on, and so which half of the cycle we are in.
    const angle = Math.atan2(
        Math.cos(sun.dec) * Math.sin(sun.ra - moon.ra),
        Math.sin(sun.dec) * Math.cos(moon.dec) -
            Math.cos(sun.dec) * Math.sin(moon.dec) * Math.cos(sun.ra - moon.ra)
    )

    // phaseAngle runs pi (new) down to 0 (full) either way round the cycle, so
    // the limb angle mirrors it into the waxing or waning half.
    const phase = wrapCycle(
        0.5 + (0.5 * phaseAngle * (angle < 0 ? -1 : 1)) / Math.PI
    )

    return {
        fraction: (1 + Math.cos(phaseAngle)) / 2,
        phase,
        angle,
        waxing: phase < 0.5,
    }
}

/**
 * Where the moon actually is in the sky for an observer, so it can be drawn at
 * its real bearing and height rather than a decorative fixed spot.
 *
 * `azimuth` is the compass bearing: 0 north, 90 east, running clockwise.
 * `altitude` includes the atmospheric refraction correction, so it is the
 * apparent position an observer would see, not the geometric one.
 *
 * @param {Date} date
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{altitude: number, azimuth: number, distance: number}}
 */
export function getMoonPosition(date, latitude, longitude) {
    const lw = RAD * -longitude
    const phi = RAD * clampLatitude(latitude)
    const days = toDays(date)
    const moon = moonCoords(days)

    const siderealTime = RAD * (280.16 + 360.9856235 * days) - lw
    const hourAngle = siderealTime - moon.ra

    const altitude = Math.asin(
        Math.sin(phi) * Math.sin(moon.dec) +
            Math.cos(phi) * Math.cos(moon.dec) * Math.cos(hourAngle)
    )

    // atan2 here gives the bearing westward from south; shifting by 180 puts it
    // on the compass convention the caller wants.
    const azimuth = Math.atan2(
        Math.sin(hourAngle),
        Math.cos(hourAngle) * Math.sin(phi) -
            Math.tan(moon.dec) * Math.cos(phi)
    )

    return {
        altitude: (altitude + astroRefraction(altitude)) / RAD,
        azimuth: wrapDegrees(azimuth / RAD + 180),
        distance: moon.distance,
    }
}

/**
 * Display name for a 0..1 phase, e.g. 'waxing gibbous'.
 *
 * @param {number} phase
 * @returns {string}
 */
export function getMoonPhaseName(phase) {
    const cycle = wrapCycle(phase)

    // New moon straddles the wrap point, so check both ends.
    if (cycle < PHASE_WINDOW || cycle > 1 - PHASE_WINDOW) return 'new moon'
    if (Math.abs(cycle - 0.25) < PHASE_WINDOW) return 'first quarter'
    if (Math.abs(cycle - 0.5) < PHASE_WINDOW) return 'full moon'
    if (Math.abs(cycle - 0.75) < PHASE_WINDOW) return 'last quarter'

    if (cycle < 0.25) return 'waxing crescent'
    if (cycle < 0.5) return 'waxing gibbous'
    if (cycle < 0.75) return 'waning gibbous'
    return 'waning crescent'
}
