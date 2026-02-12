/**
 * Compute the duration of a calendar event in minutes.
 * Returns 0 for all-day events (they have no meaningful timed duration for the bar).
 * @param {{ start: string, end: string, allDay: boolean }} event
 * @returns {number} duration in minutes (0 for all-day events)
 */
export function getEventDurationMinutes(event) {
    if (event.allDay) return 0

    const startMs = new Date(event.start).getTime()
    const endMs = new Date(event.end).getTime()
    const diffMinutes = Math.abs(endMs - startMs) / (1000 * 60)

    return diffMinutes
}

export const PX_PER_HOUR = 40

/**
 * Compute the timeline bounds (start/end hours) from a list of events.
 * Returns { startHour, endHour } where startHour is the floor of the earliest
 * event start and endHour is the ceil of the latest event end.
 * For all-day events, skip them in the calculation.
 * If no timed events, return { startHour: 8, endHour: 18 } as default.
 * @param {Array} events
 * @returns {{ startHour: number, endHour: number }}
 */
export function getTimelineBounds(events) {
    const timedEvents = events.filter(e => !e.allDay)

    if (timedEvents.length === 0) {
        return { startHour: 8, endHour: 18 }
    }

    let earliestMinute = Infinity
    let latestMinute = -Infinity

    for (const event of timedEvents) {
        const startMin = getMinuteOfDay(event.start)
        const endMin = getMinuteOfDay(event.end)
        if (startMin < earliestMinute) earliestMinute = startMin
        if (endMin > latestMinute) latestMinute = endMin
    }

    const startHour = Math.floor(earliestMinute / 60)
    const endHour = latestMinute % 60 === 0
        ? latestMinute / 60
        : Math.ceil(latestMinute / 60)

    return { startHour, endHour }
}

/**
 * Get the minute-of-day for a datetime string.
 * e.g., "2026-02-12T14:30:00-05:00" -> 870 (14*60 + 30)
 * @param {string} dateString - ISO datetime string
 * @returns {number} minutes since midnight in local time
 */
export function getMinuteOfDay(dateString) {
    const date = new Date(dateString)
    return date.getHours() * 60 + date.getMinutes()
}

/**
 * Detect overlapping events and assign column positions.
 * Returns an array of { event, column, totalColumns } objects.
 * Events overlap when their time ranges intersect.
 * Within an overlap group, events are assigned columns 0, 1, 2, etc.
 * @param {Array} events - sorted by start time
 * @returns {Array<{ event: object, column: number, totalColumns: number }>}
 */
export function layoutEvents(events) {
    if (events.length === 0) return []

    // Build overlap groups: connected components of overlapping events
    // Each group is a list of event indices
    const groups = []
    let currentGroup = [0]
    let groupEnd = new Date(events[0].end).getTime()

    for (let i = 1; i < events.length; i++) {
        const eventStart = new Date(events[i].start).getTime()
        if (eventStart < groupEnd) {
            // Overlaps with the current group
            currentGroup.push(i)
            const eventEnd = new Date(events[i].end).getTime()
            if (eventEnd > groupEnd) groupEnd = eventEnd
        } else {
            // No overlap, start new group
            groups.push(currentGroup)
            currentGroup = [i]
            groupEnd = new Date(events[i].end).getTime()
        }
    }
    groups.push(currentGroup)

    // Greedy column assignment within each group:
    // Place each event in the first column where it doesn't overlap
    const result = new Array(events.length)

    for (const group of groups) {
        const columns = [] // each column tracks the end time of its last placed event

        for (const idx of group) {
            const eventStart = new Date(events[idx].start).getTime()
            const eventEnd = new Date(events[idx].end).getTime()

            let placed = false
            for (let col = 0; col < columns.length; col++) {
                if (eventStart >= columns[col]) {
                    columns[col] = eventEnd
                    result[idx] = { event: events[idx], column: col, totalColumns: 0 }
                    placed = true
                    break
                }
            }

            if (!placed) {
                result[idx] = { event: events[idx], column: columns.length, totalColumns: 0 }
                columns.push(eventEnd)
            }
        }

        const totalColumns = columns.length
        for (const idx of group) {
            result[idx].totalColumns = totalColumns
        }
    }

    return result
}
