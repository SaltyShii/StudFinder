import { expect, test } from 'vitest';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { trackOverview } from './trackOverview';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2, skills: ['10071'] } as HorseDesc;
const COURSE = 10101;

test('describes the course on one distance axis', () => {
	const t = trackOverview({ courseId: COURSE, horse });
	expect(t.distance).toBeGreaterThan(0);
	expect(t.phases.map((p) => p.phase)).toEqual([0, 1, 2, 3]);
	expect(t.phases[0].start).toBe(0);
	expect(t.phases[3].end).toBe(t.distance);
	expect(t.sections).toHaveLength(24);
	expect(t.sections[23].end).toBe(t.distance);
	expect(t.straights.length + t.corners.length).toBeGreaterThan(0);
});

test('the baseline curve is a speed curve without skills, from the start dash to the finish', () => {
	const t = trackOverview({ courseId: COURSE, horse });
	const first = t.curve[0];
	const last = t.curve[t.curve.length - 1];
	expect(first.pos).toBe(0);
	expect(last.pos).toBeGreaterThanOrEqual(t.distance - 20);
	expect(t.curve.every((p, i) => i === 0 || p.pos >= t.curve[i - 1].pos)).toBe(true);
	// Accelerates from the start, and the last spurt is faster than the middle of the race.
	const at = (frac: number) => t.curve.find((p) => p.pos >= t.distance * frac)!.speed;
	expect(at(0.1)).toBeGreaterThan(first.speed);
	expect(at(0.95)).toBeGreaterThan(at(0.5));
	// The skill is not part of the baseline.
	expect(trackOverview({ courseId: COURSE, horse: { ...horse, skills: [] } }).curve).toEqual(t.curve);
});

test('an unknown course is reported', () => {
	expect(() => trackOverview({ courseId: -1, horse })).toThrow(/Unknown course/);
});
