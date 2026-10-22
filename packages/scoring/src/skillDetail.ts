import skills from '@stud-finder/sim/src/data/skill_data.json';
import { pairedRace, type PairedRun, type Scenario } from './pairedRace';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { courseFacts } from './ace';
import { spotDensity } from './density';
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

/** One skill's value in a scenario (or from its already raced `runs`) plus whether that value rests on the sim's default position assumption. */
export function skillDetail(skillId: string, scenario: Scenario, runs?: PairedRun[]): SkillDetail {
	if (skillId.startsWith(GAIN_OVER)) return gainOver(skillId, scenario);
	return { skillId, ...skillValue(skillId, scenario, runs), assumesPosition: assumesPosition(skillId) };
}

/** Stand-in for a skill nobody has simulated yet: it never procs, so it adds no value. */
export function unsimulated(skillId: string, courseId: number): SkillDetail {
	const none = { min: 0, avg: 0, median: 0, max: 0 };
	return { skillId, proc: 0, lengths: none, value: 0, spots: [], spotSpread: { min: 0, median: 0, max: 0 }, density: spotDensity([], courseFacts(courseId).distance), duration: 0, assumesPosition: assumesPosition(skillId) };
}

/** Id prefix of a pseudo skill: the lengths the runner gains over the horse in the rest of the id (JSON), e.g. from a higher aptitude. */
export const GAIN_OVER = '@gain-over:';

export function gainOverId(versus: HorseDesc): string {
	return GAIN_OVER + JSON.stringify(versus);
}

/** Lengths `scenario.horse` gains over `versus`, valued like a skill that always procs. */
export function gainOver(id: string, scenario: Scenario): SkillDetail {
	const versus: HorseDesc = JSON.parse(id.slice(GAIN_OVER.length));
	return { skillId: id, ...skillValue(id, scenario, pairedRace([], scenario, versus)), assumesPosition: false };
}
