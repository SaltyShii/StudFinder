import { expect, test } from 'vitest';
import { recommend, type Roster } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, ace: horse, samples: 5, seed: 7 };
const roster: Roster = {
	outfits: [
		{ id: 'low', name: 'Low', owned: true, skillIds: [], whiteSparks: ['Ramp Up'] },
		{ id: 'high', name: 'High', owned: true, skillIds: [], whiteSparks: ['Uma Stan', 'Ramp Up'] },
		{ id: 'dirt', name: 'Dirt', owned: false, skillIds: [], dirtSparks: 3 },
		{ id: 'blue', name: 'Blue', owned: true, skillIds: [], blueSparks: 9 } as Roster['outfits'][number],
	],
};
const tierList = { 'Uma Stan': 'T0', 'Ramp Up': 'T2' } as const;

test('core loop ranks by tier-list sparks, credits dirt, ignores blue', () => {
	const { core } = recommend(roster, preset, tierList);
	const by = Object.fromEntries(core.map((p) => [p.outfitId, p]));
	expect(core[0].outfitId).toBe('high');
	expect(by.high.score).toBeGreaterThan(by.low.score);
	expect(by.dirt.score).toBeGreaterThan(0);
	expect(by.blue.score).toBe(0);
	expect(by.high.reason).toMatch(/Uma Stan/);
});

test('no tier list means no core picks', () => {
	expect(recommend(roster, preset).core).toEqual([]);
});
