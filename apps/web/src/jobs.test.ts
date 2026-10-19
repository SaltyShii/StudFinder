import { expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { RawGameData } from '../../../packages/lineage/src/types';
import { CMS } from '../../../packages/scoring/src/cm';
import { importRoster } from './roster';
import { compute } from './job';
import { buildJob, buildVeteranJob, type Selection } from './jobs';

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
const sel: Selection = { data, roster, cmId: CMS[0].id, aceId: 100101, style: 'senko', target: {}, useBorrowed: false };

it('builds a Job that the real recommend() accepts', () => {
	const { job, candidates, cardIds } = buildJob(sel);
	expect(candidates).toHaveLength(1);
	expect(cardIds.get('2')).toBe(100201);
	expect(job).not.toBeNull();
	job!.preset.samples = 5;
	const rec = compute(job!);
	expect(rec.ace[0].candidateId).toBe(candidates[0].id);
});

it('has no Job without an Ace', () => {
	expect(buildJob({ ...sel, aceId: null }).job).toBeNull();
});

it('veteran job waits for game data and carries unique skills', () => {
	expect(buildVeteranJob(null, roster, sel.cmId)).toBeNull();
	const vj = buildVeteranJob(data, roster, sel.cmId)!;
	expect(vj.uniqueSkills).toEqual([[100101, 100101]]);
	expect(vj.courseId).toBe(CMS[0].courseId);
});
