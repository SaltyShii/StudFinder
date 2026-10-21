import { expect, test } from 'vitest';
import { pairedRace, pairedRaces, type Scenario } from './pairedRace';
import { assumesPosition } from './skillDetail';
import { DEFAULT_ASSUMPTIONS, type SimAssumptions } from './assumptions';

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

test('an activated run reports where the skill fired and how long its effect lasted', () => {
	const runs = pairedRace(['210051'], s); // phase_random==0: a random spot in the opening phase
	const hit = runs.filter((r) => r.activated);
	expect(hit.length).toBeGreaterThan(0);
	for (const r of hit) {
		expect(r.spot!.pos).toBeGreaterThan(0);
		expect(r.spot!.end).toBeGreaterThan(r.spot!.pos);
		expect(r.spot!.duration).toBeGreaterThan(0);
	}
	expect(runs.filter((r) => !r.activated).every((r) => r.spot === undefined)).toBe(true);
});

test('an unknown course id is named, not a sim TypeError', () => {
	expect(() => pairedRace([], { ...s, courseId: -1 })).toThrow('Unknown course id -1');
});

const RATES_100 = { runaway: 100, frontRunner: 100, paceChaser: 100, lateSurger: 100, endCloser: 100 };
function withA(patch: Partial<SimAssumptions>, base: Scenario = s, skill = '10071') {
	return pairedRace([skill], { ...base, assumptions: { ...DEFAULT_ASSUMPTIONS, ...patch } });
}

test('no assumptions given means the defaults', () => {
	expect(pairedRace(['10071'], s)).toEqual(withA({}));
});

// Each assumption only shows in a paired race through the part of the sim it drives, so each case picks a runner and skill that exercise it.
const weak = { ...horse, stamina: 450, wisdom: 100 }; // rushes often and runs short of HP
const front = { ...horse, strategy: 'Nige' as const };
test.each([
	['rushed', weak, '10071'],
	['witCheck', weak, '200342'], // a white skill, which a wit check can fail
	['laneMovement', horse, '200491'], // a lane movement skill
	['spotStruggle', front, '10071'],
] as const)('switching %s changes what the races produce', (key, h, skill) => {
	const base = { ...s, samples: 30, horse: h };
	expect(withA({ [key]: !DEFAULT_ASSUMPTIONS[key] }, base, skill)).not.toEqual(withA({}, base, skill));
});

test('dueling changes the races of a front runner', () => {
	const base = { ...s, horse: front };
	expect(withA({ dueling: true, duelingRates: RATES_100 }, base)).not.toEqual(withA({ dueling: false }, base));
});

test('dueling rates are ignored while dueling is off', () => {
	expect(withA({ dueling: false, duelingRates: RATES_100 })).toEqual(withA({ dueling: false }));
});

// Skills of every kind: self-only ('10071', '210051'), the order-reading '10081' and a set of all of them.
const sets = [['10071'], ['210051'], ['10081'], ['10071', '210051', '10081'], []];

test.each(['Senkou', 'Sasi', 'Oikomi'])('%s: a shared skill-less run gives the very runs of pairedRace', (strategy) => {
	const sc = { ...s, horse: { ...horse, strategy } };
	expect(pairedRaces(sets, sc, assumesPosition)).toEqual(sets.map((ids) => pairedRace(ids, sc)));
});

test('front runners and order-reading skills are raced as before, so they too match pairedRace', () => {
	const front = { ...s, horse: { ...horse, strategy: 'Nige' } };
	expect(pairedRaces(sets, front, assumesPosition)).toEqual(sets.map((ids) => pairedRace(ids, front)));
	expect(pairedRaces(sets, s, () => true)).toEqual(sets.map((ids) => pairedRace(ids, s)));
});

test('front runners share the skill-less run once spot struggle is off, with the very runs of pairedRace', () => {
	const front = { ...s, horse: { ...horse, strategy: 'Nige' }, assumptions: { ...DEFAULT_ASSUMPTIONS, spotStruggle: false } };
	expect(pairedRaces(sets, front, assumesPosition)).toEqual(sets.map((ids) => pairedRace(ids, front)));
});
