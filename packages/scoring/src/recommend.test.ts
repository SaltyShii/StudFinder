import { describe, expect, test } from 'vitest';
import { wholeAceRuns, wholeAceSeeds } from './wholeAce';
import { skillDetail } from './skillDetail';
import { DEFAULT_ASSUMPTIONS } from './assumptions';
import { skillChance } from './shared';
import { sideLoopPicks, sideLoopPriority } from './sideLoop';
import { bestPair, bestPairs, recommend, recommendAsync, simulateRequest, type SimResult, type Candidate, type LineageHorse, type CandidateList } from './recommend';

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
	expect(ace[0].reason).toMatch(/inheritable/);
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

test('skill detail carries the activation spots and effect duration of the runs it was valued on', () => {
	const list = { candidates: [cand('r', horseOf(['10071', '210051']))] };
	const detail = recommend(list, preset).ace[0].detail;
	const fixed = detail.find((d) => d.skillId === '10071')!; // fires at 50% of the course
	const random = detail.find((d) => d.skillId === '210051')!; // random spot in the opening phase
	for (const d of [fixed, random]) {
		expect(d.spots).toHaveLength(Math.round((d.proc / 100) * 30));
		expect(d.duration).toBeGreaterThan(0);
		expect(d.spotSpread.min).toBeLessThanOrEqual(d.spotSpread.median);
		expect(d.spotSpread.median).toBeLessThanOrEqual(d.spotSpread.max);
	}
	expect(fixed.spotSpread.max - fixed.spotSpread.min).toBeLessThan(5);
	expect(random.spotSpread.max - random.spotSpread.min).toBeGreaterThan(50);
});

test('a skill that never fires has no activation spots', () => {
	const d = skillDetail('99999', { courseId: 10101, horse, samples: 10, seed: 7 });
	expect(d.spots).toEqual([]);
	expect(d.duration).toBe(0);
});

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
function owned(cardId: number, uniqueSkillId?: string, aptitudes = apt) { return { cardId, aptitudes, uniqueSkillId, candidates: [cand('p', horseOf(['10071']), horseOf(['10081']), horseOf()), cand('q', horseOf(['10081']), horseOf(), horseOf())] }; }

test('versions with different uniques are ranked by their own unique skill value on the track', () => {
	const none = { cardId: 3, aptitudes: apt, candidates: [] };
	const slot = (uniques: string[]) => recommend(candidateList, preset, undefined, uniques.map((u, i) => ({ ...none, cardId: i + 1, uniqueSkillId: u }))).aceSlots[0]?.cardId;
	expect(slot(['99999', '10071'])).toBe(2); // 99999 is unknown to the sim, so worth nothing
	expect(slot(['10071', '99999'])).toBe(1);
});

test('a fresh Owned version with no candidates is still eligible, scored by its unique skill, with no parents', () => {
	const slot = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, uniqueSkillId: '10071', candidates: [] }]).aceSlots[0];
	expect(slot.cardId).toBe(1);
	expect(slot.parents).toEqual([]);
	expect(slot.score).toBeGreaterThan(0);
});

test('the Ace slot runs in a style the version has A in, with 2 parents, whatever the Sim runner runs', () => {
	const versions = [owned(1, undefined, { ...apt, oikomi: 8 })];
	const slot = recommend(candidateList, { ...preset, runner: { ...horse, strategy: 'Nige' } }, undefined, versions).aceSlots[0];
	expect(['senko', 'oikomi']).toContain(slot.style); // Nige is C, never picked
	expect(slot.parents.map((p) => p.candidateId).sort()).toEqual(['p', 'q']);
});

// Version 1 only offers the weak skill 10081 (the Must-have) at high affinity; version 2 offers both skills at no affinity, so more value.
const mustHaveVersion = { cardId: 1, aptitudes: apt, candidates: [cand('m', horseOf(['10081'], { affinity: 100 }), horseOf(), horseOf()), cand('n', horseOf(), horseOf(), horseOf())] };
const valueVersion = { cardId: 2, aptitudes: apt, candidates: [cand('v', horseOf(['10071']), horseOf(), horseOf()), cand('w', horseOf(['10081']), horseOf(), horseOf())] };

test('Must-haves no longer change the Ace order: the Ace with more expected lengths wins', () => {
	const slot = (mustHaves: string[]) => recommend(candidateList, preset, undefined, [valueVersion, mustHaveVersion], mustHaves).aceSlots[0];
	expect(slot([]).cardId).toBe(2);
	expect(slot(['10081']).cardId).toBe(2);
});

test('the Ace pick carries its expected lengths gained and the sparks of every horse in its lineage', () => {
	const slot = recommend(candidateList, preset, undefined, [valueVersion]).aceSlots[0];
	expect(slot.expectedLengths).toBe(slot.score);
	expect(slot.expectedLengths).toBeGreaterThan(0);
	expect(slot.horses).toHaveLength(2);
	expect(slot.horses.every((h) => h.length === 3)).toBe(true);
});

const allA = { ...apt, short: 7, mile: 7, middle: 7, long: 7 };
function pinkPair(o: Partial<LineageHorse>) { return [unit('q', []), unit('r', []), unit('pink', [], o)]; }
function aceParents(cs: Candidate[], aptitudes = allA, mustHaves: string[] = []) { return recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes, candidates: cs }], mustHaves).aceSlots[0].parents.map((p) => p.candidateId).sort(); }

test('of two pairs equal on skills, the one with distance pink sparks ranks first, also for a version already at A', () => {
	expect(aceParents(pinkPair({ pinkStars: 3, affinity: 100 }))).toContain('pink');
});

test('surface pink sparks count the same way', () => {
	expect(aceParents(pinkPair({ turfStars: 3, affinity: 100 }))).toContain('pink');
});

test('dirt pink sparks do not count on a turf course', () => {
	expect(aceParents(pinkPair({ dirtStars: 3, affinity: 100 }))).toEqual(['q', 'r']);
});

test('a pair with pink sparks that can raise the Ace to S has more expected lengths than one without', () => {
	const score = (cs: Candidate[]) => recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: allA, candidates: cs }]).aceSlots[0].score;
	expect(score([unit('q', []), unit('p', [], { pinkStars: 3, affinity: 100 })])).toBeGreaterThan(score([unit('q', []), unit('r', [])]));
});

test('no Owned versions means no Ace slot', () => {
	expect(recommend(candidateList, preset).aceSlots).toEqual([]);
});

// Parent units: each is a parent plus its own 2 grandparents, chosen together.
function unit(id: string, skills: string[], o: Partial<LineageHorse> = {}) { return cand(id, horseOf(skills, o), horseOf(), horseOf()); }
function pairIds(cs: Candidate[], mustHaves: string[] = []) { return recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, candidates: cs }], mustHaves).aceSlots[0].parents.map((p) => p.candidateId).sort(); }

test('the Ace slot picks the best pair of parents, not the two best alone', () => {
	// Units b and c carry the same skill, so the pair (a, b) covers more than (b, c).
	const sure = { affinity: 1e6 }; // every spark procs, so the Whole-Ace runs agree with the coverage
	expect(pairIds([unit('b', ['10081'], sure), unit('c', ['10081'], sure), unit('a', ['10071'], sure)])).toEqual(['a', 'b']);
});

test('grandparents are never picked apart from their parent', () => {
	expect(pairIds([cand('g', horseOf(), horseOf(['10081'], { affinity: 100 }), horseOf()), unit('h', []), unit('i', [])], ['10081'])).toContain('g');
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
function pick(vs: ReturnType<typeof ownedWith>[]) { return recommend(candidateList, preset, undefined, vs, ['10081']).aceSlots[0].cardId; }

test('the Ace slot ignores dirt aptitude and dirt sparks', () => {
	expect(pick([ownedWith(1, { ...apt, dirt: 1 }, true, 0), ownedWith(2, { ...apt, dirt: 7 }, false, 3)])).toBe(1);
	expect(pick([ownedWith(1, { ...apt, turf: 5, dirt: 7 }, true), ownedWith(2, { ...apt, dirt: 7 }, false)])).toBe(1);
});

test('the Side loop and Core loop rank the Loop versions, the Ace slot the Owned versions', () => {
	const aceVersion = ownedWith(1, apt, true);
	const loopVersion = ownedWith(2, apt, true);
	const rec = recommend(candidateList, preset, { S10071: 'T0' }, [aceVersion], ['10081'], undefined, [loopVersion]);
	expect(rec.aceSlots[0].cardId).toBe(1);
	expect(rec.sideSlots.map((s) => s.cardId)).toEqual([2]);
	expect(rec.coreSlots.map((s) => s.cardId)).toEqual([2]);
	expect(recommend(candidateList, preset, { S10071: 'T0' }, [aceVersion], ['10081'], undefined, []).sideSlots).toEqual([]);
});

test('the Core loop version comes from the Loop versions, and an empty pick means none', () => {
	// A Dirt A core version gates on the candidate's own dirt sparks; without one, partial-dirt lineages only count when no full-dirt one exists.
	const strong = ownedWith(1, { ...apt, dirt: 7 }, false);
	const weak = ownedWith(2, { ...apt, dirt: 1 }, false);
	const dirtList: CandidateList = { candidates: [cand('full', horseOf([], { dirtStars: 3 }), horseOf([], { dirtStars: 3 }), horseOf([], { dirtStars: 3 })), cand('partial', horseOf([], { dirtStars: 3 }), horseOf([], { dirtStars: 0 }), horseOf([], { dirtStars: 0 }))] };
	const core = (owned: ReturnType<typeof ownedWith>[], loop?: ReturnType<typeof ownedWith>[]) => recommend(dirtList, preset, { S10071: 'T0' }, owned, [], undefined, loop).core.map((p) => p.candidateId).sort();
	// The Ace list has only the weak version, the Loop versions only the strong one.
	expect(core([weak], [strong])).toEqual(['full', 'partial']);
	expect(core([strong], [weak])).toEqual(['full']);
	expect(core([strong], [])).toEqual(['full']);
});

test('skills are screened at few samples, but every shown skill is re-simulated at full samples', () => {
	const phases: string[] = [];
	const full = { ...preset, samples: 60 };
	const rec = recommend(candidateList, full, undefined, [owned(1), owned(2)], [], (p) => phases.push(p.phase));
	const shown = [...rec.ace, ...(rec.aceSlots[0]?.parents ?? [])].flatMap((p) => p.detail);
	expect(shown.length).toBeGreaterThan(0);
	expect(shown.every((d) => !d.screened)).toBe(true);
	expect(phases).toContain('screen');
	expect(phases).toContain('refine');
	// the shown value is the full-sample one, not the screening one
	const d = shown[0];
	expect(d.value).toBe(skillDetail(d.skillId, { courseId: full.courseId, horse: full.runner, samples: 60, seed: full.seed }).value);
});

test('a Sim assumption reaches every slot: wit checks lower the proc and value of a white skill for a low-wit runner', () => {
	const weak = { ...preset, runner: { ...horse, wisdom: 100 } };
	const list: CandidateList = { candidates: [cand('w', horseOf(['200342']), horseOf(), horseOf())] };
	const versions = [{ cardId: 1, aptitudes: apt, candidates: list.candidates }];
	const run = (witCheck: boolean) => recommend(list, { ...weak, assumptions: { ...DEFAULT_ASSUMPTIONS, witCheck } }, undefined, versions, ['200342']);
	const [off, on] = [run(false), run(true)];
	expect(on.skills[0].proc).toBeLessThan(off.skills[0].proc);
	expect(on.ace[0].score).toBeLessThan(off.ace[0].score);
	expect(on.aceSlots[0].score).toBeLessThan(off.aceSlots[0].score);
	expect(on.sideSlots[0].score).not.toBe(off.sideSlots[0].score);
});

test('the recommendation carries the Track overview of the selected course with the Baseline runner curve', () => {
	const { track } = recommend(candidateList, preset);
	expect(track.distance).toBeGreaterThan(0);
	expect(track.curve.length).toBeGreaterThan(10);
	expect(track.phases).toHaveLength(4);
});

// Combined Ace rows: her own skills plus everything either recommended lineage can pass on.
function aceRows(cs: Candidate[], mustHaves: string[] = [], uniqueSkillId?: string) { return recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, uniqueSkillId, candidates: cs }], mustHaves).aceSlots[0].skills; }

test('a skill both lineages can pass shows the combined inherit chance', () => {
	const rows = aceRows([unit('a', ['10071'], { affinity: 100 }), unit('b', ['10071'], { affinity: 10 })]);
	const row = rows.find((r) => r.skillId === '10071')!;
	const a = skillChance([horseOf(['10071'], { affinity: 100 })], '10071');
	const b = skillChance([horseOf(['10071'], { affinity: 10 })], '10071');
	expect(a).toBeGreaterThan(b);
	expect(row.inherit).toBeCloseTo(1 - (1 - a) * (1 - b), 9);
	expect(row.proc).toBeGreaterThan(0);
});

test('the Ace own unique skill is a row with a certain inherit', () => {
	const row = aceRows([unit('a', []), unit('b', [])], [], '10071').find((r) => r.skillId === '10071')!;
	expect(row.inherit).toBe(1);
});

test('rows sort by avg lengths gained, flag Must-haves, and hide zero-value skills except position-conditioned ones', () => {
	const rows = aceRows([unit('a', ['10071', '99999'], { affinity: 100 }), unit('b', ['10081'], { affinity: 100 })], ['10081']);
	expect(rows.map((r) => r.skillId)).not.toContain('99999'); // unknown to the sim: proc 0
	for (const r of rows) if (!r.assumesPosition) expect(r.proc > 0 && r.lengths.median !== 0).toBe(true);
	expect(rows.find((r) => r.skillId === '10081')!.mustHave).toBe(true);
	expect(rows.find((r) => r.skillId === '10071')!.mustHave).toBe(false);
	expect(rows.map((r) => r.lengths.avg)).toEqual([...rows.map((r) => r.lengths.avg)].sort((x, y) => y - x));
	expect(rows.find((r) => r.skillId === '10071')!.assumesPosition).toBe(true); // stays, to be greyed with *
});

// The version's own learnable skills: the Ace can buy them, so they show as certain rows.
function aceRowsWithLearnable(cs: Candidate[], learnableSkillIds: string[], mustHaves: string[] = [], uniqueSkillId?: string) { return recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, uniqueSkillId, learnableSkillIds, candidates: cs }], mustHaves).aceSlots[0].skills; }

test('a learnable skill is an own row (certain, Must-have flagged); one a parent can pass on shows its inherit chance instead', () => {
	const rows = aceRowsWithLearnable([unit('a', ['10071'], { affinity: 100 }), unit('b', [])], ['10071', '10081'], ['10081']);
	const carried = rows.filter((r) => r.skillId === '10071');
	expect(carried).toHaveLength(1);
	expect(carried[0].own).toBe(false);
	expect(carried[0].inherit).toBeLessThan(1);
	const bought = rows.filter((r) => r.skillId === '10081');
	expect(bought).toHaveLength(1);
	expect(bought[0].own).toBe(true);
	expect(bought[0].inherit).toBe(1);
	expect(bought[0].mustHave).toBe(true);
	expect(rows.map((r) => r.lengths.avg)).toEqual([...rows.map((r) => r.lengths.avg)].sort((x, y) => y - x));
});

test('buyable skills off the card list and off every parent are Other rows, apart from the rest', () => {
	const rec = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, learnableSkillIds: ['10071'], otherSkillIds: ['10071', '10081'], candidates: [unit('a', []), unit('b', [])] }]);
	const rows = rec.aceSlots[0].skills;
	expect(rows.find((r) => r.skillId === '10081')).toMatchObject({ other: true, own: false });
	expect(rows.filter((r) => r.skillId === '10071')).toHaveLength(1);
	expect(rows.find((r) => r.skillId === '10071')!.other).toBeUndefined();
});

test('an Owned version with no learnable skills keeps the inherited rows', () => {
	const row = aceRowsWithLearnable([unit('a', ['10071'], { affinity: 100 }), unit('b', [])], []).find((r) => r.skillId === '10071')!;
	expect(row.inherit).toBeLessThan(1);
});

test('a learnable skill the Ace cannot meet the conditions of is not even simulated', () => {
	const sims = (learnableSkillIds: string[]) => { let n = 0; recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, learnableSkillIds, candidates: [unit('a', []), unit('b', [])] }], [], () => { n++; }); return n; };
	expect(sims(['201672'])).toBe(sims([])); // dirt only, on a turf course
	expect(sims(['200162'])).toBeGreaterThan(sims([]));
});

test('only the Ace slot version has its learnable skills simulated', () => {
	const sims = (versions: number, learnableSkillIds: string[]) => { let n = 0; recommend(candidateList, preset, undefined, Array.from({ length: versions }, (_, i) => ({ cardId: i + 1, aptitudes: { ...apt, mile: i + 1 }, learnableSkillIds, candidates: [unit('a', []), unit('b', [])] })), [], () => { n++; }); return n; };
	const extra = (versions: number) => sims(versions, ['200162']) - sims(versions, []);
	expect(extra(1)).toBeGreaterThan(0);
	expect(extra(3)).toBe(extra(1));
});

// Side loop chart rows: the picked lineage's Must-have skills plus its best simulated skills; the ranking itself never reads them.
const sideVersion = { cardId: 1, aptitudes: apt, candidates: [unit('a', ['10081'], { affinity: 100 }), unit('b', ['10071'], { affinity: 100 }), unit('c', ['10071', '10081'], { affinity: 10 }), unit('d', [])] };

test('a Side loop lineage carries chart rows: its Must-have skills flagged, plus the best simulated skills, with the lineage inherit chance', () => {
	const slot = recommend(candidateList, preset, undefined, [sideVersion], ['10081']).sideSlots[0];
	const carried = new Set(slot.parents.flatMap((p) => sideVersion.candidates.find((c) => c.id === p.candidateId)!.horses.flatMap((h) => h.skills.map((s) => s.skillId))));
	expect(slot.skills.length).toBeGreaterThan(0);
	for (const r of slot.skills) expect(carried.has(r.skillId)).toBe(true);
	const must = slot.skills.find((r) => r.skillId === '10081')!;
	expect(must.mustHave).toBe(true);
	const horses = slot.parents.flatMap((p) => sideVersion.candidates.find((c) => c.id === p.candidateId)!.horses);
	expect(must.inherit).toBeCloseTo(skillChance(horses, '10081'), 9);
	expect(slot.skills.filter((r) => r.skillId !== '10081').every((r) => !r.mustHave)).toBe(true);
	expect(slot.skills.map((r) => r.lengths.avg)).toEqual([...slot.skills.map((r) => r.lengths.avg)].sort((x, y) => y - x));
	expect(slot.skills.every((r) => !r.screened)).toBe(true);
});

test('Side loop chart rows leave the ranking untouched: spark % of the Must-haves first, simulated value only breaks ties', () => {
	const versions = [{ cardId: 1, aptitudes: apt, candidates: sideVersion.candidates }, { cardId: 2, aptitudes: apt, candidates: [unit('v', ['10071']), unit('w', ['10071'], { affinity: 100 })] }, { cardId: 3, aptitudes: apt, candidates: [unit('x', ['10081'], { affinity: 100 }), unit('y', ['10081'], { affinity: 100 })] }];
	const slots = recommend(candidateList, preset, undefined, versions, ['10081']).sideSlots;
	// Reference order: the same lineages ranked by sideLoopPriority, then score, built without the chart rows.
	const priority = (s: typeof slots[number]) => sideLoopPriority(s.parents.flatMap((p) => versions.find((v) => v.cardId === s.cardId)!.candidates.find((c) => c.id === p.candidateId)!.horses), ['10081']);
	expect(slots.map((s) => s.cardId)).toEqual([3, 1, 2]);
	for (let i = 1; i < slots.length; i++) expect(priority(slots[i - 1])).toBeGreaterThanOrEqual(priority(slots[i]));
	// the lineage picks match the plain Side loop ranking over the same candidates
	const plain = sideLoopPicks(versions[0].candidates, (id) => skillDetail(id, { courseId: preset.courseId, horse, samples: preset.samples, seed: preset.seed }), 2, [], ['10081']);
	expect(slots.find((s) => s.cardId === 1)!.parents.map((p) => p.candidateId)).toEqual(plain.map((p) => p.candidateId));
});

test('recommendAsync, with the refine step simulated apart and out of order, gives the very recommendation and progress of recommend', async () => {
	const lineage = { candidates: [cand('v', horseOf(['10071', '10081']), horseOf(['10091']))] };
	const serial: unknown[] = [];
	const apart: unknown[] = [];
	const expected = recommend(lineage, preset, undefined, [], [], (p) => serial.push(p));
	let batches = 0;
	const got = await recommendAsync(async (batch) => {
		batches++;
		const out = [];
		for (const r of [...batch.requests].reverse()) { out.unshift(simulateRequest(r, batch.scenario)); batch.progress(out.length); }
		return out;
	}, lineage, preset, undefined, [], [], (p) => apart.push(p));
	expect(batches).toBeGreaterThan(1); // the screen step, then the refine step
	expect(got).toEqual(expected);
	expect(apart).toEqual(serial);
});

test('bestPair picks the very pair ranking every pair would, ties to the earliest, with negative values too', () => {
	let seed = 12345;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
	for (let round = 0; round < 40; round++) {
		const units = Array.from({ length: 12 }, (_, i) => cand(`u${i}`, horseOf()));
		const solo = new Map(units.map((u) => [u, (next() % 9) - 3])); // small integers: many ties; some negative
		// The first parent counts in full, the second only half of its solo value (also when negative, where that is more).
		const rank = (cs: Candidate[]) => { const [a, b] = [...cs].sort((x, y) => solo.get(y)! - solo.get(x)! || x.id.localeCompare(y.id)); return [a, b].filter(Boolean).map((c, i) => ({ candidateId: c.id, score: solo.get(c)! * (i ? 0.5 : 1), reason: '', detail: [] })); };
		const pairs: Candidate[][] = [];
		for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i], units[j]]);
		const all = pairs.map((p) => { const parents = rank(p); return { parents, score: 2 + parents.reduce((s, x) => s + x.score, 0) }; });
		const expected = all.reduce((a, b) => (b.score > a.score ? b : a));
		const { parents, score } = bestPair(pairs, rank, (c) => Math.max(0, solo.get(c)!), 2, () => false);
		expect({ parents, score }).toEqual(expected);
	}
});

test('bestPairs returns the very top N pairs exhaustive ranking would, best first, ties to the earliest', () => {
	let seed = 4242;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
	for (let round = 0; round < 30; round++) {
		const units = Array.from({ length: 9 }, (_, i) => cand(`u${i}`, horseOf()));
		const solo = new Map(units.map((u) => [u, (next() % 7) - 2]));
		const rank = (cs: Candidate[]) => [...cs].sort((x, y) => solo.get(y)! - solo.get(x)! || x.id.localeCompare(y.id)).map((c, i) => ({ candidateId: c.id, score: solo.get(c)! * (i ? 0.5 : 1), reason: '', detail: [] }));
		const pairs: Candidate[][] = [];
		for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i], units[j]]);
		const all = pairs.map((p, i) => ({ i, parents: rank(p), score: 1 + rank(p).reduce((s, x) => s + x.score, 0) }));
		const expected = [...all].sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 10).map(({ parents, score }) => ({ parents, score }));
		const got = bestPairs(pairs, rank, (c) => Math.max(0, solo.get(c)!), 1, () => false, 10).map(({ parents, score }) => ({ parents, score }));
		expect(got).toEqual(expected);
	}
});

test('bestPair with a pair-dependent extra picks the very pair exhaustive ranking would', () => {
	let seed = 777;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
	for (let round = 0; round < 40; round++) {
		const units = Array.from({ length: 10 }, (_, i) => cand(`u${i}`, horseOf()));
		const solo = new Map(units.map((u) => [u, (next() % 7) - 2]));
		// Own lengths of a pair (like pink sparks lifting an aptitude) depend on both parents.
		const extra = new Map<string, number>();
		const extraOf = (p: Candidate[]) => { const k = p.map((c) => c.id).join(); if (!extra.has(k)) extra.set(k, (next() % 5) / 2); return extra.get(k)!; };
		const rank = (cs: Candidate[]) => [...cs].sort((x, y) => solo.get(y)! - solo.get(x)! || x.id.localeCompare(y.id)).map((c, i) => ({ candidateId: c.id, score: solo.get(c)! * (i ? 0.5 : 1), reason: '', detail: [] }));
		const pairs: Candidate[][] = [];
		for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i], units[j]]);
		const all = pairs.map((p) => { const parents = rank(p); return { parents, score: extraOf(p) + parents.reduce((s, x) => s + x.score, 0) }; });
		const expected = all.reduce((a, b) => (b.score > a.score ? b : a));
		const { parents, score } = bestPair(pairs, rank, (c) => Math.max(0, solo.get(c)!), extraOf, () => false);
		expect({ parents, score }).toEqual(expected);
	}
});

test('the Ace slots list up to 5 versions in the Ace order; the first is the single best Ace with its chart rows', () => {
	const versions = Array.from({ length: 12 }, (_, i) => ({ cardId: i + 1, aptitudes: apt, uniqueSkillId: i === 7 ? '10071' : undefined, candidates: [] }));
	const rec = recommend(candidateList, preset, undefined, versions);
	expect(rec.aceSlots).toHaveLength(5);
	expect(rec.aceSlots[0].cardId).toBe(8); // the only one with a unique skill worth anything
	expect(rec.aceSlots[0].skills.length).toBeGreaterThan(0);
	// Equal scores keep the Owned order.
	expect(rec.aceSlots.slice(1).map((s) => s.cardId)).toEqual([1, 2, 3, 4]);
	expect(rec.aceSlots.slice(1).every((s) => s.skills.length === 0)).toBe(true); // rows are built for the first only
	const single = recommend(candidateList, preset, undefined, [versions[7]]).aceSlots[0];
	expect(rec.aceSlots[0]).toEqual(single);
});

test('a version with no way to distance A is not hidden', () => {
	const short = { ...apt, mile: 1, middle: 1, long: 1, short: 1 };
	const rec = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: short, candidates: [] }, { cardId: 2, aptitudes: { ...apt, short: 7, mile: 7, middle: 7, long: 7 }, candidates: [] }]);
	expect(rec.aceSlots.map((s) => s.cardId).sort()).toEqual([1, 2]);
});

test('the Ace slots sort by score alone: a version below distance A with the higher score ranks first', () => {
	const all = (g: number) => ({ ...apt, short: g, mile: g, middle: g, long: g });
	const rec = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: all(7), candidates: [] }, { cardId: 2, aptitudes: all(6), uniqueSkillId: '10071', candidates: [] }]);
	expect(rec.aceSlots.map((s) => s.cardId)).toEqual([2, 1]);
	expect(rec.aceSlots[0].score).toBeGreaterThan(rec.aceSlots[1].score);
});

test('fewer versions than 5 give fewer rows, with no padding', () => {
	const versions = [1, 2, 3].map((cardId) => ({ cardId, aptitudes: apt, candidates: [] }));
	expect(recommend(candidateList, preset, undefined, versions).aceSlots).toHaveLength(3);
});

describe('Best style', () => {
	const only = (apts: typeof apt) => recommend(candidateList, preset, undefined, [owned(1, undefined, apts)]).aceSlots[0];
	test('a version with A in two styles shows the one with the higher score, whatever the Sim runner runs', () => {
		const both = { ...apt, senko: 7, oikomi: 7, nige: 1, sashi: 1 };
		const senko = only({ ...both, oikomi: 1 });
		const oikomi = only({ ...both, senko: 1 });
		expect(senko.score).not.toBe(oikomi.score); // else the pick below proves nothing
		const better = senko.score > oikomi.score ? senko : oikomi;
		const pick = recommend(candidateList, { ...preset, runner: { ...horse, strategy: 'Nige' } }, undefined, [owned(1, undefined, both)]).aceSlots[0];
		expect(pick.style).toBe(better.style);
	});
	test('each style is scored on its own runs: a version with A in two styles scores the better of the two single-style versions', () => {
		const both = { ...apt, senko: 7, oikomi: 7, nige: 1, sashi: 1 };
		const best = Math.max(only({ ...both, oikomi: 1 }).score, only({ ...both, senko: 1 }).score);
		expect(only(both).score).toBe(best);
	});
	test('a version with A in no style keeps its best aptitude-ranked style', () => {
		const none = { ...apt, nige: 1, senko: 4, sashi: 3, oikomi: 2 };
		expect(only(none).style).toBe('senko');
	});
	test('the pick has no fall-back flag', () => {
		expect('fallback' in only(apt)).toBe(false);
	});
});

describe('Style pink sparks', () => {
	const sure = (id: string, styleStars?: LineageHorse['styleStars']) => cand(id, horseOf([], { affinity: 1e6, dirtStars: 0, ...(styleStars ? { styleStars } : {}) }), horseOf([], { dirtStars: 0 }), horseOf([], { dirtStars: 0 }));
	const weak = { ...apt, nige: 1, senko: 4, sashi: 3, oikomi: 2 }; // no style at A: senko, at D, is the best-ranked
	const slot = (aptitudes: typeof apt, cs: Candidate[]) => recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes, candidates: cs }]).aceSlots[0];
	test('a style pink spark raises the expected lengths when the style is below A', () => {
		expect(slot(weak, [sure('a', { senko: 3 }), sure('b')]).score).toBeGreaterThan(slot(weak, [sure('a'), sure('b')]).score);
	});
	test('a spark for another style does nothing', () => {
		expect(slot(weak, [sure('a', { nige: 3 }), sure('b')]).score).toBe(slot(weak, [sure('a'), sure('b')]).score);
	});
	test('the pick has chance 1 of A when the style is already A, and less when sparks decide it', () => {
		expect(slot(apt, [sure('a', { senko: 3 }), sure('b')]).styleAChance).toBe(1);
		const lowAffinity = cand('a', horseOf([], { affinity: 20, dirtStars: 0, styleStars: { senko: 1 } }), horseOf(), horseOf());
		const chance = slot(weak, [lowAffinity, sure('b')]).styleAChance;
		expect(chance).toBeGreaterThan(0);
		expect(chance).toBeLessThan(1);
		expect(slot(weak, [sure('a'), sure('b')]).styleAChance).toBe(0);
	});
	test('the certain sparks of a pair reach A', () => {
		expect(slot(weak, [sure('a', { senko: 3 }), sure('b', { senko: 3 })]).styleAChance).toBe(1);
	});
	test('recommendAsync gives the same result with style sparks', async () => {
		const v = [{ cardId: 1, aptitudes: weak, candidates: [sure('a', { senko: 3 }), sure('b')] }];
		expect(await recommendAsync(async (batch) => batch.requests.map((r) => simulateRequest(r, batch.scenario)), candidateList, preset, undefined, v)).toEqual(recommend(candidateList, preset, undefined, v));
	});
});

describe('Ace slot scored by Whole-Ace runs', () => {
	const sure = (skills: string[], id = skills.join() || 'none') => cand(id, horseOf(skills, { affinity: 1e6 }), horseOf([], { affinity: 1e6 }), horseOf([], { affinity: 1e6 }));
	const target = { speed: horse.speed, stamina: horse.stamina, power: horse.power, guts: horse.guts, wisdom: horse.wisdom };
	const meanOf = (aptitudes: typeof apt, uniqueSkillId: string | undefined, horses: LineageHorse[]) => wholeAceRuns({
		aptitudes, style: 'senko', scenario: { courseId: preset.courseId }, target, uniqueSkillId, buyableSkillIds: [], horses, seeds: wholeAceSeeds(preset.seed, preset.samples),
	}).mean;
	test('a version without candidates scores its Whole-Ace run mean', () => {
		const slot = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, uniqueSkillId: '10071', candidates: [] }]).aceSlots[0];
		expect(slot.score).toBe(meanOf(apt, '10071', []));
		expect(slot.expectedLengths).toBe(slot.score);
		expect(slot.score).toBeGreaterThan(0);
	});
	test("a version with a pair scores the mean over that pair's lineage", () => {
		const cs = [sure(['10071']), sure(['10081'], 'o')];
		const slot = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, candidates: cs }]).aceSlots[0];
		expect(slot.score).toBe(meanOf(apt, undefined, cs.flatMap((c) => c.horses)));
	});
	test('a skill both lineages carry counts once', () => {
		const score = (candidates: Candidate[]) => recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, candidates }]).aceSlots[0].score;
		const one = score([sure(['10071']), sure([], 'o')]);
		expect(score([sure(['10071']), sure(['10071'], 'o')])).toBeCloseTo(one, 9);
		expect(one).toBeGreaterThan(0);
	});
	test('same inputs give the same output', () => {
		const v = [{ cardId: 1, aptitudes: apt, candidates: [sure(['10071']), sure(['10081'], 'o')] }];
		expect(recommend(candidateList, preset, undefined, v)).toEqual(recommend(candidateList, preset, undefined, v));
	});
	describe('shortlist', () => {
		const skillIds = ['10071', '10081', '10091', '10101', '10111'];
		const units = skillIds.map((id, i) => sure([id], 'u' + i)); // 10 pairs: all are shortlisted
		const screenSeeds = wholeAceSeeds(preset.seed, 20);
		const pairMean = (pair: Candidate[], seeds: number[]) => wholeAceRuns({ aptitudes: apt, style: 'senko', scenario: { courseId: preset.courseId }, target, buyableSkillIds: [], horses: pair.flatMap((c) => c.horses), seeds }).mean;
		test('fewer than 10 pairs are all scored: the shown pair wins the screen by Whole-Ace mean, and is shown at full samples', () => {
			const pairs: Candidate[][] = [];
			for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i], units[j]]);
			const winner = pairs.reduce((a, b) => (pairMean(b, screenSeeds) > pairMean(a, screenSeeds) ? b : a));
			const slot = recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, candidates: units }]).aceSlots[0];
			expect(slot.parents.map((p) => p.candidateId).sort()).toEqual(winner.map((c) => c.id).sort());
			expect(slot.score).toBe(pairMean(winner, wholeAceSeeds(preset.seed, preset.samples)));
		});
		test('recommendAsync runs the Whole-Ace runs as requests of their own kind, out of order, and gives the very recommendation and progress of recommend', async () => {
			const versions = [{ cardId: 1, aptitudes: apt, uniqueSkillId: '10071', candidates: units }, { cardId: 2, aptitudes: apt, candidates: [units[0]] }];
			const serial: unknown[] = [];
			const apart: unknown[] = [];
			const expected = recommend(candidateList, preset, undefined, versions, [], (p) => serial.push(p));
			const kinds: string[] = [];
			const got = await recommendAsync(async (batch) => {
				batch.requests.forEach((r) => kinds.push(r.kind));
				const out: SimResult[] = [];
				for (const r of [...batch.requests].reverse()) { out.unshift(simulateRequest(r, batch.scenario)); batch.progress(out.length); }
				return out;
			}, candidateList, preset, undefined, versions, [], (p) => apart.push(p));
			expect(kinds).toContain('wholeAce');
			expect(got).toEqual(expected);
			expect(apart).toEqual(serial);
		});
		test('with no more samples than the screen takes, no Whole-Ace run is asked twice', async () => {
			const small = { ...preset, samples: 20 };
			const asked: string[] = [];
			await recommendAsync(async (batch) => {
				for (const r of batch.requests) if (r.kind === 'wholeAce') asked.push(JSON.stringify(r.input));
				return batch.requests.map((r) => simulateRequest(r, batch.scenario));
			}, candidateList, small, undefined, [{ cardId: 1, aptitudes: apt, candidates: units }], []);
			expect(asked.length).toBeGreaterThan(0);
			expect(new Set(asked).size).toBe(asked.length);
		});
		test('progress reports the screen and refine phases for the Ace runs', () => {
			const phases = new Set<string>();
			recommend(candidateList, preset, undefined, [{ cardId: 1, aptitudes: apt, candidates: units }], [], (p) => phases.add(p.phase));
			expect([...phases]).toEqual(expect.arrayContaining(['screen', 'refine']));
		});
	});
});
