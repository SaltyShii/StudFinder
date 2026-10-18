import { expect, test } from 'vitest';
import { findOptimalSpurt } from '@stud-finder/sim/src/SpurtCalculator';

test('spurt candidates start at max speed on a 0.1 grid, capped at 100', () => {
	const c = findOptimalSpurt(5000, 1500, 2000, 17, 20, 17, 1, 1);
	const speeds = c.map((x) => x.speed);
	expect(speeds).toContain(20);
	for (const s of speeds) expect(Math.round((20 - s) * 10) / 10).toBeCloseTo(20 - s, 6);
	expect(speeds.length).toBeLessThanOrEqual(100);
});
