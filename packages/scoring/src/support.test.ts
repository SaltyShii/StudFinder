import { describe, expect, test } from 'vitest';
import { recommend, recommendAsync, simulateRequest, type Candidate, type CandidateList, type LineageHorse, type OwnedVersion, type SkillCost, type SupportCard, type SupportInput } from './recommend';
import { rollSparks } from './wholeAce';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, runner: horse, samples: 20, seed: 7 };
const apt = { turf: 7, dirt: 1, short: 1, mile: 1, middle: 7, long: 1, nige: 1, senko: 7, sashi: 1, oikomi: 1 };
const none: CandidateList = { candidates: [] };

// What the Ace gains from each skill alone, about: 10071 0.43, 10091 0.39, 200011 0.03 lengths.
const costs: Record<string, SkillCost> = {
	'10071': { cost: 300, group: 1 },
	'200011': { cost: 100, group: 2 },
	'10091': { cost: 250, group: 3 },
	'10081': { cost: 200, group: 4 },
};

function version(learnableSkillIds: string[], candidates: Candidate[] = [], cardId = 1): OwnedVersion {
	return { cardId, aptitudes: apt, learnableSkillIds, candidates };
}
// A frequency this high makes the hint chance per training certain, so with one training a card hints exactly once.
const CERTAIN = 5000;
function card(id: number, pool: string[], over: Partial<SupportCard> = {}): SupportCard {
	return { id, name: `card ${id}`, type: 'speed', pool, hintFrequency: Array(5).fill(CERTAIN), hintLevelBonus: Array(5).fill(0), ...over };
}
function support(own: SupportCard[], borrowed: SupportCard[] = [], over: Partial<SupportInput> = {}): SupportInput {
	return { own: own.map((c) => ({ card: c, limitBreak: 4 })), borrowed: borrowed.map((c) => ({ card: c, limitBreak: 4 })), trainingsPerCard: 1, ...over };
}
function run(v: OwnedVersion[], sup?: SupportInput, budget?: number, list: CandidateList = none) {
	return recommend(list, { ...preset, support: sup, skillPoints: budget === undefined ? undefined : { budget, costs } }, undefined, v);
}
function horseOf(skills: string[], stars = 3): LineageHorse {
	return { affinity: 1e6, pinkStars: 0, dirtStars: 0, skills: skills.map((skillId) => ({ skillId, name: skillId, stars })) };
}
const fillers = [card(21, ['10081']), card(22, ['10111']), card(23, ['200011']), card(24, ['10081']), card(25, ['10111'])];

describe('Support deck', () => {
	test('no shortlist, or two empty ones, gives the result recommend() gave before', () => {
		const v = [version(['10071', '200011'])];
		const base = run(v);
		expect(run(v, { own: [], borrowed: [] })).toEqual(base);
		expect(run(v, undefined)).toEqual(base);
		expect(base.aceSlots[0].deck).toBeUndefined();
	});
	test('a deck hinting a strong skill lifts the Ace over one without', () => {
		const v = [version(['200011'])];
		const without = run(v, support(fillers)).aceSlots[0].score;
		const strong = run(v, support([card(1, ['10071']), ...fillers.slice(1)])).aceSlots[0].score;
		expect(strong).toBeGreaterThan(without);
	});
	test('the deck holds the 5 best own cards and exactly 1 borrowed card', () => {
		const useless = card(30, ['99999']);
		const own = [useless, card(1, ['10071']), card(2, ['10091']), card(3, ['200011']), card(4, ['10081']), card(5, ['10111'])];
		const borrowed = [card(40, ['99999']), card(41, ['10071']), card(42, ['200011'])];
		const deck = run([version([])], support(own, borrowed)).aceSlots[0].deck!;
		expect(deck.own.map((p) => p.card.id).sort()).toEqual([1, 2, 3, 4, 5]);
		expect(deck.borrowed?.card.id).toBe(41);
		expect(deck.notes).toEqual([]);
	});
	test('a deck with no borrowed shortlist is own cards only, with a note', () => {
		const deck = run([version([])], support([card(1, ['10071']), ...fillers])).aceSlots[0].deck!;
		expect(deck.borrowed).toBeUndefined();
		expect(deck.own).toHaveLength(5);
		expect(deck.notes).toHaveLength(1);
		expect(deck.notes[0]).toMatch(/Borrowed support card/);
	});
	test('a short own shortlist gives a shorter deck and a note, a borrowed-only shortlist still gets its card', () => {
		const deck = run([version([])], support([card(1, ['10071'])], [card(41, ['10091'])])).aceSlots[0].deck!;
		expect(deck.own).toHaveLength(1);
		expect(deck.borrowed?.card.id).toBe(41);
		expect(deck.notes.join()).toMatch(/own/);
	});
	test('a hinted off-list skill becomes buyable and respects the Skill point budget', () => {
		const v = [version([])];
		const sup = support([card(1, ['10071'])]); // one hint: Hint level 1, 300 -> 270 SP
		expect(run(v, sup).aceSlots[0].score).toBeGreaterThan(0);
		expect(run(v, sup, 269).aceSlots[0].score).toBe(0);
		expect(run(v, sup, 270).aceSlots[0].score).toBe(run(v, sup).aceSlots[0].score);
		expect(run(v).aceSlots[0].score).toBe(0);
	});
	test('a hint adds 1 plus the card Hint level bonus, so the cost and the bought set are fixed', () => {
		const v = [version(['10071'])];
		const bought = (bonus: number, budget: number) => run(v, support([card(1, ['10071'], { hintLevelBonus: Array(5).fill(bonus) })]), budget).aceSlots[0].skills.find((r) => r.skillId === '10071')?.bought;
		expect(bought(0, 270)).toBe(1); // level 1: 10% off
		expect(bought(0, 269)).toBe(0);
		expect(bought(2, 210)).toBe(1); // level 3: 30% off
		expect(bought(2, 209)).toBe(0);
		expect(bought(4, 180)).toBe(1); // level 5: 40% off
		expect(bought(4, 179)).toBe(0);
		expect(bought(9, 180)).toBe(1); // capped at 5
	});
	test('the limit break level picks the card Hint level bonus', () => {
		const c = card(1, ['10071'], { hintLevelBonus: [0, 0, 0, 0, 4] });
		const v = [version(['10071'])];
		const at = (limitBreak: number) => run(v, { own: [{ card: c, limitBreak }], borrowed: [], trainingsPerCard: 1 }, 180).aceSlots[0].skills.find((r) => r.skillId === '10071')?.bought;
		expect(at(4)).toBe(1);
		expect(at(3)).toBe(0);
	});
	test('card and spark hints add up', () => {
		// A 1-star spark procs at both inspirations: level 2 (20% off, 200 SP); the card adds 1: level 3 (30% off, 175 SP).
		const spark: Candidate = { id: 's', name: 's', horses: [horseOf(['10091'], 1), horseOf([]), horseOf([])] };
		const v = [version(['10091'], [spark])];
		const bought = (sup?: SupportInput) => run(v, sup, 180).aceSlots[0].skills.find((r) => r.skillId === '10091')?.bought;
		expect(bought()).toBe(0);
		expect(bought(support([card(1, ['10091'])]))).toBe(1);
	});
	test('card and spark hints cap at 5', () => {
		const spark: Candidate = { id: 's', name: 's', horses: [horseOf(['10091'], 3), horseOf([]), horseOf([])] };
		const sup = support([card(1, ['10091'], { hintLevelBonus: Array(5).fill(4) })]);
		const rolled = rollSparks(spark.horses, { distance: 7, surface: 7 }, 'turf', 1, { cards: [{ pool: ['10091'], frequency: CERTAIN, bonus: 4 }], trainings: 1 });
		expect(rolled.hints['10091']).toBe(5);
		expect(run([version(['10091'], [spark])], sup, 150).aceSlots[0].skills.find((r) => r.skillId === '10091')?.bought).toBe(1);
	});
	test('deterministic for a seed, shortlist and budget, also through the worker batches', async () => {
		const sup = support([card(1, ['10071', '10091']), ...fillers], [card(41, ['10081'])], { trainingsPerCard: 30 });
		const v = [version(['10071', '10081'], [{ id: 'p', name: 'p', horses: [horseOf(['10091'], 1), horseOf([]), horseOf([])] }])];
		const p = { ...preset, support: sup, skillPoints: { budget: 400, costs } };
		const a = recommend(none, p, undefined, v);
		expect(recommend(none, p, undefined, v)).toEqual(a);
		const batched = await recommendAsync(async (batch) => batch.requests.map((r) => simulateRequest(r, batch.scenario)), none, p, undefined, v);
		expect(batched).toEqual(a);
	});
	test('the Ace veteran and the loops ignore the deck', () => {
		const list: CandidateList = { candidates: [{ id: 'a', name: 'a', horses: [horseOf(['10071']), horseOf([]), horseOf([])] }] };
		const v = [version(['10071'], list.candidates)];
		const free = recommend(list, preset, { S10071: 'T0' }, v);
		const decked = recommend(list, { ...preset, support: support([card(1, ['10091']), ...fillers]) }, { S10071: 'T0' }, v);
		expect({ ...decked, aceSlots: 0 }).toEqual({ ...free, aceSlots: 0 });
	});
});
