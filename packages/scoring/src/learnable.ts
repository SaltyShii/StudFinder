import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { evaluateSkill } from '@stud-finder/lineage/src/conditions';
import { DISTANCES, STYLES, SURFACES } from '@stud-finder/lineage/src/config';
import type { Skill } from '@stud-finder/lineage/src/types';
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
