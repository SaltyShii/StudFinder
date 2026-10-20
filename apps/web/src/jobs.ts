import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Card, Course, ImportResult, Veteran } from '../../../packages/lineage/src/types';
import { resolveTierList, type Tier } from '../../../packages/lineage/src/tiers';
import { aceForCourse, categoryOf, defaultTargetStats, rankStyles, surfaceOf, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatesOf, pinkGroupOf } from '../../../packages/scoring/src/candidates';
import { cmPreset, type Cm } from '../../../packages/scoring/src/cm';
import type { CandidateList, CmPreset, OwnedVersion, Recommendation } from '../../../packages/scoring/src/recommend';
import type { Candidate, TierList } from '../../../packages/scoring/src/shared';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { JobRunner } from './jobRunner';

export interface RecommendJob {
	candidateList: CandidateList;
	preset: CmPreset;
	tierList?: TierList;
	owned?: OwnedVersion[];
	mustHaves?: string[];
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

// A Core loop is usable for any CM, so skills tied to a surface, distance, track, season, weather or track condition do not count.
const CM_BOUND = /(ground_type|distance_type|is_basis_distance|track_id|season|weather|ground_condition|rotation)[=!<>]/;

/** The player's edits to one style's Tier list: skills moved to another tier, skills disabled. */
export interface TierEdit {
	moved: Record<string, Tier>;
	disabled: string[];
}
export type TierEdits = Partial<Record<Style, TierEdit>>;

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
export function coreTierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) {
		const bound = e.groupIds.some((g) => [...data.skills.values()].some((s) => (s.groupId || s.id) === g && s.conditions?.some((c) => CM_BOUND.test(`${c.pre}&${c.cond}`))));
		if (!bound) for (const n of e.skills) list[n] ??= e.tier;
	}
	return list;
}

export function applyTierEdit(base: TierList, edit: TierEdit | undefined): TierList {
	if (!edit) return base;
	const list = { ...base, ...edit.moved };
	for (const n of edit.disabled) delete list[n];
	return list;
}

/** Trained id → card id for display lookups; borrowed veterans are always included, whether or not they are candidates. */
export function cardIdsOf(roster: ImportResult): Map<string, number> {
	return new Map([...roster.veterans, ...roster.borrowed].map((v) => [String(v.trainedId), v.cardId]));
}

/** The default Sim runner: all aptitudes A, no unique skill, so it adds nothing and results compare against a blank baseline. */
export const GENERIC_RUNNER: Pick<Card, 'aptitudes' | 'uniqueSkillId'> = {
	aptitudes: { turf: 7, dirt: 7, short: 7, mile: 7, middle: 7, long: 7, nige: 7, senko: 7, sashi: 7, oikomi: 7 },
	uniqueSkillId: null,
};
// No Ace card to measure affinity against and none of the Roster to exclude.
const NO_CARD = -1;

// Without a course the pink group falls back to 0, so picks still list before the CM's course is in the data.
const NO_COURSE_PINK_GROUP = 0;

export function planCandidates(data: GameData, roster: ImportResult, card: Card | undefined, course: Course | undefined, useBorrowed: boolean): Candidate[] {
	return candidatesOf(data, useBorrowed ? [...roster.veterans, ...roster.borrowed] : roster.veterans, { aceCardId: card?.id ?? NO_CARD, pinkGroupId: course ? pinkGroupOf(course.distance) : NO_COURSE_PINK_GROUP });
}

export interface RecommendPlan {
	style: Style;
	/** The Core loop's running style: its own choice, else the Sim runner's. */
	coreStyle: Style;
	/** Null until there is a CM course and candidates or Owned versions. */
	job: RecommendJob | null;
	/** Undefined until the CM course is known. */
	defaults: TargetStats | undefined;
}

export interface PlanOptions {
	card?: Card;
	course?: Course;
	styleChoice?: Style | null;
	target?: Partial<TargetStats>;
	coreStyleChoice?: Style | null;
	owned?: OwnedVersion[];
	tierEdits?: TierEdits;
	mustHaves?: string[];
}

export function planRecommend(data: GameData | null, candidates: Candidate[], cm: Cm, options: PlanOptions): RecommendPlan {
	const { card, course, styleChoice = null, target = {}, coreStyleChoice = null, owned = [], tierEdits = {}, mustHaves = [] } = options;
	// Manual choice wins; otherwise the best-ranked style for this Sim runner on the CM course.
	const base = card ?? GENERIC_RUNNER;
	const style: Style = styleChoice ?? (course ? rankStyles(base.aptitudes, categoryOf(course.distance))[0] : 'senko');
	const defaults = course && defaultTargetStats(categoryOf(course.distance), style);
	const coreStyle = coreStyleChoice ?? style;
	if (!data || !course || !(candidates.length || owned.length)) return { style, coreStyle, job: null, defaults };
	const runner = aceForCourse(base, { distance: course.distance, surface: surfaceOf(course.ground) }, style, target);
	return { style, coreStyle, defaults, job: { candidateList: { candidates }, preset: cmPreset(cm, runner), tierList: applyTierEdit(coreTierListOf(data, coreStyle), tierEdits[coreStyle]), owned, mustHaves } };
}

/** Each Owned version with candidates measured against it; versions missing from the game data are skipped. */
export function planOwned(data: GameData, roster: ImportResult, ownedIds: Iterable<number>, course: Course | undefined, useBorrowed: boolean): OwnedVersion[] {
	return [...ownedIds].flatMap((id) => {
		const card = data.cards.get(id);
		return card ? [{ cardId: id, aptitudes: card.aptitudes, uniqueSkillId: card.uniqueSkillId == null ? undefined : String(card.uniqueSkillId), candidates: planCandidates(data, roster, card, course, useBorrowed) }] : [];
	});
}

/** Needs no Sim runner or Target stats. Null until game data is loaded, so unique skills are never missing from a run. */
export function planVeterans(data: GameData | null, roster: ImportResult | null, cm: Cm): VeteranJob | null {
	if (!data || !roster || !data.courses.has(cm.courseId)) return null;
	const uniqueSkills: [number, number][] = [];
	data.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
	return { veterans: roster.veterans, courseId: cm.courseId, uniqueSkills };
}
