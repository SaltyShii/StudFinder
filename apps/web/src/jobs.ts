import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Card, Course, ImportResult } from '../../../packages/lineage/src/types';
import { resolveTierList } from '../../../packages/lineage/src/tiers';
import { aceForCourse, pinkGroupOf, surfaceOf, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatesOf } from '../../../packages/scoring/src/candidates';
import { cmPreset, type Cm } from '../../../packages/scoring/src/cm';
import type { Candidate, TierList } from '../../../packages/scoring/src/shared';
import type { RecommendJob } from './recommend.job';
import type { VeteranJob } from './veterans.job';

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
export function tierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) for (const n of e.skills) list[n] ??= e.tier;
	return list;
}

export function cardIdsOf(roster: ImportResult): Map<string, number> {
	return new Map([...roster.veterans, ...roster.borrowed].map((v) => [String(v.trainedId), v.cardId]));
}

/** Without a course the pink group falls back to 0, so picks still list before the CM's course is in the data. */
export function candidatesFor(data: GameData, roster: ImportResult, card: Card, course: Course | undefined, useBorrowed: boolean): Candidate[] {
	return candidatesOf(data, useBorrowed ? [...roster.veterans, ...roster.borrowed] : roster.veterans, { aceCardId: card.id, pinkGroupId: course ? pinkGroupOf(course.distance) : 0 });
}

/** Null until there is a CM course and at least one candidate. */
export function buildJob(candidates: Candidate[], cm: Cm, card: Card, course: Course | undefined, style: Style, target: Partial<TargetStats>, tierList: TierList): RecommendJob | null {
	if (!course || !candidates.length) return null;
	return { roster: { candidates }, preset: cmPreset(cm, aceForCourse(card, { distance: course.distance, surface: surfaceOf(course.ground) }, style, target)), tierList };
}

/** Needs no Ace or Target stats. Null until game data is loaded, so unique skills are never missing from a run. */
export function buildVeteranJob(data: GameData | null, roster: ImportResult | null, cm: Cm): VeteranJob | null {
	if (!data || !roster || !data.courses.has(cm.courseId)) return null;
	const uniqueSkills: [number, number][] = [];
	data.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
	return { veterans: roster.veterans, courseId: cm.courseId, uniqueSkills };
}
