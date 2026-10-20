import { expect, test } from 'vitest';
import { GameData } from '../../lineage/src/gameData';
import type { RawGameData, Veteran } from '../../lineage/src/types';
import { candidatesOf, pinkGroupOf } from './candidates';
import { recommend } from './recommend';

function card(id: number, title = 'T') { return { id, charaId: id, name: `N${id}`, title, runningStyle: 1, skillIds: [] }; }
function fx(id: number, groupId: number, type: number, stars: number, name = '', skillId: number | null = null) { return { id, groupId, type, stars, name, targets: [], skillId }; }
const data = new GameData({
	meta: {}, charas: {}, skills: {}, saddles: {}, tracks: {}, courses: {}, races: [],
	cards: { 1: card(1), 2: card(2), 3: card(3), 100: card(100) },
	factors: { 1: fx(1, 21, 2, 3), 2: fx(2, 12, 2, 2), 3: fx(3, 4001, 4, 1, 'Straightaway Recovery', 200012), 4: fx(4, 21, 2, 1), 5: fx(5, 4002, 4, 2, 'Other Spark', 200013) },
	// Direct 100+1 is 5+4 (both groups); the grandparent trio adds 4.
	relations: { points: { 7: 5, 8: 4 }, members: { 7: [100, 1], 8: [100, 1, 3] }, ranks: [] },
} as unknown as RawGameData);
function gp(cardId: number, factorIds: number[]) { return { cardId, charaId: cardId, factorIds, winSaddleIds: [] }; }
function vet(trainedId: number, cardId: number, factorIds: number[], parents: Veteran['parents'] = [null, null]) {
	return ({ trainedId, cardId, charaId: cardId, factorIds, winSaddleIds: [], rankScore: 100 + trainedId, createdAt: '2026-01-01', parents }) as unknown as Veteran;
}
const opts = { aceCardId: 100, pinkGroupId: 21 };

test('every veteran is a candidate, labelled with what tells its runs apart; the Ace version is not', () => {
	const c = candidatesOf(data, [vet(10, 1, []), vet(11, 1, []), vet(12, 100, [])], opts);
	expect(c.map((x) => x.id)).toEqual(['10', '11']);
	expect(c[0].name).toBe('T N1 (Rank score 110, created 2026-01-01)');
});

test('a veteran brings itself and its parents, each with its own sparks and affinity', () => {
	const [c] = candidatesOf(data, [vet(10, 1, [1, 2, 3], [gp(3, [5, 4]), null])], opts);
	expect(c.horses).toHaveLength(2); // a missing parent brings nothing
	expect(c.horses[0]).toMatchObject({ pinkStars: 3, dirtStars: 2, skills: [{ skillId: '200012', name: 'Straightaway Recovery', stars: 1 }] });
	expect(c.horses[0].affinity).toBe(13); // direct 9 plus the trio through the grandparent
	expect(c.horses[1]).toMatchObject({ pinkStars: 1, skills: [{ skillId: '200013', stars: 2 }] });
	expect(c.horses[1].affinity).toBe(4);
});

test('a veteran with no parents or sparks is still a candidate with one empty horse', () => {
	const [c] = candidatesOf(data, [vet(10, 1, [])], opts);
	expect(c.horses).toEqual([{ cardId: 1, affinity: 9, pinkStars: 0, dirtStars: 0, skills: [] }]);
});

test('core and side loop score a veteran from its own and its parents sparks', () => {
	const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
	const run = (v: Veteran) => recommend({ candidates: candidatesOf(data, [v], opts) }, { courseId: 10101, runner: horse, samples: 5, seed: 1 }, { 'Straightaway Recovery': 'T0' });
	const bare = run(vet(10, 1, []));
	const rich = run(vet(10, 1, [1, 2, 3], [gp(3, [5]), null]));
	expect(bare.core).toEqual([]); // no dirt spark: not a great-grandparent
	expect(rich.core[0].score).toBeGreaterThan(0);
	expect(bare.side[0].score).toBeLessThan(rich.side[0].score);
});

test('a borrowed veteran is a candidate labelled with its owner, not a rank score', () => {
	const rental = { ...vet(-1, 1, [3]), rankScore: 0, borrowed: { trainerId: '777', source: 'export', seenAt: '' } } as Veteran;
	const [c] = candidatesOf(data, [rental], opts);
	expect(c.id).toBe('-1');
	expect(c.name).toBe('T N1 (borrowed from 777)');
	expect(c.horses[0].skills).toHaveLength(1);
});

test('pinkGroupOf maps a course distance to its distance pink group', () => {
	expect(pinkGroupOf(2000)).toBe(33);
});
