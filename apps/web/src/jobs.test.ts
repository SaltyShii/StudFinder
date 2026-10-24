import { expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { Course, RawGameData, Skill } from '../../../packages/lineage/src/types';
import { CMS, pickCm } from '../../../packages/scoring/src/cm';
import type { Style } from '../../../packages/scoring/src/ace';
import type { AceSkillRow, Recommendation } from '../../../packages/scoring/src/recommend';
import type { Candidate } from '../../../packages/scoring/src/shared';
import { importRoster } from './roster';
import { aceRowsJob, cardIdsOf, skillCostsOf, planCandidates, planFit, planOwned, planRecommend, planVeterans, veteranTasks, type TierEdits } from './jobs';
import { rankVeterans } from '../../../packages/scoring/src/rankVeterans';
import { scoreVeterans, type AceVeteranScore } from '../../../packages/scoring/src/veterans';
import { runJob } from './runJob';

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
const courses = Object.fromEntries(CMS.map((c) => [c.courseId, { id: c.courseId, trackId: 1, distance: 2000, ground: 1, turn: 1 }]));
const data = new GameData({
	meta: {}, charas: {},
	cards: {
		100101: { id: 100101, charaId: 1001, name: 'Ace', title: 'Test', aptitudes: apt, uniqueSkillId: 100101, skillIds: [] },
		100201: { id: 100201, charaId: 1002, name: 'Stud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [10071, 20001, 20002] },
	},
	skills: {
		10071: { id: 10071, name: 'Synthetic Skill' },
		20001: { id: 20001, name: 'Late Surger Straightaways', rarity: 1, groupId: 2000, gradeValue: 100, conditions: [{ pre: '', cond: 'running_style==3&phase==2' }] },
		20002: { id: 20002, name: 'End Closer Straightaways', rarity: 1, groupId: 2001, conditions: [{ pre: '', cond: 'running_style==4&phase==2' }] },
		20003: { id: 20003, name: 'Sprint Corners', rarity: 1, groupId: 2002, conditions: [{ pre: '', cond: 'distance_type==1&corner>=1' }] },
		20004: { id: 20004, name: 'Groundwork', rarity: 1, groupId: 2003, conditions: [{ pre: '', cond: 'track_id==10006' }] },
		20005: { id: 20005, name: 'Firm Conditions', rarity: 1, groupId: 2004, conditions: [{ pre: '', cond: 'ground_condition==1' }] },
		20006: { id: 20006, name: 'Spring Runner', rarity: 1, groupId: 2005, conditions: [{ pre: '', cond: 'season==1' }] },
		20007: { id: 20007, name: 'Right-Handed', rarity: 1, groupId: 2006, conditions: [{ pre: '', cond: 'rotation==1' }] },
		200162: { id: 200162, name: 'Wet Conditions', rarity: 1, groupId: 20016, gradeValue: 129, conditions: [] },
		200163: { id: 200163, name: 'Wet Conditions x', rarity: 1, groupId: 20016, gradeValue: -129, conditions: [] },
	}, factors: {
		1201: { id: 1201, groupId: 12, type: 2, stars: 1, name: 'Dirt', targets: [], skillId: null },
		1202: { id: 1202, groupId: 4001, type: 4, stars: 3, name: 'Synthetic Spark', targets: [], skillId: 10071 },
	}, relations: { points: {}, members: {}, ranks: [] },
	saddles: {}, tracks: {}, courses, races: [],
} as unknown as RawGameData);
const roster = importRoster(JSON.stringify([
	{ trained_chara_id: 2, card_id: 100201, factor_id_array: [1201, 1202], succession_chara_array: [] },
]), data);
const cm = pickCm(new Date(), CMS[0].id);
const course = data.courses.get(cm.courseId);
const ace = data.cards.get(100101)!;
const planFor = (candidates: Candidate[], c: Course | undefined, styleChoice: Style | null = 'senko') => planRecommend(data, candidates, cm, { card: ace, course: c, styleChoice });
const jobFor = (candidates: Candidate[], c: Course | undefined) => planFor(candidates, c).job;

it('builds a RecommendJob that the real recommend() accepts', () => {
	const candidates = planCandidates(data, roster, ace, course, false);
	expect(candidates).toHaveLength(1);
	expect(cardIdsOf(roster).get('2')).toBe(100201);
	const job = jobFor(candidates, course)!;
	job.preset.samples = 5;
	expect((runJob({ kind: 'recommend', job }, () => {}) as Recommendation).ace[0].candidateId).toBe(candidates[0].id);
});

it('has no RecommendJob without candidates or a course, but still lists candidates without a course', () => {
	expect(jobFor([], course)).toBeNull();
	expect(jobFor(planCandidates(data, roster, ace, course, false), undefined)).toBeNull();
	expect(planCandidates(data, roster, ace, undefined, false)).toHaveLength(1);
});

it('without a Sim runner plans the Generic one: all aptitudes A, no unique skill, every veteran a candidate', () => {
	const candidates = planCandidates(data, roster, undefined, course, false);
	expect(candidates.length).toBeGreaterThanOrEqual(planCandidates(data, roster, ace, course, false).length);
	const job = planRecommend(data, candidates, cm, { course, styleChoice: 'senko' }).job!;
	expect(job.preset.runner).toMatchObject({ distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', skills: [] });
	expect(planRecommend(data, [], cm, { course }).job).toBeNull();
});

it('includes borrowed veterans only when asked', () => {
	const withBorrowed = importRoster(JSON.stringify([
		{ trained_chara_id: 1, card_id: 100101, factor_id_array: [1201], succession_chara_array: [{ position_id: 10, card_id: 100201, owner_viewer_id: 777, factor_id_array: [1201, 1202] }] },
	]), data);
	expect(withBorrowed.borrowed).toHaveLength(1);
	expect(planCandidates(data, withBorrowed, ace, course, true).length).toBeGreaterThan(planCandidates(data, withBorrowed, ace, course, false).length);
});

it('veteran job waits for game data and carries unique skills', () => {
	expect(planVeterans(null, roster, cm)).toBeNull();
	const vj = planVeterans(data, roster, cm)!;
	expect(vj.uniqueSkills).toEqual([[100101, 100101]]);
	expect(vj.courseId).toBe(cm.courseId);
});

it('a manual Style beats the ranked one, and the plan carries default Target stats once the course is known', () => {
	const candidates = planCandidates(data, roster, ace, course, false);
	expect(planFor(candidates, course, null).style).toBe('senko'); // best aptitude on a middle-distance course
	expect(planFor(candidates, course, 'nige').style).toBe('nige');
	expect(planFor(candidates, course, 'nige').job).not.toBeNull();
	expect(planFor(candidates, course).defaults).toBeDefined();
	expect(planFor(candidates, undefined).defaults).toBeUndefined();
});

it('core loop style defaults to the Sim runner style, can be overridden, and drops surface, distance and track skills', () => {
	const candidates = planCandidates(data, roster, ace, course, false);
	const coreList = (coreStyle: Style | null, style: Style = 'sashi') => planRecommend(data, candidates, cm, { card: ace, course, styleChoice: style, coreStyleChoice: coreStyle }).job!.tierList!;
	expect(coreList(null)).toHaveProperty(['Late Surger Straightaways']);
	expect(coreList(null)).not.toHaveProperty(['End Closer Straightaways']);
	expect(coreList('oikomi')).toHaveProperty(['End Closer Straightaways']);
	expect(coreList(null, 'oikomi')).toHaveProperty(['End Closer Straightaways']);
	expect(coreList('sashi')).not.toHaveProperty(['Sprint Corners']); // distance conditioned
	expect(coreList('sashi')).not.toHaveProperty(['Groundwork']); // track conditioned
	for (const n of ['Firm Conditions', 'Spring Runner', 'Right-Handed']) expect(coreList('sashi')).not.toHaveProperty([n]); // track condition, season, rotation
});

it('Tier list edits move or disable a skill for the Core loop style only', () => {
	const candidates = planCandidates(data, roster, ace, course, false);
	const list = (edits: TierEdits) => planRecommend(data, candidates, cm, { card: ace, course, styleChoice: 'sashi', tierEdits: edits }).job!.tierList!;
	expect(list({})['Late Surger Straightaways']).toBe('T1.5');
	expect(list({ sashi: { moved: { 'Late Surger Straightaways': 'T5' }, disabled: [] } })['Late Surger Straightaways']).toBe('T5');
	expect(list({ sashi: { moved: {}, disabled: ['Late Surger Straightaways'] } })).not.toHaveProperty(['Late Surger Straightaways']);
	expect(list({ oikomi: { moved: {}, disabled: ['Late Surger Straightaways'] } })['Late Surger Straightaways']).toBe('T1.5'); // another style's edit
});

it('plans an Owned version with only the buyable skills on its own card list', () => {
	const [stud] = planOwned(data, roster, [100201], course, false);
	// 10071 has no rarity and 20002 no grade value in the fixture; 20003 is white but not on the card list
	expect(stud.learnableSkillIds).toEqual(['20001']);
});

it('plans the rest of the buyable pool as Other skills, the card list included for the chart to dedupe', () => {
	const [stud] = planOwned(data, roster, [100201], course, false);
	expect(stud.otherSkillIds).toEqual(['20001', '200162']);
});

it('veterans scored apart as pool tasks and ranked together equal the serial score', () => {
	const apt = { turf: 8, dirt: 3, short: 4, mile: 7, middle: 7, long: 5, nige: 2, senko: 7, sashi: 6, oikomi: 1 };
	const base = { ...roster.veterans[0], aptitudes: apt, skillIds: [10071] };
	const vj = { ...planVeterans(data, roster, cm)!, samples: 5, veterans: [base, { ...base, trainedId: 2, skillIds: [] }] };
	const apart = veteranTasks(vj).map((task) => runJob({ kind: 'veteran', task }, () => {}) as AceVeteranScore);
	const { veterans, uniqueSkills, ...conditions } = vj;
	expect(rankVeterans(apart)).toEqual(scoreVeterans(veterans, { ...conditions, uniqueSkills: new Map(uniqueSkills) }));
});

it('plans the Ace list and the Loop versions apart; the Loop versions default to the Owned versions', () => {
	const owned = planOwned(data, roster, [100101, 100201], course, false);
	const cardIds = (vs: { cardId: number }[] | undefined) => vs?.map((v) => v.cardId);
	const loopOnly = planRecommend(data, [], cm, { course, owned, loopVersions: [owned[1]] }).job!;
	expect(cardIds(loopOnly.owned)).toEqual([100101, 100201]);
	expect(cardIds(loopOnly.loopVersions)).toEqual([100201]);
	expect(cardIds(planRecommend(data, [], cm, { course, owned }).job!.loopVersions)).toEqual([100101, 100201]);
	expect(cardIds(planRecommend(data, [], cm, { course, owned, loopVersions: [] }).job!.loopVersions)).toEqual([]);
});

it('runs the Side loop and Core loop on the Loop versions of the job', () => {
	const owned = planOwned(data, roster, [100101, 100201], course, false);
	const job = planRecommend(data, planCandidates(data, roster, ace, course, false), cm, { course, owned, loopVersions: [owned[1]] }).job!;
	job.preset.samples = 5;
	const rec = runJob({ kind: 'recommend', job }, () => {}) as Recommendation;
	expect(rec.sideSlots.map((s) => s.cardId)).toEqual([100201]);
	expect(rec.coreSlots.map((s) => s.cardId)).toEqual([100201]);
});

it('splits the Owned versions into fit and Unfit versions by surface and distance grade, ignoring running style', () => {
	const poor = { ...apt, dirt: 2, mile: 3, nige: 1, senko: 1, sashi: 1, oikomi: 1 };
	const versions = planOwned(data, roster, [100101, 100201], course, false);
	versions[1] = { ...versions[1], aptitudes: poor };
	const dirtCourse = { ...course!, ground: 2, distance: 1600 };
	const fit = planFit(versions, dirtCourse, 4);
	expect(fit.fit.map((v) => v.cardId)).toEqual([]);
	expect(fit.notSimulated.map((u) => [u.version.cardId, u.reason])).toEqual([[100101, 'Dirt G'], [100201, 'Dirt F, Mile E']]);
	// The default course is turf over Middle, which both versions run at A.
	expect(planFit(versions, course, 4).fit.map((v) => v.cardId)).toEqual([100101, 100201]);
	// A grade at the cutoff is fit; below is not.
	expect(planFit(versions, dirtCourse, 2).fit.map((v) => v.cardId)).toEqual([100201]);
});

it('switches the fit filter off at grade G', () => {
	const versions = planOwned(data, roster, [100101], course, false);
	const dirtCourse = { ...course!, ground: 2 };
	expect(planFit(versions, dirtCourse, 1).fit.map((v) => v.cardId)).toEqual([100101]);
	expect(planFit(versions, dirtCourse, 1).notSimulated).toEqual([]);
});

it('simulates a forced Unfit version in the Ace slot, keeps it listed, and keeps the Owned order', () => {
	const versions = planOwned(data, roster, [100101, 100201], course, false);
	const dirtCourse = { ...course!, ground: 2, distance: 1600 };
	versions[0] = { ...versions[0], aptitudes: { ...apt, dirt: 2 } };
	versions[1] = { ...versions[1], aptitudes: { ...apt, dirt: 7 } };
	const split = planFit(versions, dirtCourse, 4, new Set([100101]));
	expect(split.fit.map((v) => v.cardId)).toEqual([100101, 100201]);
	expect(split.notSimulated.map((u) => u.version.cardId)).toEqual([100101]);
	// Forcing a version that is not unfit changes nothing; with every version unfit, forcing one leaves the Ace list non-empty.
	expect(planFit(versions, course, 4, new Set([100201])).fit.map((v) => v.cardId)).toEqual([100101, 100201]);
	versions[1] = { ...versions[1], aptitudes: { ...apt, dirt: 2 } };
	expect(planFit(versions, dirtCourse, 4).fit).toEqual([]);
	expect(planFit(versions, dirtCourse, 4, new Set([100201])).fit.map((v) => v.cardId)).toEqual([100201]);
});

it('simulates only the Viable versions in the Ace slot, in Owned order, and ignores picks outside the Owned versions', () => {
	const versions = planOwned(data, roster, [100101, 100201], course, false);
	expect(planFit(versions, course, 4, new Set(), new Set()).fit.map((v) => v.cardId)).toEqual([100101, 100201]);
	expect(planFit(versions, course, 4, new Set(), new Set([100201])).fit.map((v) => v.cardId)).toEqual([100201]);
	// A pick that is not Owned does not count as a pick, so nothing narrows.
	expect(planFit(versions, course, 4, new Set(), new Set([999999])).fit.map((v) => v.cardId)).toEqual([100101, 100201]);
	expect(planFit(versions, course, 4, new Set(), new Set([999999, 100101])).fit.map((v) => v.cardId)).toEqual([100101]);
});

it('still leaves out a Viable version that is Unfit, with the Unfit reason', () => {
	const versions = planOwned(data, roster, [100101, 100201], course, false);
	versions[0] = { ...versions[0], aptitudes: { ...apt, dirt: 2 } };
	versions[1] = { ...versions[1], aptitudes: { ...apt, dirt: 7 } };
	const dirtCourse = { ...course!, ground: 2 };
	const split = planFit(versions, dirtCourse, 4, new Set(), new Set([100101, 100201]));
	expect(split.fit.map((v) => v.cardId)).toEqual([100201]);
	expect(split.notSimulated.map((u) => [u.version.cardId, u.reason])).toEqual([[100101, 'Dirt F']]);
});

it('lists non-Viable versions apart as "not Viable", over the Unfit reason, and force-enabling one simulates it', () => {
	const versions = planOwned(data, roster, [100101, 100201], course, false);
	versions[0] = { ...versions[0], aptitudes: { ...apt, dirt: 2 } };
	versions[1] = { ...versions[1], aptitudes: { ...apt, dirt: 7 } };
	const dirtCourse = { ...course!, ground: 2 };
	const viable = new Set([100201]);
	const split = planFit(versions, dirtCourse, 4, new Set(), viable);
	expect(split.fit.map((v) => v.cardId)).toEqual([100201]);
	expect(split.notSimulated.map((u) => [u.version.cardId, u.reason])).toEqual([[100101, 'not Viable']]);
	expect(planFit(versions, dirtCourse, 4, new Set([100101]), viable).fit.map((v) => v.cardId)).toEqual([100101, 100201]);
	// Viable but Unfit keeps the Unfit reason; no pick lists nothing apart for this reason.
	expect(planFit(versions, dirtCourse, 4, new Set(), new Set([100101])).notSimulated.map((u) => [u.version.cardId, u.reason])).toEqual([[100101, 'Dirt F'], [100201, 'not Viable']]);
	expect(planFit(versions, course, 4).notSimulated).toEqual([]);
	expect(planFit(versions, course, 4, new Set(), new Set([999999])).notSimulated).toEqual([]);
});

it('builds the chart rows of one Ace hero on request, the same as the ranking builds them when it is the top hero', () => {
	// Both versions carry a unique skill the sim knows, so their rows are not empty lists that compare equal by accident.
	const owned = planOwned(data, roster, [100101, 100201], course, false).map((v) => ({ ...v, uniqueSkillId: '10071' }));
	const job = planRecommend(data, planCandidates(data, roster, ace, course, false), cm, { course, owned }).job!;
	job.preset.samples = 5;
	const rec = runJob({ kind: 'recommend', job }, () => {}) as Recommendation;
	const [top, other] = rec.aceSlots;
	expect(top.skills.length).toBeGreaterThan(0);
	expect(other.skills).toEqual([]); // the ranking builds no rows for heroes nobody opened
	const rows = (cardId: number) => runJob({ kind: 'aceRows', job: aceRowsJob(job, cardId)! }, () => {}) as AceSkillRow[];
	expect(rows(top.cardId)).toEqual(top.skills);
	const alone = runJob({ kind: 'recommend', job: { ...job, owned: owned.filter((v) => v.cardId === other.cardId) } }, () => {}) as Recommendation;
	expect(alone.aceSlots[0].skills.length).toBeGreaterThan(0);
	expect(rows(other.cardId)).toEqual(alone.aceSlots[0].skills);
	expect(aceRowsJob(job, 1)).toBeNull();
});

it('an Unfit version stays out of the Ace slots unless forced, then competes with the fit ones', () => {
	const versions = planOwned(data, roster, [100101, 100201], course, false).map((v) => ({ ...v, uniqueSkillId: '10071' }));
	const dirtCourse = { ...course!, ground: 2, distance: 1600 };
	versions[0] = { ...versions[0], aptitudes: { ...apt, dirt: 7, mile: 7 } };
	versions[1] = { ...versions[1], aptitudes: { ...apt, dirt: 2, mile: 7 } };
	const slots = (forced: Set<number>) => {
		const job = planRecommend(data, planCandidates(data, roster, ace, dirtCourse, false), cm, { course: dirtCourse, owned: planFit(versions, dirtCourse, 4, forced).fit }).job!;
		job.preset.samples = 5;
		return (runJob({ kind: 'recommend', job }, () => {}) as Recommendation).aceSlots.map((s) => s.cardId);
	};
	expect(slots(new Set())).toEqual([100101]);
	expect(slots(new Set([100201])).sort()).toEqual([100101, 100201]);
});

it('builds Skill point costs from the game data for purchasable skills only, ids as strings', () => {
	const skills = new Map([
		[1, { id: 1, groupId: 10, rarity: 1, spCost: 90 }],
		[2, { id: 2, groupId: 10, rarity: 2, spCost: 180, replacesId: 1 }],
		[3, { id: 3, groupId: 11, rarity: 1, purchasable: false }],
		[4, { id: 4, groupId: 12, rarity: 3 }],
	] as [number, Skill][]);
	expect(skillCostsOf(skills.values())).toEqual({ '1': { cost: 90, group: 10 }, '2': { cost: 180, group: 10, replacesId: '1' } });
});

it('passes the Skill point budget into the preset; no budget means unlimited', () => {
	const candidates = planCandidates(data, roster, ace, course, false);
	const plan = (skillPointBudget?: number | null) => planRecommend(data, candidates, cm, { card: ace, course, styleChoice: 'senko', skillPointBudget }).job!.preset.skillPoints;
	expect(plan(null)).toBeUndefined();
	expect(plan()).toBeUndefined();
	expect(plan(2700)?.budget).toBe(2700);
	expect(plan(2700)?.costs).toEqual(skillCostsOf(data.skills.values()));
});
