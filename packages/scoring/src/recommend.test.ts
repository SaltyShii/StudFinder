import { expect, test } from 'vitest';
import { recommend, type Roster } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, horse, samples: 30, seed: 7 };
const roster: Roster = {
	outfits: [
		{ id: 'a', name: 'Alpha', owned: true, skillIds: ['10071'], pinkSparks: 3 },
		{ id: 'b', name: 'Beta', owned: false, skillIds: [] },
		{ id: 'c', name: 'Gamma', owned: false, skillIds: ['10071', '10071'] },
	],
};

test('Ace ranks outfits by inherited skill value, ignoring pink sparks', () => {
	const { ace } = recommend(roster, preset);
	expect(ace[0].outfitId).toBe('a');
	expect(ace.map((p) => p.outfitId)).toContain('b');
	expect(ace[0].score).toBeGreaterThan(ace[ace.length - 1].score);
	expect(ace[0].reason).toMatch(/lengths/);
	const d = ace[0].detail[0];
	expect(d.proc).toBeGreaterThan(0);
	expect(d.lengths.max).toBeGreaterThanOrEqual(d.lengths.min);
	expect(d.assumesPosition).toBe(true); // 10071 has order_rate in its condition
});

test('same seed and samples give identical output', () => {
	expect(recommend(roster, preset)).toEqual(recommend(roster, preset));
});
