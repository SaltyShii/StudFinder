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

test('all modes credit only what other owned outfits lack', () => {
	const r: Roster = {
		outfits: [
			{ id: 'own', name: 'Own', owned: true, skillIds: ['10071'], whiteSparks: ['Ramp Up'] },
			{ id: 'dup', name: 'Dup', owned: false, skillIds: ['10071'], whiteSparks: ['Ramp Up'] },
			{ id: 'new', name: 'New', owned: false, skillIds: ['10071', '10081'], whiteSparks: ['Ramp Up', 'Uma Stan'] },
		],
	};
	const rec = recommend(r, { ...preset, tierList: { 'Ramp Up': 'T2', 'Uma Stan': 'T0' } });
	for (const mode of [rec.ace, rec.side]) {
		const by = Object.fromEntries(mode.map((p) => [p.outfitId, p]));
		expect(by.dup.detail).toEqual([]);
		expect(by.new.detail.map((d) => d.skillId)).toEqual(['10081']);
	}
	const core = Object.fromEntries(rec.core.map((p) => [p.outfitId, p.score]));
	expect(core.dup).toBe(0);
	expect(core.new).toBeCloseTo(1); // only Uma Stan (T0) is new
});

test('same seed and samples give identical output', () => {
	expect(recommend(roster, preset)).toEqual(recommend(roster, preset));
});
