import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { evaluateSkill } from '@stud-finder/lineage/src/conditions';
import { DISTANCES, STYLES, SURFACES } from '@stud-finder/lineage/src/config';
import type { Skill } from '@stud-finder/lineage/src/types';
import type { Category, Style } from './ace';

const WHITE = 1;
const GOLD = 2;

/** Skills an Ace can buy with skill points: white and gold, the strongest of each skill group (the circle tiers and the gold version share one), never a penalty skill. */
export function buyableSkillIds(skills: Iterable<{ id: number; rarity: number; groupId: number; gradeValue: number }>): string[] {
	const best = new Map<number, { id: number; gradeValue: number }>();
	for (const s of skills) {
		if (s.rarity !== WHITE && s.rarity !== GOLD) continue;
		const cur = best.get(s.groupId);
		if (!cur || s.gradeValue > cur.gradeValue) best.set(s.groupId, s);
	}
	return [...best.values()].filter((s) => s.gradeValue > 0).map((s) => String(s.id));
}

type SimSkill = { alternatives: { precondition: string; condition: string }[] };

/** The skills (those the sim knows) the Ace can meet the running style, distance and surface conditions of; everything else, such as another style's skills, is dropped. */
export function skillsAceCanMeet(ids: string[], { style, category, surface }: { style: Style; category: Category; surface: 'turf' | 'dirt' }): string[] {
	const ctx = { running_style: STYLES.find((s) => s.key === style)!.id, distance_type: DISTANCES.find((d) => d.key === category)!.id, ground_type: SURFACES.find((s) => s.key === surface)!.id };
	const data = skillData as unknown as Record<string, SimSkill>;
	return ids.filter((id) => {
		const sim = data[id];
		if (!sim) return false;
		const skill = { conditions: sim.alternatives.map((a) => ({ pre: a.precondition, cond: a.condition })) } as Skill;
		return evaluateSkill(skill, ctx).relevance !== 'mismatch';
	});
}
