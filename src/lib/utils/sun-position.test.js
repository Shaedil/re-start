import { describe, it, expect } from 'vitest'
import {
    getSunTimes,
    getSunState,
    getSolarAltitude,
    getTwilightTimes,
    formatDuration,
    TWILIGHT_ALTITUDES,
} from './sun-position.js'

const MINUTE = 60000
const HOUR = 3600000

// Reference sunrise/sunset taken from the Open-Meteo API for the same
// coordinates and dates. The local formulas ignore elevation, so they run a
// minute or two later than a real observation; allow a small tolerance.
const TOLERANCE = 5 * MINUTE

const CITIES = {
    newYork: { latitude: 40.71, longitude: -74.01 },
    london: { latitude: 51.51, longitude: -0.13 },
    sydney: { latitude: -33.87, longitude: 151.21 },
    equator: { latitude: 0, longitude: 0 },
    longyearbyen: { latitude: 78.22, longitude: 15.65 },
}

function expectCloseTo(actual, expectedIso) {
    const expected = new Date(expectedIso)
    const drift = Math.abs(actual - expected)
    expect(
        drift,
        `${actual.toISOString()} should be within ${TOLERANCE / MINUTE}m of ${expectedIso}`
    ).toBeLessThanOrEqual(TOLERANCE)
}

describe('getSunTimes', () => {
    it('matches reference times for new york in summer', () => {
        const times = getSunTimes(
            new Date('2026-08-02T16:00:00Z'),
            CITIES.newYork.latitude,
            CITIES.newYork.longitude
        )
        expectCloseTo(times.sunrise, '2026-08-02T09:53:00Z')
        expectCloseTo(times.sunset, '2026-08-03T00:10:00Z')
    })

    it('matches reference times for london at the winter solstice', () => {
        const times = getSunTimes(
            new Date('2025-12-21T12:00:00Z'),
            CITIES.london.latitude,
            CITIES.london.longitude
        )
        expectCloseTo(times.sunrise, '2025-12-21T08:03:00Z')
        expectCloseTo(times.sunset, '2025-12-21T15:53:00Z')
    })

    it('matches reference times for london at the summer solstice', () => {
        const times = getSunTimes(
            new Date('2025-06-21T12:00:00Z'),
            CITIES.london.latitude,
            CITIES.london.longitude
        )
        expectCloseTo(times.sunrise, '2025-06-21T03:43:00Z')
        expectCloseTo(times.sunset, '2025-06-21T20:21:00Z')
    })

    it('orders sunrise before solar noon before sunset', () => {
        const times = getSunTimes(
            new Date('2026-04-10T12:00:00Z'),
            CITIES.newYork.latitude,
            CITIES.newYork.longitude
        )
        expect(times.sunrise.valueOf()).toBeLessThan(times.solarNoon.valueOf())
        expect(times.solarNoon.valueOf()).toBeLessThan(times.sunset.valueOf())
    })

    it('gives the equator about twelve hours of daylight at the equinox', () => {
        const times = getSunTimes(
            new Date('2026-03-20T12:00:00Z'),
            CITIES.equator.latitude,
            CITIES.equator.longitude
        )
        const daylightHours = (times.sunset - times.sunrise) / HOUR
        expect(daylightHours).toBeGreaterThan(11.9)
        expect(daylightHours).toBeLessThan(12.3)
    })

    it('gives the northern hemisphere longer days in summer than winter', () => {
        const summer = getSunTimes(
            new Date('2025-06-21T12:00:00Z'),
            CITIES.london.latitude,
            CITIES.london.longitude
        )
        const winter = getSunTimes(
            new Date('2025-12-21T12:00:00Z'),
            CITIES.london.latitude,
            CITIES.london.longitude
        )
        expect(summer.sunset - summer.sunrise).toBeGreaterThan(
            winter.sunset - winter.sunrise
        )
    })

    it('inverts the seasons in the southern hemisphere', () => {
        const june = getSunTimes(
            new Date('2025-06-21T00:00:00Z'),
            CITIES.sydney.latitude,
            CITIES.sydney.longitude
        )
        const december = getSunTimes(
            new Date('2025-12-21T00:00:00Z'),
            CITIES.sydney.latitude,
            CITIES.sydney.longitude
        )
        expect(december.sunset - december.sunrise).toBeGreaterThan(
            june.sunset - june.sunrise
        )
    })

    it('reports midnight sun above the arctic circle in june', () => {
        const times = getSunTimes(
            new Date('2025-06-21T12:00:00Z'),
            CITIES.longyearbyen.latitude,
            CITIES.longyearbyen.longitude
        )
        expect(times.polar).toBe('day')
        expect(times.sunrise).toBeNull()
        expect(times.sunset).toBeNull()
    })

    it('reports polar night above the arctic circle in december', () => {
        const times = getSunTimes(
            new Date('2025-12-21T12:00:00Z'),
            CITIES.longyearbyen.latitude,
            CITIES.longyearbyen.longitude
        )
        expect(times.polar).toBe('night')
        expect(times.sunrise).toBeNull()
        expect(times.sunset).toBeNull()
    })

    it('stays finite at the poles', () => {
        for (const latitude of [90, -90]) {
            const times = getSunTimes(
                new Date('2025-06-21T12:00:00Z'),
                latitude,
                0
            )
            expect(times.polar).not.toBeNull()
            expect(Number.isNaN(times.solarNoon.valueOf())).toBe(false)
        }
    })
})

describe('getSunState', () => {
    const { latitude, longitude } = CITIES.newYork

    it('reports day with a sunset ahead at local noon', () => {
        const state = getSunState(
            new Date('2026-08-02T16:00:00Z'),
            latitude,
            longitude
        )
        expect(state.phase).toBe('day')
        expect(state.nextEvent.kind).toBe('sunset')
        expect(state.remainingMs).toBeGreaterThan(0)
        expect(state.progress).toBeGreaterThan(0)
        expect(state.progress).toBeLessThan(1)
    })

    it('puts progress near the middle of the day at solar noon', () => {
        const times = getSunTimes(
            new Date('2026-08-02T16:00:00Z'),
            latitude,
            longitude
        )
        const state = getSunState(times.solarNoon, latitude, longitude)
        expect(state.progress).toBeGreaterThan(0.45)
        expect(state.progress).toBeLessThan(0.55)
    })

    it('spans sunrise to sunset during the day', () => {
        const state = getSunState(
            new Date('2026-08-02T16:00:00Z'),
            latitude,
            longitude
        )
        expect(state.spanStart).toEqual(state.sunrise)
        expect(state.spanEnd).toEqual(state.sunset)
    })

    it('spans the previous sunset to the next sunrise after dusk', () => {
        const state = getSunState(
            new Date('2026-08-03T03:00:00Z'),
            latitude,
            longitude
        )
        // The night began at last evening's sunset, not tomorrow's.
        expectCloseTo(state.spanStart, '2026-08-03T00:10:00Z')
        expectCloseTo(state.spanEnd, '2026-08-03T09:54:00Z')
        expect(state.spanStart.valueOf()).toBeLessThan(state.spanEnd.valueOf())
    })

    it('spans yesterday evening to this morning before dawn', () => {
        const state = getSunState(
            new Date('2026-08-02T07:00:00Z'),
            latitude,
            longitude
        )
        expectCloseTo(state.spanStart, '2026-08-02T00:11:00Z')
        expectCloseTo(state.spanEnd, '2026-08-02T09:53:00Z')
    })

    it('brackets the current moment with the active span', () => {
        for (let hour = 0; hour < 24; hour++) {
            const at = new Date(Date.UTC(2026, 7, 2, hour))
            const state = getSunState(at, latitude, longitude)
            expect(state.spanStart.valueOf()).toBeLessThanOrEqual(at.valueOf())
            expect(state.spanEnd.valueOf()).toBeGreaterThanOrEqual(at.valueOf())
        }
    })

    it('reports night before dawn, counting toward this morning', () => {
        const state = getSunState(
            new Date('2026-08-02T07:00:00Z'),
            latitude,
            longitude
        )
        expect(state.phase).toBe('night')
        expect(state.nextEvent.kind).toBe('sunrise')
        expectCloseTo(state.nextEvent.at, '2026-08-02T09:53:00Z')
    })

    it('reports night after dusk, counting toward tomorrow morning', () => {
        const state = getSunState(
            new Date('2026-08-03T03:00:00Z'),
            latitude,
            longitude
        )
        expect(state.phase).toBe('night')
        expect(state.nextEvent.kind).toBe('sunrise')
        expectCloseTo(state.nextEvent.at, '2026-08-03T09:54:00Z')
    })

    it('advances progress monotonically through the day', () => {
        const samples = [
            '2026-08-02T11:00:00Z',
            '2026-08-02T14:00:00Z',
            '2026-08-02T18:00:00Z',
            '2026-08-02T22:00:00Z',
        ].map(
            (iso) => getSunState(new Date(iso), latitude, longitude).progress
        )
        for (let i = 1; i < samples.length; i++) {
            expect(samples[i]).toBeGreaterThan(samples[i - 1])
        }
    })

    it('keeps progress within bounds across a full day of samples', () => {
        for (let hour = 0; hour < 24; hour++) {
            const at = new Date(Date.UTC(2026, 7, 2, hour))
            const state = getSunState(at, latitude, longitude)
            expect(state.progress).toBeGreaterThanOrEqual(0)
            expect(state.progress).toBeLessThanOrEqual(1)
        }
    })

    it('reports polar day with no progress to track', () => {
        const state = getSunState(
            new Date('2025-06-21T12:00:00Z'),
            CITIES.longyearbyen.latitude,
            CITIES.longyearbyen.longitude
        )
        expect(state.phase).toBe('polar-day')
        expect(state.progress).toBeNull()
        expect(state.nextEvent).toBeNull()
    })

    it('reports polar night with no progress to track', () => {
        const state = getSunState(
            new Date('2025-12-21T12:00:00Z'),
            CITIES.longyearbyen.latitude,
            CITIES.longyearbyen.longitude
        )
        expect(state.phase).toBe('polar-night')
        expect(state.progress).toBeNull()
    })
})

describe('getSolarAltitude', () => {
    const { latitude, longitude } = CITIES.newYork

    // The sun's altitude at solar noon is 90 - |latitude - declination|, which
    // pins the arc's apex to the real sky rather than a fixed drawing height.
    it('peaks at the geometric noon altitude at the solstices', () => {
        const summer = getSunTimes(
            new Date('2026-06-21T16:00:00Z'),
            latitude,
            longitude
        )
        const winter = getSunTimes(
            new Date('2026-12-21T17:00:00Z'),
            latitude,
            longitude
        )
        expect(
            getSolarAltitude(summer.solarNoon, latitude, longitude)
        ).toBeCloseTo(90 - Math.abs(latitude - 23.44), 0)
        expect(
            getSolarAltitude(winter.solarNoon, latitude, longitude)
        ).toBeCloseTo(90 - Math.abs(latitude + 23.44), 0)
    })

    it('sits at the horizon at sunrise and sunset', () => {
        const times = getSunTimes(
            new Date('2026-08-02T16:00:00Z'),
            latitude,
            longitude
        )
        for (const at of [times.sunrise, times.sunset]) {
            expect(
                Math.abs(getSolarAltitude(at, latitude, longitude))
            ).toBeLessThan(1.5)
        }
    })

    it('reaches overhead at the equator on the equinox', () => {
        const times = getSunTimes(new Date('2026-03-20T12:00:00Z'), 0, 0)
        expect(getSolarAltitude(times.solarNoon, 0, 0)).toBeGreaterThan(89)
    })

    it('goes below the horizon in the middle of the night', () => {
        const altitude = getSolarAltitude(
            new Date('2026-08-02T06:00:00Z'),
            latitude,
            longitude
        )
        expect(altitude).toBeLessThan(-10)
    })

    it('stays within physical bounds all year', () => {
        for (let day = 0; day < 365; day += 7) {
            const at = new Date(Date.UTC(2026, 0, 1 + day, 12))
            const altitude = getSolarAltitude(at, latitude, longitude)
            expect(altitude).toBeGreaterThanOrEqual(-90)
            expect(altitude).toBeLessThanOrEqual(90)
        }
    })
})

describe('getTwilightTimes', () => {
    const { latitude, longitude } = CITIES.newYork
    const probe = new Date('2026-08-02T16:00:00Z')

    it('nests the three twilights around sunrise and sunset', () => {
        const times = getSunTimes(probe, latitude, longitude)
        const twilight = getTwilightTimes(probe, latitude, longitude)

        const ordered = [
            twilight.astronomical.dawn,
            twilight.nautical.dawn,
            twilight.civil.dawn,
            times.sunrise,
            times.sunset,
            twilight.civil.dusk,
            twilight.nautical.dusk,
            twilight.astronomical.dusk,
        ]
        for (let i = 1; i < ordered.length; i++) {
            expect(ordered[i].valueOf()).toBeGreaterThan(
                ordered[i - 1].valueOf()
            )
        }
    })

    it('crosses each boundary at its own altitude', () => {
        const twilight = getTwilightTimes(probe, latitude, longitude)
        for (const [name, degrees] of Object.entries(TWILIGHT_ALTITUDES)) {
            for (const at of [twilight[name].dawn, twilight[name].dusk]) {
                expect(
                    getSolarAltitude(at, latitude, longitude),
                    `${name} boundary`
                ).toBeCloseTo(degrees, 0)
            }
        }
    })

    it('leaves boundaries null where the sun never sinks that far', () => {
        // Reykjavik in midsummer: the sun dips just below the horizon but
        // never past civil twilight, so those boundaries do not exist.
        const twilight = getTwilightTimes(
            new Date('2025-06-21T12:00:00Z'),
            64.15,
            -21.94
        )
        expect(twilight.civil.dawn).toBeNull()
        expect(twilight.nautical.dawn).toBeNull()
        expect(twilight.astronomical.dawn).toBeNull()
    })
})

describe('formatDuration', () => {
    it('formats hours and padded minutes', () => {
        expect(formatDuration(13 * HOUR + 52 * MINUTE)).toBe('13h 52m')
        expect(formatDuration(3 * HOUR + 5 * MINUTE)).toBe('3h 05m')
    })

    it('drops the hour part below an hour', () => {
        expect(formatDuration(48 * MINUTE)).toBe('48m')
    })

    it('clamps negative durations to zero', () => {
        expect(formatDuration(-5 * MINUTE)).toBe('0m')
    })
})
