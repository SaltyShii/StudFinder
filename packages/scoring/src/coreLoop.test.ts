import { expect, test } from 'vitest';
import { recommend, type Candidate, type LineageHorse, type CandidateList } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, runner: horse, samples: 5, seed: 7 };
function spark(name: string) { return { skillId: '0', name, stars: 3 }; }
function horseOf(o: Partial<LineageHorse> = {}): LineageHorse { return { affinity: 0, pinkStars: 0, dirtStars: 1, skills: [], ...o }; }
function cand(id: string, ...horses: LineageHorse[]): Candidate { return { id, name: id, horses }; }
const candidateList: CandidateList = {
	candidates: [
		cand('low', horseOf({ skills: [spark('Ramp Up')] })),
		cand('high', horseOf({ skills: [spark('Uma Stan'), spark('Ramp Up')] })),
		cand('dirt', horseOf({ dirtStars: 3 })),
		cand('nodirt', horseOf({ dirtStars: 0, skills: [spark('Uma Stan')] })),
		// the candidate's own two parents count: the lineage is the candidate plus its parents
		cand('parents', horseOf(), horseOf({ skills: [spark('Uma Stan')] })),
	],
};
const tierList = { 'Uma Stan': 'T0', 'Ramp Up': 'T2' } as const;

test('core loop ranks by tier-list sparks and requires a dirt spark', () => {
	const { core } = recommend(candidateList, preset, tierList);
	const by = Object.fromEntries(core.map((p) => [p.candidateId, p]));
	expect(core[0].candidateId).toBe('high');
	expect(by.high.score).toBeGreaterThan(by.low.score);
	expect(by.dirt.reason).toMatch(/3 dirt/);
	expect(by.dirt.score).toBe(0); // dirt gates, it adds no score
	expect(by.high.reason).toMatch(/Uma Stan/);
	expect(by.nodirt).toBeUndefined(); // no dirt spark: not a great-grandparent
	// marginal: 'high' already supplies Uma Stan, so check the parents alone
	expect(recommend({ candidates: [candidateList.candidates[4]] }, preset, tierList).core[0].score).toBeGreaterThan(0);
});

test('no tier list means no core picks', () => {
	expect(recommend(candidateList, preset).core).toEqual([]);
});

test('core loop prefers full-dirt lineages and falls back to partial dirt only without one', () => {
	const full = cand('full', horseOf(), horseOf(), horseOf());
	const partial = cand('partial', horseOf(), horseOf({ dirtStars: 0 }), horseOf({ dirtStars: 0 }));
	const ids = (cs: Candidate[]) => recommend({ candidates: cs }, preset, tierList).core.map((p) => p.candidateId);
	expect(ids([full, partial])).toEqual(['full']);
	expect(ids([partial])).toEqual(['partial']);
});

test('core loop drops sparks of skills the Ace already has', () => {
	const owned = { ...preset, runner: { ...horse, skills: ['0'] } };
	expect(recommend(candidateList, owned, tierList).core.every((p) => p.score === 0)).toBe(true);
});
