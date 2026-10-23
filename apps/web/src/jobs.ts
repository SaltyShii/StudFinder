import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Card, Course, ImportResult, Skill, Veteran } from '../../../packages/lineage/src/types';
import { resolveTierList, type Tier } from '../../../packages/lineage/src/tiers';
import { DEFAULT_FIT_CUTOFF, FIT_OFF, aceForCourse, categoryOf, defaultTargetStats, gradeLabel, rankStyles, surfaceOf, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatesOf, pinkGroupOf } from '../../../packages/scoring/src/candidates';
import { cmPreset, type Cm } from '../../../packages/scoring/src/cm';
import type { AceSkillRow, CandidateList, CmPreset, SkillCost, OwnedVersion, Recommendation, RecommendProgress, SimBatch, SimRequest } from '../../../packages/scoring/src/recommend';
import type { Candidate, TierList } from '../../../packages/scoring/src/shared';
import { buyableSkillIds, poolSkillIds } from '../../../packages/scoring/src/learnable';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { SimAssumptions } from '../../../packages/scoring/src/assumptions';
import type { JobRunner } from './jobRunner';

export interface RecommendJob {
	candidateList: CandidateList;
	preset: CmPreset;
	tierList?: TierList;
	owned?: OwnedVersion[];
	/** The versions the Side loop and Core loop rank; the Owned versions when absent. */
	loopVersions?: OwnedVersion[];
	mustHaves?: string[];
}
export interface VeteranJob {
	veterans: Veteran[];
	courseId: number;
	assumptions?: SimAssumptions;
	season?: number;
	ground?: number;
	weather?: number;
	time?: number;
	/** [card id, unique skill id] pairs (structured-cloneable for the worker). */
	uniqueSkills: [number, number][];
}
/** One veteran of a VeteranJob, scored apart by a pool worker. */
export interface VeteranTask extends Omit<VeteranJob, 'veterans' | 'uniqueSkills'> {
	veteran: Veteran;
	unique?: number;
}
export type VeteranProgress = [done: number, total: number];
export type { RecommendProgress };
/** What the worker reports while a job runs. */
export type JobProgress = VeteranProgress | RecommendProgress;
export type RecommendRunner = JobRunner<RecommendJob, Recommendation, RecommendProgress>;
export type VeteranRunner = JobRunner<VeteranJob, AceVeteranScore[], VeteranProgress>;
/** Builds one Ace hero's chart rows; see aceRowsJob. */
export type AceRowsRunner = JobRunner<RecommendJob, AceSkillRow[], RecommendProgress>;

/** What crosses to the worker: one entry file serves every job, told apart by `kind`. */
export type JobRequest = { kind: 'recommend'; job: RecommendJob } | { kind: 'aceRows'; job: RecommendJob } | { kind: 'veteran'; task: VeteranTask } | { kind: 'sim'; task: SkillTask };

/** One request (a skill, or the Whole-Ace runs of a pair) of a Recommend run's batch, simulated by a pool worker. */
export interface SkillTask {
	request: SimRequest;
	scenario: SimBatch['scenario'];
}

/**
 * The job that builds the chart rows of one Ace hero of a Recommend run: the same run restricted to that version, so the rows are the ones the ranking would build for it
 * (a version's best pair does not depend on the other versions). No roster candidates and no loops, as only the version's own parents are charted. Null when the run has no such version.
 */
export function aceRowsJob(job: RecommendJob, cardId: number): RecommendJob | null {
	const version = job.owned?.find((v) => v.cardId === cardId);
	return version ? { ...job, candidateList: { candidates: [] }, owned: [version], loopVersions: [], tierList: undefined } : null;
}

type RecommendArgs = Parameters<typeof import('../../../packages/scoring/src/recommend').recommend>;
/** The arguments `recommend` and `recommendAsync` take for a job, in one place for both entry points. */
export function recommendArgs(job: RecommendJob, onProgress: NonNullable<RecommendArgs[5]>): RecommendArgs {
	return [job.candidateList, job.preset, job.tierList, job.owned, job.mustHaves, onProgress, job.loopVersions];
}
/** The chart rows an aceRows job answers with: those of the only hero its run ranks. */
export function aceRowsOf(rec: Recommendation): AceSkillRow[] {
	return rec.aceSlots[0]?.skills ?? [];
}

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
	/** The versions the Side loop and Core loop rank; the Owned versions when absent. */
	loopVersions?: OwnedVersion[];
	tierEdits?: TierEdits;
	mustHaves?: string[];
	assumptions?: SimAssumptions;
	/** Skill points the Ace may spend; null or absent is unlimited. */
	skillPointBudget?: number | null;
}

/** What each purchasable skill costs, keyed by skill id as the scorer reads it; skills that cannot be bought are left out. */
export function skillCostsOf(skills: Iterable<Skill>): Record<string, SkillCost> {
	const costs: Record<string, SkillCost> = {};
	for (const s of skills) {
		if (s.purchasable === false || s.spCost == null) continue;
		costs[String(s.id)] = { cost: s.spCost, group: s.groupId, ...(s.replacesId != null ? { replacesId: String(s.replacesId) } : {}) };
	}
	return costs;
}

export function planRecommend(data: GameData | null, candidates: Candidate[], cm: Cm, options: PlanOptions): RecommendPlan {
	const { card, course, styleChoice = null, target = {}, coreStyleChoice = null, owned = [], loopVersions = owned, tierEdits = {}, mustHaves = [], assumptions, skillPointBudget } = options;
	// Manual choice wins; otherwise the best-ranked style for this Sim runner on the CM course.
	const base = card ?? GENERIC_RUNNER;
	const style: Style = styleChoice ?? (course ? rankStyles(base.aptitudes, categoryOf(course.distance))[0] : 'senko');
	const defaults = course && defaultTargetStats(categoryOf(course.distance), style);
	const coreStyle = coreStyleChoice ?? style;
	if (!data || !course || !(candidates.length || owned.length)) return { style, coreStyle, job: null, defaults };
	const runner = aceForCourse(base, { distance: course.distance, surface: surfaceOf(course.ground) }, style, target);
	return { style, coreStyle, defaults, job: { candidateList: { candidates }, preset: { ...cmPreset(cm, runner), assumptions, ...(skillPointBudget != null ? { skillPoints: { budget: skillPointBudget, costs: skillCostsOf(data.skills.values()) } } : {}) }, tierList: applyTierEdit(coreTierListOf(data, coreStyle), tierEdits[coreStyle]), owned, loopVersions, mustHaves } };
}

/** Each Owned version with candidates measured against it; versions missing from the game data are skipped. */
export function planOwned(data: GameData, roster: ImportResult, ownedIds: Iterable<number>, course: Course | undefined, useBorrowed: boolean): OwnedVersion[] {
	const pool = poolSkillIds(data.skills.values());
	return [...ownedIds].flatMap((id) => {
		const card = data.cards.get(id);
		return card ? [{ cardId: id, aptitudes: card.aptitudes, uniqueSkillId: card.uniqueSkillId == null ? undefined : String(card.uniqueSkillId), learnableSkillIds: buyableSkillIds(card.skillIds ?? [], data.skills), otherSkillIds: pool, candidates: planCandidates(data, roster, card, course, useBorrowed) }] : [];
	});
}

/** Needs no Sim runner or Target stats. Null until game data is loaded, so unique skills are never missing from a run. */
export function planVeterans(data: GameData | null, roster: ImportResult | null, cm: Cm, assumptions?: SimAssumptions): VeteranJob | null {
	if (!data || !roster || !data.courses.has(cm.courseId)) return null;
	const uniqueSkills: [number, number][] = [];
	data.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
	return { veterans: roster.veterans, courseId: cm.courseId, assumptions, season: cm.season, ground: cm.ground, weather: cm.weather, time: cm.time, uniqueSkills };
}

/** One task per veteran, so a pool can score them in parallel; the unique skill is looked up here to keep the messages small. */
export function veteranTasks({ veterans, uniqueSkills, ...conditions }: VeteranJob): VeteranTask[] {
	const unique = new Map(uniqueSkills);
	return veterans.map((veteran) => ({ ...conditions, veteran, unique: unique.get(veteran.cardId) }));
}

export { DEFAULT_FIT_CUTOFF, FIT_OFF };

/** An Owned version the Ace slot does not simulate for this CM, with why (for example "Dirt F"). */
export interface UnfitVersion {
	version: OwnedVersion;
	reason: string;
}

function capitalize(word: string) {
	return word[0].toUpperCase() + word.slice(1);
}

/** Splits the Owned versions by surface and distance Aptitude grade against the cutoff; running style is ignored. The order is kept. A forced Unfit version is still listed as unfit (so it can be unforced) but joins `fit`, the Ace list. */
export function planFit(versions: OwnedVersion[], course: Course | undefined, cutoff: number, forced: ReadonlySet<number> = new Set()): { fit: OwnedVersion[]; unfit: UnfitVersion[] } {
	const fit: OwnedVersion[] = [];
	const unfit: UnfitVersion[] = [];
	for (const version of versions) {
		const failing = course ? [surfaceOf(course.ground), categoryOf(course.distance)].filter((k) => version.aptitudes[k] < cutoff) : [];
		if (failing.length) unfit.push({ version, reason: failing.map((k) => `${capitalize(k)} ${gradeLabel(version.aptitudes[k])}`).join(', ') });
		if (!failing.length || forced.has(version.cardId)) fit.push(version);
	}
	return { fit, unfit };
}
