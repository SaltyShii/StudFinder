import { expect, it } from 'vitest';
import { AXIS, distanceAxis } from './trackAxis';

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
