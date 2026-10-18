import { expect, test } from 'vitest';
import { recommend, type Roster } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, ace: horse, samples: 5, seed: 7 };
const SKILL = '200012';
const roster: Roster = {
	outfits: [
		{ id: 'plain', name: 'Plain', owned: false, skillIds: [SKILL] },
		{ id: 'pink', name: 'Pink', owned: false, skillIds: [SKILL], pinkSparks: 3 },
		{ id: 'affine', name: 'Affine', owned: false, skillIds: [SKILL], pinkSparks: 3, affinity: 100 },
		{ id: 'empty', name: 'Empty', owned: true, skillIds: [] },
	],
};

test('CM pink spark raises side score; affinity raises it further', () => {
	const by = Object.fromEntries(recommend(roster, preset).side.map((p) => [p.outfitId, p]));
	expect(by.pink.score).toBeGreaterThan(by.plain.score);
	expect(by.affine.score).toBeGreaterThan(by.pink.score);
	expect(by.empty.score).toBe(0);
});

test('skills are valued by sim, details exposed', () => {
	const { side } = recommend(roster, preset);
	expect(side[0].detail.length).toBe(1);
	expect(side[0].reason).toMatch(/pink/);
});
