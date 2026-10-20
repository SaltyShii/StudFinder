import { expect, test } from 'vitest';
import { rushedChance, spotStruggleDuration } from '@stud-finder/sim/src/RaceSolver';
import { Aptitude } from '@stud-finder/sim/src/HorseTypes';

test('spot struggle duration scales with strategy proficiency', () => {
	const base = Math.sqrt(700 * 400) * 0.012;
	expect(spotStruggleDuration(400, Aptitude.A)).toBeCloseTo(base, 9);
	expect(spotStruggleDuration(400, Aptitude.S)).toBeCloseTo(base * 1.1, 9);
	expect(spotStruggleDuration(400, Aptitude.C)).toBeCloseTo(base * 0.75, 9);
});

test('rushed chance rounds up to a whole percent before self-control', () => {
	const raw = (6.5 / Math.log10(0.1 * 600 + 1)) ** 2;
	expect(raw % 1).not.toBe(0);
	expect(rushedChance(600, false)).toBeCloseTo(Math.ceil(raw) / 100, 9);
	expect(rushedChance(600, true)).toBeCloseTo(Math.ceil(raw) / 100 - 0.03, 9);
});
