import { describe, it, expect } from 'vitest'
import {
    getMoonIllumination,
    getMoonPhaseName,
    getMoonPosition,
} from './moon-position.js'

const DAY = 86400000
const HOUR = 3600000

const NEW_YORK = { latitude: 40.71, longitude: -74.01 }

// Mean length of one new-moon-to-new-moon cycle, in days.
const SYNODIC_MONTH = 29.530588

// A well-known new moon, used as the origin for the cycle assertions below.
const NEW_MOON = new Date('2000-01-06T18:14:00Z')

function daysAfterNewMoon(days) {
    return new Date(NEW_MOON.valueOf() + days * DAY)
}

// Phase wraps, so a value just under 1 is as close to new as one just over 0.
function distanceFromNew(phase) {
    return Math.min(phase, 1 - phase)
}

describe('getMoonIllumination', () => {
    it('reports a dark disc at a known new moon', () => {
        const moon = getMoonIllumination(NEW_MOON)
        expect(moon.fraction).toBeLessThan(0.01)
        expect(distanceFromNew(moon.phase)).toBeLessThan(0.02)
    })

    it('reports a lit disc half a synodic month later', () => {
        const moon = getMoonIllumination(daysAfterNewMoon(SYNODIC_MONTH / 2))
        expect(moon.fraction).toBeGreaterThan(0.98)
    })

    it('reports a half-lit waxing disc at the first quarter', () => {
        const moon = getMoonIllumination(daysAfterNewMoon(7.38))
        expect(moon.fraction).toBeGreaterThan(0.45)
        expect(moon.fraction).toBeLessThan(0.55)
        expect(moon.waxing).toBe(true)
    })

    it('reports a half-lit waning disc at the last quarter', () => {
        const moon = getMoonIllumination(daysAfterNewMoon(22.1))
        expect(moon.fraction).toBeGreaterThan(0.45)
        expect(moon.fraction).toBeLessThan(0.55)
        expect(moon.waxing).toBe(false)
    })

    it('comes back around to new after one synodic month', () => {
        const moon = getMoonIllumination(daysAfterNewMoon(SYNODIC_MONTH))
        expect(moon.fraction).toBeLessThan(0.02)
    })

    it('names the phase either side of full consistently with waxing', () => {
        const waxing = getMoonIllumination(daysAfterNewMoon(11))
        const waning = getMoonIllumination(daysAfterNewMoon(18))
        expect(waxing.waxing).toBe(true)
        expect(getMoonPhaseName(waxing.phase)).toBe('waxing gibbous')
        expect(waning.waxing).toBe(false)
        expect(getMoonPhaseName(waning.phase)).toBe('waning gibbous')
    })

    it('keeps fraction and phase in range across a full year of samples', () => {
        for (let hour = 0; hour < 365 * 24; hour += 6) {
            const at = new Date(Date.UTC(2026, 0, 1) + hour * 3600000)
            const moon = getMoonIllumination(at)
            expect(moon.fraction).toBeGreaterThanOrEqual(0)
            expect(moon.fraction).toBeLessThanOrEqual(1)
            expect(moon.phase).toBeGreaterThanOrEqual(0)
            expect(moon.phase).toBeLessThan(1)
        }
    })

    it('grows the lit fraction every day from new moon to full', () => {
        let previous = -1
        for (let day = 0; day <= 14; day++) {
            const { fraction } = getMoonIllumination(daysAfterNewMoon(day))
            expect(fraction).toBeGreaterThan(previous)
            previous = fraction
        }
    })
})

describe('getMoonPosition', () => {
    const { latitude, longitude } = NEW_YORK

    // A month of three-hourly samples, enough to cover every phase of the
    // moon's daily arc at every point in its orbit.
    function sampleMonth() {
        const samples = []
        for (let hour = 0; hour < 30 * 24; hour += 3) {
            const at = new Date(Date.UTC(2026, 0, 1) + hour * HOUR)
            samples.push(getMoonPosition(at, latitude, longitude))
        }
        return samples
    }

    it('keeps altitude within the horizon-to-zenith range', () => {
        for (const { altitude } of sampleMonth()) {
            expect(altitude).toBeGreaterThanOrEqual(-90)
            expect(altitude).toBeLessThanOrEqual(90)
        }
    })

    it('puts the moon above the horizon about half the time', () => {
        const samples = sampleMonth()
        const above = samples.filter((p) => p.altitude > 0).length
        const share = above / samples.length
        expect(share).toBeGreaterThan(0.35)
        expect(share).toBeLessThan(0.65)
    })

    it('keeps azimuth on the compass', () => {
        for (const { azimuth } of sampleMonth()) {
            expect(azimuth).toBeGreaterThanOrEqual(0)
            expect(azimuth).toBeLessThan(360)
        }
    })

    it('keeps distance within the real orbital range', () => {
        for (const { distance } of sampleMonth()) {
            expect(distance).toBeGreaterThan(350000)
            expect(distance).toBeLessThan(410000)
        }
    })

    it('moves altitude smoothly from hour to hour', () => {
        let previous = null
        for (let hour = 0; hour < 24; hour++) {
            const at = new Date(Date.UTC(2026, 7, 2) + hour * HOUR)
            const { altitude } = getMoonPosition(at, latitude, longitude)
            if (previous !== null) {
                expect(Math.abs(altitude - previous)).toBeLessThan(20)
            }
            previous = altitude
        }
    })

    it('puts the moon due south when it is highest, seen from new york', () => {
        let highest = null
        for (let minute = 0; minute < 1440; minute++) {
            const at = new Date(Date.UTC(2026, 7, 2) + minute * 60000)
            const position = getMoonPosition(at, latitude, longitude)
            if (!highest || position.altitude > highest.altitude) {
                highest = position
            }
        }
        // Culmination happens on the meridian, which is south of any observer
        // north of the moon's declination.
        expect(Math.abs(highest.azimuth - 180)).toBeLessThan(5)
    })

    it('stays finite at the poles', () => {
        for (const pole of [90, -90]) {
            const position = getMoonPosition(
                new Date('2026-08-02T12:00:00Z'),
                pole,
                0
            )
            expect(Number.isNaN(position.altitude)).toBe(false)
            expect(Number.isNaN(position.azimuth)).toBe(false)
        }
    })
})

describe('getMoonPhaseName', () => {
    it('names the four exact phases', () => {
        expect(getMoonPhaseName(0)).toBe('new moon')
        expect(getMoonPhaseName(0.25)).toBe('first quarter')
        expect(getMoonPhaseName(0.5)).toBe('full moon')
        expect(getMoonPhaseName(0.75)).toBe('last quarter')
    })

    it('names the crescent and gibbous bands between them', () => {
        expect(getMoonPhaseName(0.125)).toBe('waxing crescent')
        expect(getMoonPhaseName(0.375)).toBe('waxing gibbous')
        expect(getMoonPhaseName(0.625)).toBe('waning gibbous')
        expect(getMoonPhaseName(0.875)).toBe('waning crescent')
    })

    it('treats the end of the cycle as new moon too', () => {
        expect(getMoonPhaseName(0.999)).toBe('new moon')
    })

    it('stays all lowercase for the tui text', () => {
        for (let phase = 0; phase < 1; phase += 0.01) {
            const name = getMoonPhaseName(phase)
            expect(name).toBe(name.toLowerCase())
        }
    })
})
