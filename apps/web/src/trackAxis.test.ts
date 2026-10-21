import { expect, it } from 'vitest';
import { AXIS, coverSpans, cornerNumber, courseTitle, distanceAxis, rulerTicks } from './trackAxis';

it('maps the course start and finish to the ends of the axis and clamps outside it', () => {
	const a = distanceAxis(2000);
	expect(a.x(0)).toBe(AXIS.left);
	expect(a.x(2000)).toBe(AXIS.left + AXIS.width);
	expect(a.x(1000)).toBe(AXIS.left + AXIS.width / 2);
	expect(a.x(-5)).toBe(a.x(0));
	expect(a.x(9999)).toBe(a.x(2000));
	expect(a.span(500, 1500)).toBe(AXIS.width / 2);
	expect(a.ticks).toEqual([0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000]);
});

it('tiles the track with fillers, numbers corners from the last one, and names the course', () => {
	expect(coverSpans([{ start: 100, end: 200 }, { start: 300, end: 400 }], 500).map((c) => [c.start, c.end, c.item !== null])).toEqual([[0, 100, false], [100, 200, true], [200, 300, false], [300, 400, true], [400, 500, false]]);
	expect([0, 1].map((i) => cornerNumber(i, 2))).toEqual([3, 4]);
	expect([0, 1, 2, 3, 4, 5].map((i) => cornerNumber(i, 6))).toEqual([3, 4, 1, 2, 3, 4]);
	expect(rulerTicks(1200).length).toBe(13);
	expect(rulerTicks(2400)[1]).toBe(200);
	expect(courseTitle({ trackId: 10006, distance: 1600, ground: 2, turn: 2 }, new Map([[10006, 'Tokyo']]))).toBe('Tokyo 1600m dirt (left-handed)');
	expect(courseTitle({ trackId: 1, distance: 2000, ground: 1, turn: 4 }, new Map())).toBe('2000m turf (straight)');
});
