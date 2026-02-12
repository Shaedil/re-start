import { describe, it, expect } from 'vitest'
import {
    getEventDurationMinutes,
    getTimelineBounds,
    getMinuteOfDay,
    layoutEvents,
    PX_PER_HOUR,
} from '../utils/calendar-helpers.js'

describe('getEventDurationMinutes', () => {
    it('returns 0 for all-day events', () => {
        const event = {
            start: '2026-02-12',
            end: '2026-02-13',
            allDay: true,
        }
        expect(getEventDurationMinutes(event)).toBe(0)
    })

    it('returns 0 for multi-day all-day events', () => {
        const event = {
            start: '2026-02-12',
            end: '2026-02-15',
            allDay: true,
        }
        expect(getEventDurationMinutes(event)).toBe(0)
    })

    it('computes 60 minutes for a 1-hour event', () => {
        const event = {
            start: '2026-02-12T10:00:00-05:00',
            end: '2026-02-12T11:00:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(60)
    })

    it('computes 30 minutes for a half-hour event', () => {
        const event = {
            start: '2026-02-12T14:00:00-05:00',
            end: '2026-02-12T14:30:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(30)
    })

    it('computes 15 minutes for a short event', () => {
        const event = {
            start: '2026-02-12T09:00:00+00:00',
            end: '2026-02-12T09:15:00+00:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(15)
    })

    it('computes 120 minutes for a 2-hour event', () => {
        const event = {
            start: '2026-02-12T08:00:00-05:00',
            end: '2026-02-12T10:00:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(120)
    })

    it('handles events spanning midnight', () => {
        const event = {
            start: '2026-02-12T23:00:00-05:00',
            end: '2026-02-13T01:00:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(120)
    })

    it('handles events with different timezone offsets in start and end', () => {
        // Start in UTC, end in UTC -- 90 minutes apart
        const event = {
            start: '2026-02-12T10:00:00Z',
            end: '2026-02-12T11:30:00Z',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(90)
    })

    it('returns 0 for a zero-duration timed event', () => {
        const event = {
            start: '2026-02-12T10:00:00-05:00',
            end: '2026-02-12T10:00:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(0)
    })

    it('returns non-negative value even if end is before start', () => {
        // Edge case: malformed data where end < start
        const event = {
            start: '2026-02-12T11:00:00-05:00',
            end: '2026-02-12T10:00:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBeGreaterThanOrEqual(0)
    })

    it('computes correct duration for a long event (8 hours)', () => {
        const event = {
            start: '2026-02-12T09:00:00-05:00',
            end: '2026-02-12T17:00:00-05:00',
            allDay: false,
        }
        expect(getEventDurationMinutes(event)).toBe(480)
    })
})

describe('PX_PER_HOUR', () => {
    it('is 40', () => {
        expect(PX_PER_HOUR).toBe(40)
    })
})

describe('getTimelineBounds', () => {
    it('returns default bounds for empty array', () => {
        expect(getTimelineBounds([])).toEqual({ startHour: 8, endHour: 18 })
    })

    it('returns correct bounds for a single event 10am-11am', () => {
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false },
        ]
        expect(getTimelineBounds(events)).toEqual({ startHour: 10, endHour: 11 })
    })

    it('returns correct bounds for events 9am-10am and 2pm-3pm', () => {
        const events = [
            { start: '2026-02-12T09:00:00-05:00', end: '2026-02-12T10:00:00-05:00', allDay: false },
            { start: '2026-02-12T14:00:00-05:00', end: '2026-02-12T15:00:00-05:00', allDay: false },
        ]
        expect(getTimelineBounds(events)).toEqual({ startHour: 9, endHour: 15 })
    })

    it('returns default bounds when only all-day events are present', () => {
        const events = [
            { start: '2026-02-12', end: '2026-02-13', allDay: true },
            { start: '2026-02-12', end: '2026-02-14', allDay: true },
        ]
        expect(getTimelineBounds(events)).toEqual({ startHour: 8, endHour: 18 })
    })

    it('floors the start hour and ceils the end hour for mid-hour events', () => {
        const events = [
            { start: '2026-02-12T09:30:00-05:00', end: '2026-02-12T11:15:00-05:00', allDay: false },
        ]
        expect(getTimelineBounds(events)).toEqual({ startHour: 9, endHour: 12 })
    })

    it('skips all-day events and uses timed events for bounds', () => {
        const events = [
            { start: '2026-02-12', end: '2026-02-13', allDay: true },
            { start: '2026-02-12T13:00:00-05:00', end: '2026-02-12T14:00:00-05:00', allDay: false },
        ]
        expect(getTimelineBounds(events)).toEqual({ startHour: 13, endHour: 14 })
    })

    it('handles event ending exactly on the hour without rounding up', () => {
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T12:00:00-05:00', allDay: false },
        ]
        expect(getTimelineBounds(events)).toEqual({ startHour: 10, endHour: 12 })
    })
})

describe('getMinuteOfDay', () => {
    it('returns 0 for midnight', () => {
        expect(getMinuteOfDay('2026-02-12T00:00:00-05:00')).toBe(0)
    })

    it('returns 870 for 2:30pm (14*60 + 30)', () => {
        expect(getMinuteOfDay('2026-02-12T14:30:00-05:00')).toBe(870)
    })

    it('returns 720 for noon (12*60)', () => {
        expect(getMinuteOfDay('2026-02-12T12:00:00-05:00')).toBe(720)
    })

    it('returns 60 for 1:00am', () => {
        expect(getMinuteOfDay('2026-02-12T01:00:00-05:00')).toBe(60)
    })

    it('returns 1439 for 23:59', () => {
        expect(getMinuteOfDay('2026-02-12T23:59:00-05:00')).toBe(1439)
    })
})

describe('layoutEvents', () => {
    it('returns empty array for empty input', () => {
        expect(layoutEvents([])).toEqual([])
    })

    it('assigns column 0 and totalColumns 1 for non-overlapping sequential events', () => {
        const events = [
            { start: '2026-02-12T09:00:00-05:00', end: '2026-02-12T10:00:00-05:00', allDay: false, title: 'A' },
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'B' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual({ event: events[0], column: 0, totalColumns: 1 })
        expect(result[1]).toEqual({ event: events[1], column: 0, totalColumns: 1 })
    })

    it('assigns two columns for two fully overlapping events', () => {
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'A' },
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'B' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual({ event: events[0], column: 0, totalColumns: 2 })
        expect(result[1]).toEqual({ event: events[1], column: 1, totalColumns: 2 })
    })

    it('assigns two columns for partially overlapping events', () => {
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'A' },
            { start: '2026-02-12T10:30:00-05:00', end: '2026-02-12T11:30:00-05:00', allDay: false, title: 'B' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual({ event: events[0], column: 0, totalColumns: 2 })
        expect(result[1]).toEqual({ event: events[1], column: 1, totalColumns: 2 })
    })

    it('assigns three columns for three overlapping events', () => {
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'A' },
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'B' },
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'C' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(3)
        expect(result[0]).toEqual({ event: events[0], column: 0, totalColumns: 3 })
        expect(result[1]).toEqual({ event: events[1], column: 1, totalColumns: 3 })
        expect(result[2]).toEqual({ event: events[2], column: 2, totalColumns: 3 })
    })

    it('handles a mix of overlapping and non-overlapping events', () => {
        const events = [
            { start: '2026-02-12T09:00:00-05:00', end: '2026-02-12T10:00:00-05:00', allDay: false, title: 'A' },
            { start: '2026-02-12T09:30:00-05:00', end: '2026-02-12T10:30:00-05:00', allDay: false, title: 'B' },
            { start: '2026-02-12T14:00:00-05:00', end: '2026-02-12T15:00:00-05:00', allDay: false, title: 'C' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(3)
        // First two overlap -> columns 0 and 1, totalColumns 2
        expect(result[0]).toEqual({ event: events[0], column: 0, totalColumns: 2 })
        expect(result[1]).toEqual({ event: events[1], column: 1, totalColumns: 2 })
        // Third doesn't overlap -> column 0, totalColumns 1
        expect(result[2]).toEqual({ event: events[2], column: 0, totalColumns: 1 })
    })

    it('handles single event', () => {
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T11:00:00-05:00', allDay: false, title: 'A' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ event: events[0], column: 0, totalColumns: 1 })
    })

    it('reuses columns for non-concurrent events within an overlap group', () => {
        // Long event spans entire period, shorter events can share columns
        const events = [
            { start: '2026-02-12T10:00:00-05:00', end: '2026-02-12T17:00:00-05:00', allDay: false, title: 'Long' },
            { start: '2026-02-12T11:00:00-05:00', end: '2026-02-12T12:00:00-05:00', allDay: false, title: 'Early' },
            { start: '2026-02-12T15:00:00-05:00', end: '2026-02-12T16:00:00-05:00', allDay: false, title: 'Late' },
        ]
        const result = layoutEvents(events)
        expect(result).toHaveLength(3)
        // Long takes col 0
        expect(result[0].column).toBe(0)
        // Early takes col 1
        expect(result[1].column).toBe(1)
        // Late reuses col 1 (15:00 >= 12:00)
        expect(result[2].column).toBe(1)
        // Only 2 columns needed, not 3
        expect(result[0].totalColumns).toBe(2)
        expect(result[1].totalColumns).toBe(2)
        expect(result[2].totalColumns).toBe(2)
    })
})
