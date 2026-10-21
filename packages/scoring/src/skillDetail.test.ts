import { expect, test } from 'vitest';
import { assumesPosition, skillDetail } from './skillDetail';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;

test('skillDetail combines skill value with the position flag', () => {
	const d = skillDetail('10071', { courseId: 10101, horse, samples: 20, seed: 7 });
	expect(d.skillId).toBe('10071');
	expect(d.proc).toBeGreaterThan(0);
	expect(d.assumesPosition).toBe(true);
	// The density covers the course and holds every activation.
	expect(d.density.bins.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
	expect(d.density.bins.length * d.density.binWidth).toBeGreaterThanOrEqual(1000);
});

test('an id the sim has no data for assumes nothing', () => {
	expect(assumesPosition('0')).toBe(false);
});
