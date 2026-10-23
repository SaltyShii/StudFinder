import { describe, expect, test } from 'vitest';
import { rollSparks, rolls, wholeAceMean, wholeAceRuns, type WholeAceInput } from './wholeAce';
import type { LineageHorse } from './shared';

function horse(over: Partial<LineageHorse> = {}): LineageHorse {
	return { affinity: 0, pinkStars: 0, dirtStars: 0, skills: [], ...over };
}
const apt = { distance: 4, surface: 7 };

describe('rolls', () => {
	test('a 0-chance spark never procs and a certain one always does', () => {
		expect(rolls(0, () => 0)).toBe(false); // the lowest draw there is
		expect(rolls(1, () => 0.999999)).toBe(true);
	});
});

describe('rollSparks', () => {
	const hs = [horse({ affinity: 80, pinkStars: 2, skills: [{ skillId: '10071', name: 'a', stars: 1 }, { skillId: '200342', name: 'b', stars: 1 }] }), horse({ affinity: 30, pinkStars: 1, skills: [{ skillId: '10071', name: 'a', stars: 2 }] })];
	test('same seed gives the same roll', () => {
		expect(rollSparks(hs, apt, 'turf', 5)).toEqual(rollSparks(hs, apt, 'turf', 5));
	});
	test('different seeds differ', () => {
		const bySeed = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(rollSparks(hs, apt, 'turf', i))));
		expect(bySeed.size).toBeGreaterThan(1);
	});
	test('a certain skill spark always procs, once, even carried twice', () => {
		const sure = [horse({ affinity: 1e6, skills: [{ skillId: '10071', name: 'a', stars: 3 }] }), horse({ affinity: 1e6, skills: [{ skillId: '10071', name: 'a', stars: 3 }] })];
		for (let seed = 0; seed < 10; seed++) expect(rollSparks(sure, apt, 'turf', seed).skillIds).toEqual(['10071']);
	});
	test('the Hint level of a skill adds the stars of its procs up, capped at 5', () => {
		const star = (n: number) => horse({ affinity: 1e6, skills: [{ skillId: '10071', name: 'a', stars: n }] });
		expect(rollSparks([star(1)], apt, 'turf', 1).hints).toEqual({ '10071': 2 }); // 1 star at each of 2 inspirations
		expect(rollSparks([star(1), star(2)], apt, 'turf', 1).hints).toEqual({ '10071': 5 }); // 2 + 4 = 6, capped
		expect(rollSparks([horse({ affinity: 1e6, skills: [{ skillId: '10071', name: 'a', stars: 3 }] })], apt, 'turf', 1).hints).toEqual({ '10071': 5 });
	});
	test('no sparks change nothing', () => {
		for (let seed = 0; seed < 10; seed++) expect(rollSparks([horse()], apt, 'turf', seed)).toEqual({ distance: 4, surface: 7, skillIds: [], hints: {}, unlocked: [] });
	});
	test('certain pink sparks lift a grade to S mid-run', () => {
		const sure = [horse({ affinity: 1e6, pinkStars: 3, turfStars: 3 }), horse({ affinity: 1e6, pinkStars: 3, turfStars: 3 })];
		const r = rollSparks(sure, { distance: 7, surface: 7 }, 'turf', 1);
		expect(r.distance).toBe(8);
		expect(r.surface).toBe(8);
	});
	test('the surface spark follows the course surface', () => {
		const dirty = [horse({ affinity: 1e6, dirtStars: 3 })];
		expect(rollSparks(dirty, { distance: 7, surface: 4 }, 'dirt', 1).surface).toBeGreaterThan(4);
		expect(rollSparks(dirty, { distance: 7, surface: 4 }, 'turf', 1).surface).toBe(4);
	});
});

describe('wholeAceMean', () => {
	const input: WholeAceInput = {
		aptitudes: { turf: 7, dirt: 1, short: 1, mile: 1, middle: 7, long: 1, nige: 1, senko: 7, sashi: 1, oikomi: 1 },
		style: 'senko',
		scenario: { courseId: 10101 },
		buyableSkillIds: [],
		horses: [],
		seeds: [1, 2, 3, 4, 5, 6],
	};
	const sure = (id: string) => horse({ affinity: 1e6, skills: [{ skillId: id, name: id, stars: 3 }] });

	test('same inputs give the same mean', () => {
		const i = { ...input, uniqueSkillId: '10071' };
		expect(wholeAceMean(i)).toBe(wholeAceMean(i));
	});
	test('a skill the Ace buys gains lengths; none gains nothing', () => {
		expect(wholeAceMean(input)).toBe(0);
		expect(wholeAceMean({ ...input, buyableSkillIds: ['10071'] })).toBeGreaterThan(0);
	});
	test('a skill carried by both lineages, or also bought, counts once', () => {
		const once = wholeAceMean({ ...input, horses: [sure('10071')] });
		expect(once).toBeGreaterThan(0);
		expect(wholeAceMean({ ...input, horses: [sure('10071'), sure('10071')] })).toBe(once);
		expect(wholeAceMean({ ...input, buyableSkillIds: ['10071'], horses: [sure('10071')] })).toBe(once);
	});
	test('an aptitude upgrade is worth lengths and changes what a skill is worth', () => {
		const weak = { ...input, aptitudes: { ...input.aptitudes, middle: 5 } }; // C in the distance
		const up = [horse({ affinity: 1e6, pinkStars: 3 }), horse({ affinity: 1e6, pinkStars: 3 })];
		expect(wholeAceMean({ ...weak, horses: up })).toBeGreaterThan(0);
		const skilled = { ...weak, buyableSkillIds: ['10071'] };
		expect(wholeAceMean({ ...skilled, horses: up })).not.toBe(wholeAceMean(skilled));
	});
});

describe('wholeAceRuns with a Skill point budget', () => {
	const base: WholeAceInput = {
		aptitudes: { turf: 7, dirt: 1, short: 1, mile: 1, middle: 7, long: 1, nige: 1, senko: 7, sashi: 1, oikomi: 1 },
		style: 'senko',
		scenario: { courseId: 10101 },
		buyableSkillIds: ['A', 'B', 'C'],
		horses: [],
		seeds: Array.from({ length: 30 }, (_, i) => i + 1),
	};
	// Values are lengths gained as simulated; here they are chosen so the best set is easy to read off.
	const budget = (points: number) => ({ points, costs: { A: { cost: 300, group: 1 }, B: { cost: 250, group: 2 }, C: { cost: 250, group: 3 } }, values: { A: 5, B: 3, C: 2 } });
	// A spark for B on every run: Hint level 5, 40% off.
	const hinted = [horse({ affinity: 1e6, skills: [{ skillId: 'B', name: 'B', stars: 3 }] })];
	const run = (over: Partial<WholeAceInput>) => wholeAceRuns({ ...base, ...over, buyableSkillIds: over.buyableSkillIds ?? [] });

	test('without a budget every Buyable skill is bought in every run', () => {
		expect(run({ buyableSkillIds: ['10071', '10081'] }).bought).toEqual({ '10071': 1, '10081': 1 });
	});
	test('a skill that always fits is bought in every run; one that never does, in none', () => {
		const b = { points: 300, costs: { '10071': { cost: 300, group: 1 }, '10081': { cost: 400, group: 2 } }, values: { '10071': 1, '10081': 9 } };
		expect(run({ buyableSkillIds: ['10071', '10081'], budget: b }).bought).toEqual({ '10071': 1 });
	});
	test('a hinted skill costs its discounted price: 450 SP buys A + B only when B is hinted', () => {
		expect(run({ buyableSkillIds: ['A', 'B', 'C'], budget: budget(450) }).bought).toEqual({ A: 1 });
		expect(run({ buyableSkillIds: ['A', 'B', 'C'], budget: budget(450), horses: hinted }).bought).toEqual({ A: 1, B: 1 });
	});
	test('a hinted skill off the card list becomes buyable', () => {
		expect(run({ buyableSkillIds: [], budget: budget(150), horses: hinted }).bought).toEqual({ B: 1 }); // 250 * 0.6
		expect(run({ buyableSkillIds: [], budget: budget(149), horses: hinted }).bought).toEqual({});
	});
	test('when hint rolls decide, the share of runs that bought the skill is between 0 and 1', () => {
		const maybe = [horse({ affinity: 600, skills: [{ skillId: 'B', name: 'B', stars: 3 }] })];
		const share = run({ buyableSkillIds: ['A', 'B', 'C'], budget: budget(450), horses: maybe, seeds: Array.from({ length: 200 }, (_, i) => i + 1) }).bought;
		expect(share.A).toBe(1);
		expect(share.B).toBeGreaterThan(0);
		expect(share.B).toBeLessThan(1);
	});
});
