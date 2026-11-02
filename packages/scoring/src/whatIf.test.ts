import { describe, expect, test } from 'vitest';
import { GameData } from '@stud-finder/lineage/src/gameData';
import { FactorType, type RawGameData } from '@stud-finder/lineage/src/types';
import { affinityIfPlaced, combinedSparks, decodeTree, encodeTree, excludedCharas, parseTree, skillSparkChances, sparkSources, treeAffinity, type WhatIfTree } from './whatIf';

function card(id: number, charaId: number) {
	return { id, charaId, name: `N${id}`, title: '', aptitudes: {}, uniqueSkillId: null };
}
function factor(id: number, groupId: number, type: FactorType, stars: number, skillId: number | null = null) {
	return { id, groupId, type, stars, name: `F${groupId}`, targets: [], skillId };
}
const data = new GameData({
	meta: {}, charas: {},
	cards: { 1: card(1, 10), 2: card(2, 20), 3: card(3, 30), 4: card(4, 40), 5: card(5, 50), 6: card(6, 10) },
	skills: { 900: { id: 900, name: 'Sk' } },
	factors: { 101: factor(101, 1, FactorType.Stat, 1), 203: factor(203, 2, FactorType.Aptitude, 3), 301: factor(301, 3, FactorType.Skill, 1, 900), 303: factor(303, 3, FactorType.Skill, 3, 900) },
	// Characters 10 and 20 are related for 5; 10, 20 and 30 for 7 more (all three are in group 2).
	relations: { points: { 1: 5, 2: 7 }, members: { 1: [10, 20], 2: [10, 20, 30] }, ranks: [[1, 0, 50], [2, 51, 150], [3, 151, 999]] },
	saddles: { 8: { id: 8, name: 'G1', type: 3 }, 9: { id: 9, name: 'G2', type: 2 } },
	tracks: {}, courses: {}, races: [],
} as unknown as RawGameData);
function horse(cardId: number, factorIds: number[] = [], winSaddleIds: number[] = []) {
	return { cardId, factorIds, winSaddleIds };
}

describe('affinity', () => {
	test('an empty tree relates nothing', () => {
		const a = treeAffinity(data, {});
		expect(a.total).toBe(0);
		expect(a.slots.p1).toBe(0);
	});
	test('adds up as the recommendations do, with shared G1 wins worth 3 each', () => {
		const tree: WhatIfTree = { target: horse(1), p1: horse(2, [], [8, 9]), p1g1: horse(3, [], [8, 9]) };
		const a = treeAffinity(data, tree);
		// Trainee and parent 5 + 7 = 12; with the grandparent 7, and one G1 shared (the G2 does not count): 3.
		expect(a.slots.p1g1).toBe(10);
		expect(a.slots.p1).toBe(22);
		expect(a.total).toBe(22);
	});
	test('a candidate in a picker is valued without any wins', () => {
		expect(affinityIfPlaced(data, { target: horse(1) }, 'p1', 2)).toBe(12);
		expect(affinityIfPlaced(data, { target: horse(1) }, 'p1', 5)).toBe(0);
	});
	test('a place cannot share a character with its parent, sibling or own parents', () => {
		const tree: WhatIfTree = { target: horse(1), p1: horse(2), p2: horse(3), p1g1: horse(4) };
		expect([...excludedCharas(data, tree, 'p1')].sort()).toEqual([10, 30, 40]);
		expect([...excludedCharas(data, tree, 'p1g2')].sort()).toEqual([20, 40]);
		expect([...excludedCharas(data, tree, 'p2g1')]).toEqual([30]);
	});
});

describe('spark odds', () => {
	// With the trainee and parent 12 affinity for the parent's own sparks.
	const tree: WhatIfTree = { target: horse(1), p1: horse(2, [101, 203]), p2: horse(4, [303]), p2g1: horse(5, [301]) };
	const sources = sparkSources(data, tree);
	test('rolls each source with its own affinity, twice a career', () => {
		const pink = sources.find((s) => s.factorId === 203)!;
		expect(pink.affinity).toBe(12);
		expect(pink.perInspiration).toBeCloseTo(0.05 * 1.12);
		expect(pink.perRun).toBeCloseTo(1 - (1 - 0.05 * 1.12) ** 2);
		expect(sources[0].factorId).toBe(101); // blue sparks are the likeliest
	});
	test('combines by spark without adding the stars of different horses', () => {
		const skill = combinedSparks(data, sources).find((c) => c.groupId === 3)!;
		expect(skill.sources.map((s) => s.factorId).sort()).toEqual([301, 303]);
		const none = (1 - 0.09) ** 2 * (1 - 0.03) ** 2;
		expect(skill.atLeastOne).toBeCloseTo(1 - none);
		expect(skill.expected).toBeCloseTo(2 * (0.09 + 0.03));
		expect(skill.atLeastTwo).toBeGreaterThan(0);
		expect(skill.atLeastTwo).toBeLessThan(skill.atLeastOne);
	});
	test('copies across the lineage raise the chance of a new white spark', () => {
		expect(skillSparkChances(data, tree)).toEqual([{ skillId: 900, name: 'Sk', copies: 2, learned: 0.2 * 1.1 ** 2, upgraded: 0.25 * 1.1 ** 2, gold: 0.4 * 1.1 ** 2 }]);
	});
});

describe('saves and links', () => {
	const tree: WhatIfTree = { target: horse(1), p1: horse(2, [101], [8]) };
	test('a tree survives a link', () => {
		const text = encodeTree(tree);
		expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeTree(text)).toEqual(tree);
	});
	test('a broken link or a malformed tree is refused', () => {
		expect(decodeTree('not*base64')).toBeNull();
		expect(decodeTree(btoa('[1,2]'))).toBeNull();
		expect(parseTree({ p1: { cardId: 'x', factorIds: [], winSaddleIds: [] } })).toBeNull();
		expect(parseTree({ p1: { cardId: 1, factorIds: ['a'], winSaddleIds: [] } })).toBeNull();
		expect(parseTree(null)).toBeNull();
	});
	test('what the game data does not know is dropped', () => {
		expect(parseTree({ p1: horse(2, [101, 999], [8, 999]), p2: horse(777) }, data)).toEqual({ p1: horse(2, [101], [8]) });
	});
});
