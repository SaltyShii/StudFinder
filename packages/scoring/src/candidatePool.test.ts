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
