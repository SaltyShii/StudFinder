import { lineageCompat } from '@stud-finder/lineage/src/compatibility';
import type { GameData } from '@stud-finder/lineage/src/gameData';
import { chanceAny, chanceAtLeast, INSPIRATIONS, procChance, sparkGenerationChance } from '@stud-finder/lineage/src/inheritance';
import { ACTIVE_RULES } from '@stud-finder/lineage/src/rules';
import { FactorType, type LineageMember, type Veteran } from '@stud-finder/lineage/src/types';

/** The places of a What-if tree: the trainee, her 2 parents and each parent's 2 parents. */
export const TREE_SLOTS = ['target', 'p1', 'p2', 'p1g1', 'p1g2', 'p2g1', 'p2g2'] as const;
export type TreeSlot = (typeof TREE_SLOTS)[number];
export type InheritSlot = Exclude<TreeSlot, 'target'>;
export const INHERIT_SLOTS = TREE_SLOTS.filter((s): s is InheritSlot => s !== 'target');

/** One horse of a What-if tree: a version, with the sparks and G1 wins it is planned or known to have. */
export interface TreeHorse {
	cardId: number;
	factorIds: number[];
	winSaddleIds: number[];
}

export type WhatIfTree = Partial<Record<TreeSlot, TreeHorse>>;

export interface TreeAffinity {
	/** Lineage total, as the game shows it with ◎○△. */
	total: number;
	rank: number;
	/** What each inherited horse's sparks roll with. */
	slots: Record<InheritSlot, number>;
}

/** One spark of one horse: its chance to proc. */
export interface SparkSource {
	slot: InheritSlot;
	factorId: number;
	name: string;
	type: FactorType;
	stars: number;
	affinity: number;
	/** Per inspiration. */
	perInspiration: number;
	/** At either of the two inspirations of a career. */
	perRun: number;
}

/** One spark over the whole tree, however many horses carry it. */
export interface CombinedSpark {
	/** Factor group: the same spark at any star count. */
	groupId: number;
	name: string;
	type: FactorType;
	sources: SparkSource[];
	/** Chance it procs at least once in a career. */
	atLeastOne: number;
	/** Chance it procs at least twice. */
	atLeastTwo: number;
	/** Mean procs in a career. */
	expected: number;
}

/** A skill the trainee could turn into her own white spark, given how many lineage horses carry it. */
export interface SkillSparkChance {
	skillId: number;
	name: string;
	copies: number;
	/** Chance of the spark when she learns the skill. */
	learned: number;
	/** When she learns the ◎ version. */
	upgraded: number;
	/** When she learns the gold version. */
	gold: number;
}

function memberOf(data: GameData, horse: TreeHorse | undefined): LineageMember | null {
	return horse ? { cardId: horse.cardId, charaId: data.charaIdOfCard(horse.cardId), factorIds: horse.factorIds, winSaddleIds: horse.winSaddleIds } : null;
}

/** An empty place counts for nothing: a member with no character adds no affinity. */
function parentVeteran(data: GameData, tree: WhatIfTree, p: 'p1' | 'p2'): Veteran {
	const self = memberOf(data, tree[p]) ?? { cardId: 0, charaId: null, factorIds: [], winSaddleIds: [] };
	return { ...self, parents: [memberOf(data, tree[`${p}g1`]), memberOf(data, tree[`${p}g2`])] } as Veteran;
}

/** The tree's affinity by the same model the recommendations use. Without a target nothing relates to her, so only the parents' own relation counts. */
export function treeAffinity(data: GameData, tree: WhatIfTree): TreeAffinity {
	const target = tree.target ? data.charaIdOfCard(tree.target.cardId) ?? -1 : -1;
	const compat = lineageCompat(data, target, parentVeteran(data, tree, 'p1'), parentVeteran(data, tree, 'p2'));
	const [a, b] = compat.parents;
	return { total: compat.total, rank: compat.rank, slots: { p1: a.affinity, p2: b.affinity, p1g1: a.grandparents[0], p1g2: a.grandparents[1], p2g1: b.grandparents[0], p2g2: b.grandparents[1] } };
}

/** The other places a character may not share with this one: its parent, its sibling and its own parents. The game refuses those. */
export function excludedCharas(data: GameData, tree: WhatIfTree, slot: TreeSlot): Set<number> {
	const related: Record<TreeSlot, TreeSlot[]> = { target: ['p1', 'p2'], p1: ['target', 'p2', 'p1g1', 'p1g2'], p2: ['target', 'p1', 'p2g1', 'p2g2'], p1g1: ['p1', 'p1g2'], p1g2: ['p1', 'p1g1'], p2g1: ['p2', 'p2g2'], p2g2: ['p2', 'p2g1'] };
	const ids = related[slot].flatMap((s) => { const h = tree[s]; const c = h && data.charaIdOfCard(h.cardId); return c == null ? [] : [c]; });
	return new Set(ids);
}

/** The affinity this version would give the place (the lineage total), for ranking candidates in a picker; its wins are not known, so race bonuses of a fresh pick count nothing. */
export function affinityIfPlaced(data: GameData, tree: WhatIfTree, slot: TreeSlot, cardId: number): number {
	return treeAffinity(data, { ...tree, [slot]: { cardId, factorIds: [], winSaddleIds: [] } }).total;
}

/** Every spark of every inherited horse with its chance, best first. */
export function sparkSources(data: GameData, tree: WhatIfTree, affinity: TreeAffinity = treeAffinity(data, tree)): SparkSource[] {
	const out: SparkSource[] = [];
	for (const slot of INHERIT_SLOTS) {
		for (const factorId of tree[slot]?.factorIds ?? []) {
			const f = data.factors.get(factorId);
			if (!f) continue;
			const perInspiration = procChance(f.type, f.stars, affinity.slots[slot]);
			out.push({ slot, factorId, name: f.name, type: f.type, stars: f.stars, affinity: affinity.slots[slot], perInspiration, perRun: chanceAny([perInspiration]) });
		}
	}
	return out.sort((a, b) => b.perRun - a.perRun);
}

/** The sources grouped per spark. Each source rolls on its own at each inspiration, so the stars of different horses are not added up. */
export function combinedSparks(data: GameData, sources: SparkSource[]): CombinedSpark[] {
	const groups = new Map<number, SparkSource[]>();
	for (const s of sources) {
		const groupId = data.factors.get(s.factorId)!.groupId;
		groups.set(groupId, [...(groups.get(groupId) ?? []), s]);
	}
	return [...groups].map(([groupId, group]) => {
		const rolls = group.flatMap((s) => Array.from({ length: INSPIRATIONS }, () => s.perInspiration));
		return { groupId, name: group[0].name, type: group[0].type, sources: group, atLeastOne: chanceAny(group.map((s) => s.perInspiration)), atLeastTwo: chanceAtLeast(2, rolls), expected: rolls.reduce((t, p) => t + p, 0) };
	}).sort((a, b) => b.expected - a.expected);
}

/** The white skill sparks the trainee could generate, most likely first; copies across the parents and grandparents raise the chance. */
export function skillSparkChances(data: GameData, tree: WhatIfTree): SkillSparkChance[] {
	const copies = new Map<number, number>();
	for (const slot of INHERIT_SLOTS) {
		for (const id of tree[slot]?.factorIds ?? []) {
			const f = data.factors.get(id);
			if (f?.type === FactorType.Skill && f.skillId != null) copies.set(f.skillId, (copies.get(f.skillId) ?? 0) + 1);
		}
	}
	const { base } = ACTIVE_RULES.sparkGeneration;
	return [...copies].map(([skillId, n]) => ({ skillId, name: data.skills.get(skillId)?.name ?? String(skillId), copies: n, learned: sparkGenerationChance(n, base.white), upgraded: sparkGenerationChance(n, base.double), gold: sparkGenerationChance(n, base.gold) })).sort((a, b) => b.learned - a.learned || a.name.localeCompare(b.name));
}

function isIntList(v: unknown): v is number[] {
	return Array.isArray(v) && v.every((n) => Number.isInteger(n));
}

/** A tree from a save or a shared link, or null when it is malformed. Places and versions the game data does not know are dropped, as a link can be older than the data. */
export function parseTree(raw: unknown, data?: GameData): WhatIfTree | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const tree: WhatIfTree = {};
	for (const slot of TREE_SLOTS) {
		const h = (raw as Record<string, unknown>)[slot] as Partial<TreeHorse> | null | undefined;
		if (h == null) continue;
		if (typeof h !== 'object' || !Number.isInteger(h.cardId) || !isIntList(h.factorIds) || !isIntList(h.winSaddleIds)) return null;
		if (data && !data.cards.has(h.cardId)) continue;
		tree[slot] = { cardId: h.cardId, factorIds: data ? h.factorIds.filter((id) => data.factors.has(id)) : h.factorIds, winSaddleIds: data ? h.winSaddleIds.filter((id) => data.saddles.has(id)) : h.winSaddleIds };
	}
	return tree;
}

/** A tree as URL-safe text, for a share link. */
export function encodeTree(tree: WhatIfTree): string {
	const bytes = new TextEncoder().encode(JSON.stringify(tree));
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The tree in a share link, or null when the text is not one. */
export function decodeTree(text: string, data?: GameData): WhatIfTree | null {
	try {
		const bytes = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
		return parseTree(JSON.parse(new TextDecoder().decode(bytes)), data);
	} catch {
		return null;
	}
}
