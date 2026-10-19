import type { GameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { resolveTierList } from '../../../packages/lineage/src/tiers';
import { aceForCourse, pinkGroupOf, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatesOf } from '../../../packages/scoring/src/candidates';
import { cmPreset, pickCm } from '../../../packages/scoring/src/cm';
import type { Candidate, TierList } from '../../../packages/scoring/src/shared';
import type { Job, VeteranJob } from './job';

export interface Selection {
	data: GameData;
	roster: ImportResult;
	cmId: number;
	aceId: number | null;
	style: Style;
	target: Partial<TargetStats>;
	useBorrowed: boolean;
}

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
function tierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) for (const n of e.skills) list[n] ??= e.tier;
	return list;
}

/** The Job for the chosen Ace, or null until there is an Ace, a CM course and at least one candidate. */
export function buildJob({ data, roster, cmId, aceId, style, target, useBorrowed }: Selection): { job: Job | null; candidates: Candidate[]; cardIds: Map<string, number> } {
	const cardIds = new Map([...roster.veterans, ...roster.borrowed].map((v) => [String(v.trainedId), v.cardId]));
	const card = aceId != null ? data.cards.get(aceId) : undefined;
	const cm = pickCm(new Date(), cmId);
	const course = data.courses.get(cm.courseId);
	if (!card || !course) return { job: null, candidates: [], cardIds };
	const candidates = candidatesOf(data, useBorrowed ? [...roster.veterans, ...roster.borrowed] : roster.veterans, { aceCardId: card.id, pinkGroupId: pinkGroupOf(course.distance) });
	if (!candidates.length) return { job: null, candidates, cardIds };
	const ace = aceForCourse(card, course, style, target);
	return { job: { roster: { candidates }, preset: cmPreset(cm, ace), tierList: tierListOf(data, style) }, candidates, cardIds };
}

/** Needs no Ace or Target stats. Null until game data is loaded, so unique skills are never missing from a run. */
export function buildVeteranJob(data: GameData | null, roster: ImportResult | null, cmId: number): VeteranJob | null {
	if (!data || !roster) return null;
	const cm = pickCm(new Date(), cmId);
	if (!data.courses.has(cm.courseId)) return null;
	const uniqueSkills: [number, number][] = [];
	data.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
	return { veterans: roster.veterans, courseId: cm.courseId, uniqueSkills };
}
