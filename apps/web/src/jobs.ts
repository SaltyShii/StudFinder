import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Card, Course, ImportResult, Veteran } from '../../../packages/lineage/src/types';
import { resolveTierList } from '../../../packages/lineage/src/tiers';
import { aceForCourse, categoryOf, defaultTargetStats, rankStyles, surfaceOf, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatesOf, pinkGroupOf } from '../../../packages/scoring/src/candidates';
import { cmPreset, type Cm } from '../../../packages/scoring/src/cm';
import type { CandidateList, CmPreset, Recommendation } from '../../../packages/scoring/src/recommend';
import type { Candidate, TierList } from '../../../packages/scoring/src/shared';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { JobRunner } from './jobRunner';

export interface RecommendJob {
	candidateList: CandidateList;
	preset: CmPreset;
	tierList?: TierList;
}
export interface VeteranJob {
	veterans: Veteran[];
	courseId: number;
	/** [card id, unique skill id] pairs (structured-cloneable for the worker). */
	uniqueSkills: [number, number][];
}
export type VeteranProgress = [done: number, total: number];
// shortcut: recommend() is synchronous, so its progress is a busy flag, not a percentage; split per candidate if it gets slow.
export type RecommendRunner = JobRunner<RecommendJob, Recommendation>;
export type VeteranRunner = JobRunner<VeteranJob, AceVeteranScore[], VeteranProgress>;

/** What crosses to the worker: one entry file serves every job, told apart by `kind`. */
export type JobRequest = { kind: 'recommend'; job: RecommendJob } | { kind: 'veterans'; job: VeteranJob };

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
function tierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) for (const n of e.skills) list[n] ??= e.tier;
	return list;
}

/** Trained id → card id for display lookups; borrowed veterans are always included, whether or not they are candidates. */
export function cardIdsOf(roster: ImportResult): Map<string, number> {
	return new Map([...roster.veterans, ...roster.borrowed].map((v) => [String(v.trainedId), v.cardId]));
}

// Without a course the pink group falls back to 0, so picks still list before the CM's course is in the data.
const NO_COURSE_PINK_GROUP = 0;

export function planCandidates(data: GameData, roster: ImportResult, card: Card, course: Course | undefined, useBorrowed: boolean): Candidate[] {
	return candidatesOf(data, useBorrowed ? [...roster.veterans, ...roster.borrowed] : roster.veterans, { aceCardId: card.id, pinkGroupId: course ? pinkGroupOf(course.distance) : NO_COURSE_PINK_GROUP });
}

export interface RecommendPlan {
	style: Style;
	/** Null until there is an Ace, a CM course and at least one candidate. */
	job: RecommendJob | null;
	/** Undefined until the CM course is known. */
	defaults: TargetStats | undefined;
}

export function planRecommend(data: GameData | null, candidates: Candidate[], cm: Cm, card: Card | undefined, course: Course | undefined, styleChoice: Style | null, target: Partial<TargetStats>): RecommendPlan {
	// Manual choice wins; otherwise the best-ranked style for this Ace on the CM course.
	const style: Style = styleChoice ?? (card && course ? rankStyles(card.aptitudes, categoryOf(course.distance))[0] : 'senko');
	const defaults = course && defaultTargetStats(categoryOf(course.distance), style);
	if (!data || !card || !course || !candidates.length) return { style, job: null, defaults };
	const runner = aceForCourse(card, { distance: course.distance, surface: surfaceOf(course.ground) }, style, target);
	return { style, defaults, job: { candidateList: { candidates }, preset: cmPreset(cm, runner), tierList: tierListOf(data, style) } };
}

/** Needs no Ace or Target stats. Null until game data is loaded, so unique skills are never missing from a run. */
export function planVeterans(data: GameData | null, roster: ImportResult | null, cm: Cm): VeteranJob | null {
	if (!data || !roster || !data.courses.has(cm.courseId)) return null;
	const uniqueSkills: [number, number][] = [];
	data.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
	return { veterans: roster.veterans, courseId: cm.courseId, uniqueSkills };
}
