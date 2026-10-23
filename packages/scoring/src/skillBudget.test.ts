import { describe, expect, test } from 'vitest';
import { recommend, recommendAsync, simulateRequest, type Candidate, type CandidateList, type LineageHorse, type OwnedVersion, type SkillCost } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, runner: horse, samples: 20, seed: 7 };
const apt = { turf: 7, dirt: 1, short: 1, mile: 1, middle: 7, long: 1, nige: 1, senko: 7, sashi: 1, oikomi: 1 };
const none: CandidateList = { candidates: [] };

// What the Ace gains from each skill alone, about: 10071 0.43, 10091 0.39, 200011 0.03 lengths; the gold 200014 and its white 200012 more and less.
const costs: Record<string, SkillCost> = {
	'10071': { cost: 300, group: 1 },
	'200011': { cost: 100, group: 2 },
	'10091': { cost: 250, group: 3 },
	'200012': { cost: 90, group: 20001 },
	'200014': { cost: 130, group: 20001, replacesId: '200012' },
};

function version(learnableSkillIds: string[], candidates: Candidate[] = [], cardId = 1): OwnedVersion {
	return { cardId, aptitudes: apt, learnableSkillIds, candidates };
}
function scoreOf(v: OwnedVersion, budget?: number): number {
	return recommend(none, { ...preset, skillPoints: budget === undefined ? undefined : { budget, costs } }, undefined, [v]).aceSlots[0].score;
}
function horseOf(skills: string[], affinity = 1e6): LineageHorse {
	return { affinity, pinkStars: 0, dirtStars: 0, skills: skills.map((skillId) => ({ skillId, name: skillId, stars: 3 })) };
}
// Every spark procs at both inspirations, so every skill is hinted at level 5 (40% off).
function sure(id: string, ...skills: string[]): Candidate {
	return { id, name: id, horses: [horseOf(skills), horseOf([]), horseOf([])] };
}

describe('Skill point budget', () => {
	test('a cleared budget is the unlimited result', () => {
		const v = version(['10071', '200011']);
		expect(recommend(none, { ...preset, skillPoints: undefined }, undefined, [v])).toEqual(recommend(none, preset, undefined, [v]));
	});
	test('a budget that buys everything equals the unlimited result', () => {
		const v = version(['10071', '200011', '10091']);
		expect(scoreOf(v, 1e6)).toBe(scoreOf(v));
		expect(scoreOf(v)).toBeGreaterThan(0);
	});
	test('a budget too small for any skill scores like an Ace with nothing to buy', () => {
		const v = version(['10071', '200011', '10091']);
		expect(scoreOf(v, 89)).toBe(scoreOf(version([]), 89));
		expect(scoreOf(v, 89)).toBe(0);
		const unique = { ...v, uniqueSkillId: '10071' };
		expect(scoreOf(unique, 89)).toBe(scoreOf({ ...version([]), uniqueSkillId: '10071' }));
		expect(scoreOf(unique, 89)).toBeGreaterThan(0);
	});
	test('a skill with no cost is never bought', () => {
		expect(scoreOf(version(['10071', '99999']), 1e6)).toBe(scoreOf(version(['10071']), 1e6));
		const free = { ...costs };
		delete free['10071'];
		const out = recommend(none, { ...preset, skillPoints: { budget: 1e6, costs: free } }, undefined, [version(['10071'])]);
		expect(out.aceSlots[0].score).toBe(0);
	});
	test('under a tight budget an Ace with cheaper skills outranks one with a pricier, otherwise better, set', () => {
		const pricey = version(['10071'], [], 1); // 300 SP
		const cheap = version(['200011'], [], 2); // 100 SP, worth less
		const rank = (budget?: number) => recommend(none, { ...preset, skillPoints: budget === undefined ? undefined : { budget, costs } }, undefined, [pricey, cheap]).aceSlots.map((s) => s.cardId);
		expect(rank()).toEqual([1, 2]);
		expect(rank(150)).toEqual([2, 1]);
	});
	test('the budget picks the set with the most lengths for it', () => {
		const v = version(['10071', '10091', '200011']);
		expect(scoreOf(v, 550)).toBe(scoreOf(version(['10071', '10091']))); // 300 + 250
		expect(scoreOf(v, 300)).toBe(scoreOf(version(['10071']))); // the best single
		expect(scoreOf(v, 250)).toBe(scoreOf(version(['10091']))); // 250 SP: 10091, not the cheap 200011
	});
	test('a gold skill is bought with its white only when the budget covers both, never instead of the white alone', () => {
		const v = version(['200012', '200014']);
		const whiteOnly = scoreOf(version(['200012']));
		const bundle = scoreOf(v);
		expect(bundle).toBeGreaterThan(whiteOnly);
		expect(scoreOf(v, 220)).toBe(bundle); // 90 + 130
		expect(scoreOf(v, 219)).toBe(whiteOnly); // the white alone is what fits
		expect(scoreOf(v, 89)).toBe(0);
	});
	test('a gold skill is a bundle even when the card list has only the gold', () => {
		const gold = version(['200014']);
		expect(scoreOf(gold, 220)).toBe(scoreOf(version(['200012', '200014'])));
		expect(scoreOf(gold, 219)).toBe(0);
	});
	test('same seed and budget give the same result, also through the worker batches', async () => {
		const v = [version(['10071', '10081', '10091'], [sure('p', '10091'), sure('q', '200011')])];
		const p = { ...preset, skillPoints: { budget: 400, costs } };
		const a = recommend(none, p, undefined, v);
		expect(recommend(none, p, undefined, v)).toEqual(a);
		const batched = await recommendAsync(async (batch) => batch.requests.map((r) => simulateRequest(r, batch.scenario)), none, p, undefined, v);
		expect(batched).toEqual(a);
	});
	test('the Ace veteran and the loops ignore the budget', () => {
		const list: CandidateList = { candidates: [sure('a', '10071'), sure('b', '10081')] };
		const v = [version(['10071', '10081'], list.candidates)];
		const free = recommend(list, preset, { S10071: 'T0' }, v);
		const tight = recommend(list, { ...preset, skillPoints: { budget: 100, costs } }, { S10071: 'T0' }, v);
		expect({ ...tight, aceSlots: 0 }).toEqual({ ...free, aceSlots: 0 });
	});

	describe('bought share', () => {
		const boughtOf = (v: OwnedVersion, budget?: number) => Object.fromEntries(recommend(none, { ...preset, skillPoints: budget === undefined ? undefined : { budget, costs } }, undefined, [v]).aceSlots[0].skills.map((r) => [r.skillId, r.bought]));
		test('a skill the Ace can always afford is bought in every run', () => {
			const b = boughtOf(version(['10071', '200011']), 1e6);
			expect(b['10071']).toBe(1);
			expect(b['200011']).toBe(1);
		});
		test('a skill the data gives no cost shows no share, not a 0', () => {
			const priced = { ...costs };
			delete priced['200011'];
			const row = recommend(none, { ...preset, skillPoints: { budget: 1e6, costs: priced } }, undefined, [version(['10071', '200011'])]).aceSlots[0].skills;
			expect(row.find((r) => r.skillId === '200011')?.bought).toBeUndefined();
			expect(row.find((r) => r.skillId === '10071')?.bought).toBe(1);
		});
		test('a skill the budget never covers is bought in no run', () => {
			const b = boughtOf(version(['10071', '10091']), 280);
			expect(b['10071']).toBe(0);
			expect(b['10091']).toBe(1);
		});
		test('hint rolls decide the share: a lineage hint discounts a skill into the budget, and its inherit chance stays', () => {
			// 10091 costs 250 against a budget of 240: only a run whose spark procced (a hint, 10% off or more) can buy it.
			// The pink sparks draw first, so consecutive run seeds roll the skill spark independently.
			const hinted: Candidate = { id: 'h', name: 'h', horses: [{ ...horseOf(['10091'], 200), pinkStars: 3 }, horseOf([]), horseOf([])] };
			const row = recommend(none, { ...preset, skillPoints: { budget: 240, costs } }, undefined, [version(['10091'], [hinted, sure('o')])]).aceSlots[0].skills.find((r) => r.skillId === '10091');
			expect(row?.bought).toBeGreaterThan(0);
			expect(row?.bought).toBeLessThan(1);
			expect(row?.inherit).toBeGreaterThan(0);
			expect(row?.inherit).toBeLessThan(1);
		});
		test('a skill that is only inherited carries no bought share', () => {
			const hinted: Candidate = { id: 'h', name: 'h', horses: [horseOf(['10091']), horseOf([]), horseOf([])] };
			const row = recommend(none, { ...preset, skillPoints: { budget: 1e6, costs } }, undefined, [version(['10071'], [hinted])]).aceSlots[0].skills.find((r) => r.skillId === '10091');
			expect(row).toBeDefined();
			expect(row?.bought).toBeUndefined();
		});
		test('without a budget the rows carry no bought share', () => {
			expect(boughtOf(version(['10071', '200011']))['10071']).toBeUndefined();
		});
		test('the share survives the worker batches', async () => {
			const v = [version(['10071', '200011'])];
			const p = { ...preset, skillPoints: { budget: 350, costs } };
			const batched = await recommendAsync(async (batch) => batch.requests.map((r) => simulateRequest(r, batch.scenario)), none, p, undefined, v);
			expect(batched).toEqual(recommend(none, p, undefined, v));
			expect(batched.aceSlots[0].skills.find((r) => r.skillId === '10071')?.bought).toBe(1);
		});
	});
	describe('white unique skills from a parent', () => {
		const PULSE = '900061';
		const withPulse: Record<string, SkillCost> = { ...costs, [PULSE]: { cost: 200, group: 90006 } };
		const unique = (certain: boolean, stars = 3) => ({ skillId: PULSE, name: 'Triumphant Pulse', stars, certain });
		const rowsOf = (horses: LineageHorse[], budget?: number, v = version(['10071'], [{ id: 'o', name: 'o', horses }])) =>
			recommend(none, { ...preset, skillPoints: budget === undefined ? undefined : { budget, costs: withPulse } }, undefined, [v]).aceSlots[0].skills.find((r) => r.skillId === PULSE);
		test('a parent makes it buyable with certainty: an inherited row, not an Other buyable skill', () => {
			const row = rowsOf([{ ...horseOf([]), unique: unique(true) }, horseOf([]), horseOf([])], 1e6);
			expect(row?.inherit).toBe(1);
			expect(row?.other).toBeUndefined();
			expect(row?.bought).toBe(1);
		});
		// The pink spark draws first, so consecutive run seeds roll the green spark independently.
		test('a grandparent gives it only at the inheritance proc chance, per run', () => {
			const row = rowsOf([horseOf([]), { ...horseOf([], 50), pinkStars: 3, unique: unique(false, 2) }, horseOf([])], 1e6);
			expect(row?.inherit).toBeGreaterThan(0);
			expect(row?.inherit).toBeLessThan(1);
			expect(row?.bought).toBeGreaterThan(0);
			expect(row?.bought).toBeLessThan(1);
		});
		test('with no parent carrying it, the Ace cannot buy it', () => {
			expect(rowsOf([horseOf([]), horseOf([]), horseOf([])], 1e6)).toBeUndefined();
		});
		test('without a budget the parent-granted one is bought like every Buyable skill', () => {
			const withIt = scoreOf(version(['10071'], [{ id: 'o', name: 'o', horses: [{ ...horseOf([]), unique: unique(true) }, horseOf([]), horseOf([])] }]));
			expect(withIt).toBeGreaterThan(scoreOf(version(['10071'], [sure('o')])));
		});
	});
});
