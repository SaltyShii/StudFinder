import { expect, test } from 'vitest';
import { recommend, type Candidate, type LineageHorse, type CandidateList } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, ace: horse, samples: 5, seed: 7 };
const spark = (name: string) => ({ skillId: '0', name, stars: 3 });
const horseOf = (o: Partial<LineageHorse> = {}): LineageHorse => ({ affinity: 0, pinkStars: 0, dirtStars: 1, skills: [], ...o });
const cand = (id: string, ...horses: LineageHorse[]): Candidate => ({ id, name: id, horses });
const roster: CandidateList = {
	candidates: [
		cand('low', horseOf({ skills: [spark('Ramp Up')] })),
		cand('high', horseOf({ skills: [spark('Uma Stan'), spark('Ramp Up')] })),
		cand('dirt', horseOf({ dirtStars: 3 })),
		cand('nodirt', horseOf({ dirtStars: 0, skills: [spark('Uma Stan')] })),
		// the parents of a candidate are beyond the Ace's lineage, so their sparks do not count
		cand('parents', horseOf(), horseOf({ skills: [spark('Uma Stan')] })),
	],
};
const tierList = { 'Uma Stan': 'T0', 'Ramp Up': 'T2' } as const;

test('core loop ranks by tier-list sparks and requires a dirt spark', () => {
	const { core } = recommend(roster, preset, tierList);
	const by = Object.fromEntries(core.map((p) => [p.candidateId, p]));
	expect(core[0].candidateId).toBe('high');
	expect(by.high.score).toBeGreaterThan(by.low.score);
	expect(by.dirt.reason).toMatch(/3 dirt/);
	expect(by.dirt.score).toBe(0); // dirt gates, it adds no score
	expect(by.high.reason).toMatch(/Uma Stan/);
	expect(by.nodirt).toBeUndefined(); // no dirt spark: not a great-grandparent
	expect(by.parents.score).toBe(0);
});

test('no tier list means no core picks', () => {
	expect(recommend(roster, preset).core).toEqual([]);
});
