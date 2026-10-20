import { expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { Course, RawGameData } from '../../../packages/lineage/src/types';
import { CMS, pickCm } from '../../../packages/scoring/src/cm';
import type { Style } from '../../../packages/scoring/src/ace';
import type { Recommendation } from '../../../packages/scoring/src/recommend';
import type { Candidate } from '../../../packages/scoring/src/shared';
import { importRoster } from './roster';
import { cardIdsOf, planCandidates, planRecommend, planVeterans, type TierEdits } from './jobs';
import { runJob } from './runJob';

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
const courses = Object.fromEntries(CMS.map((c) => [c.courseId, { id: c.courseId, trackId: 1, distance: 2000, ground: 1, turn: 1 }]));
const data = new GameData({
	meta: {}, charas: {},
	cards: {
		100101: { id: 100101, charaId: 1001, name: 'Ace', title: 'Test', aptitudes: apt, uniqueSkillId: 100101, skillIds: [] },
		100201: { id: 100201, charaId: 1002, name: 'Stud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [10071] },
	},
	skills: {
		10071: { id: 10071, name: 'Synthetic Skill' },
		20001: { id: 20001, name: 'Late Surger Straightaways', rarity: 1, groupId: 2000, conditions: [{ pre: '', cond: 'running_style==3&phase==2' }] },
		20002: { id: 20002, name: 'End Closer Straightaways', rarity: 1, groupId: 2001, conditions: [{ pre: '', cond: 'running_style==4&phase==2' }] },
		20003: { id: 20003, name: 'Sprint Corners', rarity: 1, groupId: 2002, conditions: [{ pre: '', cond: 'distance_type==1&corner>=1' }] },
		20004: { id: 20004, name: 'Groundwork', rarity: 1, groupId: 2003, conditions: [{ pre: '', cond: 'track_id==10006' }] },
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
const planFor = (candidates: Candidate[], c: Course | undefined, styleChoice: Style | null = 'senko') => planRecommend(data, candidates, cm, ace, c, styleChoice, {});
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
	const coreList = (coreStyle: Style | null, style: Style = 'sashi') => planRecommend(data, candidates, cm, ace, course, style, {}, coreStyle).job!.tierList!;
	expect(coreList(null)).toHaveProperty(['Late Surger Straightaways']);
	expect(coreList(null)).not.toHaveProperty(['End Closer Straightaways']);
	expect(coreList('oikomi')).toHaveProperty(['End Closer Straightaways']);
	expect(coreList(null, 'oikomi')).toHaveProperty(['End Closer Straightaways']);
	expect(coreList('sashi')).not.toHaveProperty(['Sprint Corners']); // distance conditioned
	expect(coreList('sashi')).not.toHaveProperty(['Groundwork']); // track conditioned
});

it('Tier list edits move or disable a skill for the Core loop style only', () => {
	const candidates = planCandidates(data, roster, ace, course, false);
	const list = (edits: TierEdits) => planRecommend(data, candidates, cm, ace, course, 'sashi', {}, null, [], edits).job!.tierList!;
	expect(list({})['Late Surger Straightaways']).toBe('T1.5');
	expect(list({ sashi: { moved: { 'Late Surger Straightaways': 'T5' }, disabled: [] } })['Late Surger Straightaways']).toBe('T5');
	expect(list({ sashi: { moved: {}, disabled: ['Late Surger Straightaways'] } })).not.toHaveProperty(['Late Surger Straightaways']);
	expect(list({ oikomi: { moved: {}, disabled: ['Late Surger Straightaways'] } })['Late Surger Straightaways']).toBe('T1.5'); // another style's edit
});
