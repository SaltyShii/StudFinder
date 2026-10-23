import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { evaluateSkill } from '@stud-finder/lineage/src/conditions';
import { DISTANCES, STYLES, SURFACES } from '@stud-finder/lineage/src/config';
import { FactorType, type Skill } from '@stud-finder/lineage/src/types';
import type { Category, Style } from './ace';

const WHITE = 1;
const GOLD = 2;

/** Skills an Ace can buy with skill points: the white and gold ones on its own card's skill list, never a penalty skill. Skills off the list are only reachable through a parent's sparks. */
export function buyableSkillIds(cardSkillIds: Iterable<number>, skills: ReadonlyMap<number, { rarity: number; gradeValue: number }>): string[] {
	return [...new Set(cardSkillIds)].filter((id) => {
		const sk = skills.get(id);
		return !!sk && (sk.rarity === WHITE || sk.rarity === GOLD) && sk.gradeValue > 0;
	}).map(String);
}

/**
 * The white unique variants: the skill a green (unique) spark carries (rarity 1, with a spCost in the data, so they would look like any buyable white skill).
 * Only a parent of the character makes one buyable (see candidates.ts), so they are neither in the Other buyable pool nor a purchasable extra.
 */
export function whiteUniqueIds(factors: Iterable<{ type: number; skillId: number | null }>): Set<number> {
	const ids = new Set<number>();
	for (const f of factors) if (f.type === FactorType.Unique && f.skillId != null) ids.add(f.skillId);
	return ids;
}

/** The white and gold skills any Ace could buy, the strongest of each skill group (the circle tiers and the gold version share one), never a penalty skill. The card list is a part of it; the rest are the Other buyable skills. */
export function poolSkillIds(skills: Iterable<{ id: number; rarity: number; groupId: number; gradeValue: number }>, exclude: ReadonlySet<number> = new Set()): string[] {
	const best = new Map<number, { id: number; gradeValue: number }>();
	for (const s of skills) {
		if (exclude.has(s.id) || s.rarity !== WHITE && s.rarity !== GOLD) continue;
		const cur = best.get(s.groupId);
		if (!cur || s.gradeValue > cur.gradeValue) best.set(s.groupId, s);
	}
	return [...best.values()].filter((s) => s.gradeValue > 0).map((s) => String(s.id));
}

type SimSkill = { alternatives: { precondition: string; condition: string }[] };

/** The skills (those the sim knows) the Ace can meet the running style, distance and surface conditions of; everything else, such as another style's skills, is dropped. */
export function skillsAceCanMeet(ids: string[], { style, category, surface }: { style: Style; category: Category; surface: 'turf' | 'dirt' }): string[] {
	const ctx = { running_style: STYLES.find((s) => s.key === style)!.id, distance_type: DISTANCES.find((d) => d.key === category)!.id, ground_type: SURFACES.find((s) => s.key === surface)!.id };
	// JSON import boundary: the sim data has no type for its alternatives
	// eslint-disable-next-line no-restricted-syntax
	const data = skillData as unknown as Record<string, SimSkill>;
	return ids.filter((id) => {
		const sim = data[id];
		if (!sim) return false;
		const skill = { conditions: sim.alternatives.map((a) => ({ pre: a.precondition, cond: a.condition })) } as Skill;
		return evaluateSkill(skill, ctx).relevance !== 'mismatch';
	});
}
