import { expect, test } from 'vitest';
import { GameData } from '../../lineage/src/gameData';
import type { RawGameData, Veteran } from '../../lineage/src/types';
import { candidatePool } from './candidatePool';
import { recommend } from './recommend';

const card = (id: number, runningStyle = 1, skillIds: number[] = []) => ({ id, charaId: id, name: `N${id}`, title: 'T', runningStyle, skillIds });
const data = new GameData({
	meta: {}, charas: {}, skills: {}, factors: {}, saddles: {}, tracks: {}, courses: {}, races: [],
	cards: { 1: card(1), 2: card(2, 4, [10071]) },
	relations: { points: {}, members: {}, ranks: [] },
} as unknown as RawGameData);
const owned = [{ cardId: 1 } as Veteran];

test('pool is every Global card, owned ones marked', () => {
	expect(candidatePool(data, owned).map((o) => [o.id, o.owned])).toEqual([['1', true], ['2', false]]);
});

test('hard-to-train unowned outfit is still listed first when it scores high', () => {
	const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
	const { ace } = recommend({ outfits: candidatePool(data, owned) }, { courseId: 10101, ace: horse, samples: 30, seed: 7 });
	expect(ace[0]).toMatchObject({ outfitId: '2', owned: false });
});

const fx = (id: number, groupId: number, type: number, stars: number, name = '') => ({ id, groupId, type, stars, name, targets: [], skillId: null });
const vdata = new GameData({
	meta: {}, charas: {}, skills: {}, saddles: {}, tracks: {}, courses: {}, races: [],
	cards: { 1: card(1), 2: card(2), 100: card(100) },
	factors: { 1: fx(1, 21, 2, 3), 2: fx(2, 12, 2, 2), 3: fx(3, 4001, 4, 1, 'Straightaway Recovery'), 4: fx(4, 21, 2, 1) },
	// Direct 100+1 is 5+4 (both groups); the grandparent trio adds 4.
	relations: { points: { 7: 5, 8: 4 }, members: { 7: [100, 1], 8: [100, 1, 3] }, ranks: [] },
} as unknown as RawGameData);
const vet = (cardId: number, factorIds: number[], gp = false) =>
	({ cardId, charaId: cardId, factorIds, winSaddleIds: [], rankScore: 0, parents: [gp ? { cardId: 3, charaId: 3, factorIds: [], winSaddleIds: [] } : null, null] }) as unknown as Veteran;
const opts = { aceCardId: 100, pinkGroupId: 21 };

test('owned outfit takes sparks and affinity from its best Veteran', () => {
	const weak = vet(1, [4]);
	const best = vet(1, [1, 2, 3], true);
	for (const vets of [[weak, best], [best, weak]]) {
		const o = candidatePool(vdata, vets, opts).find((x) => x.id === '1')!;
		expect(o).toMatchObject({ pinkSparks: 3, affinity: 13, whiteSparks: ['Straightaway Recovery'], dirtSparks: 2 });
	}
});

test('unowned outfits carry no spark data', () => {
	const o = candidatePool(vdata, [vet(1, [1])], opts).find((x) => x.id === '2')!;
	expect(o.pinkSparks).toBeUndefined();
	expect(o.affinity).toBeUndefined();
	expect(o.whiteSparks).toBeUndefined();
	expect(o.dirtSparks).toBeUndefined();
});

test('core and side loop score the owned outfit from its Veteran sparks', () => {
	const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
	const run = (vets: Veteran[]) => recommend({ outfits: candidatePool(vdata, vets, opts) }, { courseId: 10101, ace: horse, samples: 5, seed: 1 }, { 'Straightaway Recovery': 'T0' });
	const bare = run([vet(1, [])]);
	const rich = run([vet(1, [1, 2, 3], true)]);
	expect(bare.core.find((p) => p.outfitId === '1')!.score).toBeLessThan(rich.core.find((p) => p.outfitId === '1')!.score);
	expect(bare.side.find((p) => p.outfitId === '1')!.score).toBeLessThan(rich.side.find((p) => p.outfitId === '1')!.score);
});
