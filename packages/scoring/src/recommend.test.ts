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

test('versions with different uniques are ranked by their own unique skill value on the track', () => {
	const none = { cardId: 3, aptitudes: apt, candidates: [] };
	const slot = (uniques: string[]) => recommend(candidateList, preset, undefined, uniques.map((u, i) => ({ ...none, cardId: i + 1, uniqueSkillId: u }))).aceSlot?.cardId;
	expect(slot(['99999', '10071'])).toBe(2); // 99999 is unknown to the sim, so worth nothing
	expect(slot(['10071', '99999'])).toBe(1);
});

test('a fresh Owned version with no candidates is still eligible, scored by its unique skill, with no parents', () => {
	const slot = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, uniqueSkillId: '10071', candidates: [] }]).aceSlot!;
	expect(slot.cardId).toBe(1);
	expect(slot.parents).toEqual([]);
	expect(slot.score).toBeGreaterThan(0);
});

test('the Ace slot gives the version its best style by aptitude, with 2 parents', () => {
	const slot = recommend(candidateList, preset, undefined, [owned(1, undefined, { ...apt, oikomi: 8 })]).aceSlot!;
	expect(slot.style).toBe('oikomi');
	expect(slot.parents.map((p) => p.candidateId).sort()).toEqual(['p', 'q']);
});

// Version 1 only offers the weak skill 10081 (the Must-have) at high affinity; version 2 offers both skills at no affinity, so more value.
const mustHaveVersion = { cardId: 1, aptitudes: apt, candidates: [cand('m', horseOf(['10081'], { affinity: 100 }), horseOf(), horseOf()), cand('n', horseOf(), horseOf(), horseOf())] };
const valueVersion = { cardId: 2, aptitudes: apt, candidates: [cand('v', horseOf(['10071']), horseOf(), horseOf()), cand('w', horseOf(['10081']), horseOf(), horseOf())] };

test('the Ace with the higher Must-have inheritance chance beats the one with more simulated value', () => {
	const slot = (mustHaves: string[]) => recommend(candidateList, preset, undefined, [valueVersion, mustHaveVersion], mustHaves).aceSlot!;
	expect(slot([]).cardId).toBe(2);
	expect(slot(['10081']).cardId).toBe(1);
	expect(slot(['10081']).parents.map((p) => p.candidateId)[0]).toBe('m');
});

test('equal Must-have chance falls back to simulated value', () => {
	expect(recommend(candidateList, preset, undefined, [mustHaveVersion, valueVersion], ['99999']).aceSlot!.cardId).toBe(2);
});

test('no Owned versions means no Ace slot', () => {
	expect(recommend(candidateList, preset).aceSlot).toBeNull();
});

// Parent units: each is a parent plus its own 2 grandparents, chosen together.
function unit(id: string, skills: string[], o: Partial<LineageHorse> = {}) { return cand(id, horseOf(skills, o), horseOf(), horseOf()); }
function pairIds(cs: Candidate[], mustHaves: string[] = []) { return recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, candidates: cs }], mustHaves).aceSlot!.parents.map((p) => p.candidateId).sort(); }

test('the Ace slot picks the best pair of parents, not the two best alone', () => {
	// Each unit alone is equally good, so a greedy pick takes the first two (a, b); only b and c together double up on one Must-have.
	expect(pairIds([unit('a', ['10071'], { affinity: 100 }), unit('b', ['10081'], { affinity: 100 }), unit('c', ['10081'], { affinity: 100 })], ['10081', '10071'])).toEqual(['b', 'c']);
});

test('grandparents are never picked apart from their parent', () => {
	expect(pairIds([cand('g', horseOf(), horseOf(['10081'], { affinity: 100 }), horseOf()), unit('h', []), unit('i', [])], ['10081'])).toContain('g');
});

test('Must-have chances differing only by float noise still fall to simulated value', () => {
	expect(pairIds([unit('a1', ['10081'], { affinity: 0.1 + 0.2 }), unit('a2', ['10081'], { affinity: 0.3 }), unit('v', ['10071'])], ['10081'])).toEqual(['a1', 'a2']);
});

test('same seed and samples give identical output', () => {
	expect(recommend(candidateList, preset)).toEqual(recommend(candidateList, preset));
});

test('a hard-to-train Ace (low aptitudes) still gets every veteran listed in all three modes', () => {
	const poor = { ...preset, runner: { ...horse, distanceAptitude: 'G', strategyAptitude: 'G' } };
	const out = recommend(candidateList, poor, { S10071: 'T0' });
	for (const mode of ['ace', 'core', 'side'] as const) expect(out[mode].map((p) => p.candidateId).sort()).toEqual(['a', 'b', 'c']);
});

// The Ace slot ignores dirt: Must-have chance, then simulated value on the selected track.
function ownedWith(cardId: number, aptitudes: typeof apt, mustHave: boolean, dirtStars = 3) { return { cardId, aptitudes, candidates: [cand('m' + cardId, horseOf(mustHave ? ['10081'] : [], { affinity: 100, dirtStars }), horseOf([], { dirtStars }), horseOf([], { dirtStars })), cand('n' + cardId, horseOf([], { dirtStars }), horseOf([], { dirtStars }), horseOf([], { dirtStars }))] }; }
function pick(vs: ReturnType<typeof ownedWith>[]) { return recommend(candidateList, preset, undefined, vs, ['10081']).aceSlot!.cardId; }

test('the Ace slot ignores dirt aptitude and dirt sparks', () => {
	expect(pick([ownedWith(1, { ...apt, dirt: 1 }, true, 0), ownedWith(2, { ...apt, dirt: 7 }, false, 3)])).toBe(1);
	expect(pick([ownedWith(1, { ...apt, turf: 5, dirt: 7 }, true), ownedWith(2, { ...apt, dirt: 7 }, false)])).toBe(1);
});
