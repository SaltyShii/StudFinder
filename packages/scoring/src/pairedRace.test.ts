import { expect, test } from 'vitest';
import { pairedRace } from './pairedRace';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const s = { horse, courseId: 10101, samples: 20 };

test('one run per sample, activated when the skill procs', () => {
	const runs = pairedRace(['10071'], s);
	expect(runs).toHaveLength(20);
	expect(runs.some((r) => r.activated && r.lengths > 0)).toBe(true);
});

test('no skills never activate and gain nothing', () => {
	expect(pairedRace([], s).every((r) => !r.activated && r.lengths === 0)).toBe(true);
});

test('same inputs give the same result', () => {
	expect(pairedRace(['10071'], s)).toEqual(pairedRace(['10071'], s));
});
