import skills from '@stud-finder/sim/src/data/skill_data.json';
import type { Scenario } from './pairedRace';
import type { SkillDetail } from './shared';
import { skillValue } from './skillValue';

const POSITION = /order|overtake|behind|infront|blocked/;

// The vendored JSON is untyped at runtime, so narrow it instead of casting.
export function assumesPosition(id: string): boolean {
	const skill: unknown = (skills as Record<string, unknown>)[id];
	if (skill === undefined) return false;
	const alts = typeof skill === 'object' && skill !== null ? (skill as { alternatives?: unknown }).alternatives : undefined;
	if (!Array.isArray(alts)) throw new Error(`Skill ${id} has no alternatives array in skill_data.json`);
	return alts.some((a: unknown) => typeof a === 'object' && a !== null && POSITION.test(String((a as { condition?: unknown }).condition)));
}

/** One skill's value in a scenario plus whether that value rests on the sim's default position assumption. */
export function skillDetail(skillId: string, scenario: Scenario): SkillDetail {
	return { skillId, ...skillValue(skillId, scenario), assumesPosition: assumesPosition(skillId) };
}
