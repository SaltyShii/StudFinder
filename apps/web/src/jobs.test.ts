import { expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { Course, RawGameData } from '../../../packages/lineage/src/types';
import { CMS, pickCm } from '../../../packages/scoring/src/cm';
import type { Candidate } from '../../../packages/scoring/src/shared';
import { importRoster } from './roster';
import { compute } from './job';
import { buildJob, buildVeteranJob, candidatesFor, cardIdsOf, tierListOf } from './jobs';

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
const courses = Object.fromEntries(CMS.map((c) => [c.courseId, { id: c.courseId, trackId: 1, distance: 2000, ground: 1, turn: 1 }]));
const data = new GameData({
	meta: {}, charas: {},
	cards: {
		100101: { id: 100101, charaId: 1001, name: 'Ace', title: 'Test', aptitudes: apt, uniqueSkillId: 100101, skillIds: [] },
		100201: { id: 100201, charaId: 1002, name: 'Stud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [10071] },
	},
	skills: { 10071: { id: 10071, name: 'Synthetic Skill' } }, factors: {
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
const jobFor = (candidates: Candidate[], c: Course | undefined) => buildJob(candidates, cm, ace, c, 'senko', {}, tierListOf(data, 'senko'));

it('builds a Job that the real recommend() accepts', () => {
	const candidates = candidatesFor(data, roster, ace, course, false);
	expect(candidates).toHaveLength(1);
	expect(cardIdsOf(roster).get('2')).toBe(100201);
	const job = jobFor(candidates, course)!;
	job.preset.samples = 5;
	expect(compute(job).ace[0].candidateId).toBe(candidates[0].id);
});

it('has no Job without candidates or a course, but still lists candidates without a course', () => {
	expect(jobFor([], course)).toBeNull();
	expect(jobFor(candidatesFor(data, roster, ace, course, false), undefined)).toBeNull();
	expect(candidatesFor(data, roster, ace, undefined, false)).toHaveLength(1);
});

it('includes borrowed veterans only when asked', () => {
	const withBorrowed = importRoster(JSON.stringify([
		{ trained_chara_id: 1, card_id: 100101, factor_id_array: [1201], succession_chara_array: [{ position_id: 10, card_id: 100201, owner_viewer_id: 777, factor_id_array: [1201, 1202] }] },
	]), data);
	expect(withBorrowed.borrowed).toHaveLength(1);
	expect(candidatesFor(data, withBorrowed, ace, course, true).length).toBeGreaterThan(candidatesFor(data, withBorrowed, ace, course, false).length);
});

it('veteran job waits for game data and carries unique skills', () => {
	expect(buildVeteranJob(null, roster, cm)).toBeNull();
	const vj = buildVeteranJob(data, roster, cm)!;
	expect(vj.uniqueSkills).toEqual([[100101, 100101]]);
	expect(vj.courseId).toBe(cm.courseId);
});
