import { expect, test } from 'vitest';
import { recommend, type Candidate, type LineageHorse, type CandidateList } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, runner: horse, samples: 30, seed: 7 };
function horseOf(skills: string[] = [], o: Partial<LineageHorse> = {}): LineageHorse { return { affinity: 0, pinkStars: 0, dirtStars: 1, skills: skills.map((skillId) => ({ skillId, name: `S${skillId}`, stars: 3 })), ...o }; }
function cand(id: string, ...horses: LineageHorse[]): Candidate { return { id, name: id, horses }; }
const candidateList: CandidateList = {
	candidates: [
		cand('a', horseOf(['10071'], { pinkStars: 3 })),
		cand('b', horseOf()),
		cand('c', horseOf(['10071', '10071'])),
	],
};

test('Ace ranks veterans by inherited skill value, ignoring pink sparks', () => {
	const { ace } = recommend(candidateList, preset);
	expect(ace[0].score).toBeGreaterThan(ace[ace.length - 1].score);
	expect(ace.map((p) => p.candidateId)).toContain('b');
	expect(ace[0].reason).toMatch(/lengths/);
	const d = ace[0].detail[0];
	expect(d.proc).toBeGreaterThan(0);
	expect(d.lengths.max).toBeGreaterThanOrEqual(d.lengths.min);
	expect(d.assumesPosition).toBe(true); // 10071 has order_rate in its condition
});

test('a skill already in the Ace baseline (its unique skill) is not credited again', () => {
	const withUnique = { ...preset, runner: { ...horse, skills: ['10071'] } };
	expect(recommend({ candidates: [cand('x', horseOf(['10071']))] }, withUnique).ace[0].score).toBe(0);
});

test("the Ace counts the skills of the veteran and of its parents, each once", () => {
	const lineage = cand('v', horseOf(['10071']), horseOf(['10071', '10081']));
	const detail = recommend({ candidates: [lineage] }, preset).ace[0].detail;
	expect(detail.map((d) => d.skillId).sort()).toEqual(['10071', '10081']);
});

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
function owned(cardId: number, uniqueSkillId?: string, aptitudes = apt) { return { cardId, aptitudes, uniqueSkillId, candidates: [cand('p', horseOf(['10071']), horseOf(['10081']), horseOf()), cand('q', horseOf(['10081']), horseOf(), horseOf())] }; }

test('the Ace slot picks the Owned version whose own unique skill leaves the most to inherit', () => {
	expect(recommend(candidateList, preset, undefined, [owned(1, '10071'), owned(2)]).aceSlot?.cardId).toBe(2);
	expect(recommend(candidateList, preset, undefined, [owned(2), owned(1, '10071')]).aceSlot?.cardId).toBe(2);
});

test('the Ace slot gives the version its best style by aptitude, with 2 parents', () => {
	const slot = recommend(candidateList, preset, undefined, [owned(1, undefined, { ...apt, oikomi: 8 })]).aceSlot!;
	expect(slot.style).toBe('oikomi');
	expect(slot.parents.map((p) => p.candidateId).sort()).toEqual(['p', 'q']);
});

test('no Owned versions means no Ace slot', () => {
	expect(recommend(candidateList, preset).aceSlot).toBeNull();
});

test('same seed and samples give identical output', () => {
	expect(recommend(candidateList, preset)).toEqual(recommend(candidateList, preset));
});

test('a hard-to-train Ace (low aptitudes) still gets every veteran listed in all three modes', () => {
	const poor = { ...preset, runner: { ...horse, distanceAptitude: 'G', strategyAptitude: 'G' } };
	const out = recommend(candidateList, poor, { S10071: 'T0' });
	for (const mode of ['ace', 'core', 'side'] as const) expect(out[mode].map((p) => p.candidateId).sort()).toEqual(['a', 'b', 'c']);
});
