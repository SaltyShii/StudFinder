import { expect, test } from 'vitest';
import { creditPerSecond, powerStat, releaseAccel, releaseDuration } from '@stud-finder/sim/src/ConservePower';
import { Strategy } from '@stud-finder/sim/src/HorseTypes';
import { DistanceType } from '@stud-finder/sim/src/CourseData';
import { RaceSolverBuilder } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';

test('power stat adds half the raw power above 1200 plus green skills', () => {
	expect(powerStat(1000, 1, 0)).toBe(1000);
	expect(powerStat(1400, 1, 50)).toBe(1200 + 100 + 50);
});

test('credit per second: 4.2 normal, 6.7 pace down, times the style coefficient', () => {
	expect(creditPerSecond(Strategy.Nige, false)).toBeCloseTo(4.2);
	expect(creditPerSecond(Strategy.Senkou, true)).toBeCloseTo(6.7 * 0.75);
	expect(creditPerSecond(Strategy.Oikomi, false)).toBeCloseTo(4.2 * 0.7);
});

test('release accel follows the doc formula, zero at or below 1200', () => {
	expect(releaseAccel(1300, Strategy.Sasi, DistanceType.Mid)).toBeCloseTo(Math.sqrt(100 * 130) * 0.001 * 0.875);
	expect(releaseAccel(1200, Strategy.Nige, DistanceType.Mid)).toBe(0);
});

test('release duration scales with credit and sqrt(distance)', () => {
	expect(releaseDuration(100, 2000)).toBeCloseTo((100 * Math.sqrt(2000)) / 1450);
});

const horse = { speed: 1000, stamina: 1000, power: 1400, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;

function run(withConserve: boolean) {
	const b = new RaceSolverBuilder(1).seed(1).course(10101).horse(horse).rushedKakari(false).leadCompetition(false);
	if (withConserve) b.withAsiwotameru();
	const s = b.build().next().value as RaceSolver;
	while (s.pos < 1200) s.step(1 / 15);
	return s;
}

test('solver earns credit over sections 1-10 and releases it on last spurt', () => {
	const s = run(true);
	expect(s.conservedPower).toBeGreaterThan(0);
	expect(s.conserveReleased).toBe(true);
	expect(run(false).conserveReleased).toBe(false);
});
