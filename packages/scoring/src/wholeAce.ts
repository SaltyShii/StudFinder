import { SeededRng } from '@stud-finder/sim/src/Random';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import { FactorType } from '@stud-finder/lineage/src/types';
import { GRADE_A, GRADE_S, INSPIRATIONS, RED_PROC_POINTS, gradesFromPoints, procChance, startingGrade } from '@stud-finder/lineage/src/inheritance';
import { buildAce, categoryOf, courseFacts, type Style, type TargetStats } from './ace';
import { pairedRace, type Scenario } from './pairedRace';
import { buySet, MAX_HINT_LEVEL, type AceBudget } from './skillBudget';
import { styleStarsOf, surfaceStarsOf, type LineageHorse } from './shared';
import { hintChance } from './support';

/** The aptitudes a pair of parents can change: the CM distance, surface and running style (grade numbers, 1 = G ... 8 = S). */
export interface RolledAptitudes {
	distance: number;
	surface: number;
	/** The Ace's running style grade; absent when the style is not rolled. */
	style?: number;
}

/** What one roll of a pair's sparks gave. */
export interface SparkRoll extends RolledAptitudes {
	/** White skill sparks that procced, each skill once however many horses carry it. */
	skillIds: string[];
	/** The Hint level of each skill a spark procced for: the stars of its procs added up, at most 5. */
	hints: Record<string, number>;
	/** White unique variants a parent made buyable (a parent always, a grandparent when its green spark procced); not skills the Ace has, so they carry no hint. */
	unlocked: string[];
	/** Skills a Support card hinted, in the order of their first hint; their levels are in `hints`, added to the spark levels. */
	hinted: string[];
}

/** One deck card as a roll needs it: its pool and its Hint Frequency and Hint level bonus at the owned limit break level. */
export interface HintCard {
	pool: string[];
	frequency: number;
	bonus: number;
}

/** The Support deck's hint rolls: every card appears in `trainings` trainings, each hinting with its Hint Frequency's chance. */
export interface SupportRolls {
	cards: HintCard[];
	trainings: number;
}

/** Whether a spark of this chance procs: a 0 chance never does, a certain one always does (the draw is in [0, 1)). */
export function rolls(chance: number, rng: () => number): boolean {
	return rng() < chance;
}

/** One aptitude through the pink sparks: the career-start boost (capped at A), then every spark rolls at each inspiration and the procs' points raise the grade, up to S. Lower-bound points per proc, as the ranking's aptitude chances use. */
function rollAptitude(base: number, stars: number[], affinities: number[], rng: () => number): number {
	let grade = startingGrade(base, stars.reduce((a, b) => a + b, 0));
	for (let i = 0; i < INSPIRATIONS; i++) {
		let procs = 0;
		stars.forEach((s, k) => { if (rolls(procChance(FactorType.Aptitude, s, affinities[k]), rng)) procs++; });
		grade = Math.min(GRADE_S, grade + gradesFromPoints(procs * RED_PROC_POINTS.min));
	}
	return grade;
}

/**
 * Rolls which sparks of these lineage horses (both parents and all four grandparents) procced, from the seed alone: pink distance, surface and style sparks, white skill sparks.
 * Chances are the inheritance model's (stars, affinity, two inspirations). Pure: the same seed gives the same roll.
 */
export function rollSparks(horses: LineageHorse[], base: RolledAptitudes, surface: 'turf' | 'dirt', seed: number, support?: SupportRolls, style?: Style): SparkRoll {
	const prng = new SeededRng(seed);
	const rng = () => prng.random();
	const pink = (starsOf: (h: LineageHorse) => number, grade: number) => {
		const hs = horses.filter((h) => starsOf(h) > 0);
		return rollAptitude(grade, hs.map(starsOf), hs.map((h) => h.affinity), rng);
	};
	const distance = pink((h) => h.pinkStars, base.distance);
	const surfaceGrade = pink((h) => surfaceStarsOf(h, surface), base.surface);
	// Right after the other pink sparks; a lineage with no style spark draws nothing here. A style already at A stays there (the style pink is capped at A) and draws nothing.
	const styleGrade = style !== undefined && base.style !== undefined ? (base.style >= GRADE_A ? base.style : pink(styleStarsOf(style), base.style)) : undefined;
	const hints: Record<string, number> = {};
	// In the order the sparks first procced: a Record would sort the numeric ids, and the skill order can move the sim's random draws.
	const skillIds: string[] = [];
	for (const h of horses) {
		for (const s of h.skills) {
			for (let i = 0; i < INSPIRATIONS; i++) {
				if (!rolls(procChance(FactorType.Skill, s.stars, h.affinity), rng)) continue;
				if (!(s.skillId in hints)) skillIds.push(s.skillId);
				hints[s.skillId] = Math.min(MAX_HINT_LEVEL, (hints[s.skillId] ?? 0) + s.stars);
			}
		}
	}
	// After the skill sparks, so a lineage without a unique draws the very same numbers as before.
	const unlocked: string[] = [];
	for (const h of horses) {
		const u = h.unique;
		if (!u || unlocked.includes(u.skillId)) continue;
		let procced = u.certain;
		for (let i = 0; !procced && i < INSPIRATIONS; i++) procced = rolls(procChance(FactorType.Unique, u.stars, h.affinity), rng);
		if (procced) unlocked.push(u.skillId);
	}
	// After every spark roll, so lineages without a deck draw the same numbers as before.
	const hinted: string[] = [];
	for (const card of support?.cards ?? []) {
		const chance = hintChance(card.frequency);
		for (let t = 0; t < support!.trainings; t++) {
			if (!card.pool.length || !rolls(chance, rng)) continue;
			const id = card.pool[Math.floor(rng() * card.pool.length)];
			if (!hinted.includes(id)) hinted.push(id);
			hints[id] = Math.min(MAX_HINT_LEVEL, (hints[id] ?? 0) + 1 + card.bonus);
		}
	}
	return { distance, surface: surfaceGrade, ...(styleGrade !== undefined ? { style: styleGrade } : {}), skillIds, hints, unlocked, hinted };
}

export interface WholeAceInput {
	/** The Owned version's own (untrained) aptitudes. */
	aptitudes: Aptitudes;
	style: Style;
	/** Course, conditions and assumptions; the Sim runner's course. */
	scenario: Omit<Scenario, 'horse' | 'samples' | 'seed'>;
	/** The Sim runner's Target stats. */
	target?: Partial<TargetStats>;
	uniqueSkillId?: string;
	/** Buyable skills the Ace meets (the caller has dropped those whose conditions it cannot meet); all are bought, or the best set within the budget. */
	buyableSkillIds: string[];
	/** White unique variants the Ace meets the conditions of (a subset of the lineage's); the ones a parent makes buyable in a run are bought like Buyable skills. */
	uniqueSkillIds?: string[];
	/** The pair's lineage: both parents and their parents. Empty for a version without candidates. */
	horses: LineageHorse[];
	/** The Skill point budget the Ace buys within; absent means unlimited: every Buyable skill is bought. */
	budget?: AceBudget;
	/** The Support deck's hint rolls, and the skills the Ace can use (a hint on another is wasted); absent without a deck. */
	support?: SupportRolls & { usable: string[] };
	/** Race seeds shared by every version and pair; one Whole-Ace run per seed, the spark roll uses the same seed. */
	seeds: number[];
}

/** What the Whole-Ace runs of one pair gave. */
export interface WholeAceRuns {
	/** Mean lengths gained over the runs. */
	mean: number;
	/** Per Buyable (or hinted) skill, the share of runs that bought it (0 to 1): 1 for every skill when there is no budget. */
	bought: Record<string, number>;
}

/**
 * The Whole-Ace runs: per seed, roll the pair's sparks, buy skills (all of the Buyable skills, or within the Skill point budget the set with the most lengths gained), build the trained Ace (rolled aptitudes, unique skill, bought skills, procced inherited skills, each skill once) and race it paired against the untrained base (own aptitudes, no skills) on that seed.
 * Pure and deterministic.
 */
export function wholeAceRuns(input: WholeAceInput): WholeAceRuns {
	const { aptitudes, style, scenario, target, uniqueSkillId, buyableSkillIds, uniqueSkillIds = [], horses, seeds, budget, support } = input;
	if (!seeds.length) return { mean: 0, bought: {} };
	const { distance, surface } = courseFacts(scenario.courseId);
	const category = categoryOf(distance);
	const baseHorse = buildAce({ aptitudes, style, category, surface, target });
	// Runs whose sparks hint the same skills at the same levels buy the same set.
	const sets = new Map<string, string[]>();
	const counts: Record<string, number> = {};
	let total = 0;
	for (const seed of seeds) {
		const rolled = rollSparks(horses, { distance: aptitudes[category], surface: aptitudes[surface], style: aptitudes[style] }, surface, seed, support, style);
		const ace = buildAce({ aptitudes: { ...aptitudes, [category]: rolled.distance, [surface]: rolled.surface, [style]: rolled.style ?? aptitudes[style] }, style, category, surface, target });
		// No hint of its own: the green spark only unlocks the white version, at the base cost.
		const unlocked = rolled.unlocked.filter((id) => uniqueSkillIds.includes(id));
		// A card's hint on a skill off the card list makes it buyable like an unlocked one; one the Ace cannot use is wasted.
		const hinted = support ? rolled.hinted.filter((id) => support.usable.includes(id)) : [];
		const unlockedBeyond = (known: string[]) => [...unlocked, ...hinted].filter((id, i, all) => !known.includes(id) && all.indexOf(id) === i);
		let bought: string[];
		if (budget) {
			const key = `${rolled.skillIds.map((id) => `${id}:${rolled.hints[id]}`).join()}|${unlocked.join()}|${hinted.map((id) => `${id}:${rolled.hints[id]}`).join()}`;
			let set = sets.get(key);
			if (!set) sets.set(key, (set = buySet(budget, buyableSkillIds, { skillIds: [...rolled.skillIds, ...unlockedBeyond(rolled.skillIds)], hints: rolled.hints })));
			bought = set;
		} else {
			bought = [...buyableSkillIds, ...unlockedBeyond(buyableSkillIds)];
		}
		for (const id of bought) counts[id] = (counts[id] ?? 0) + 1;
		const skills = [...new Set([...(uniqueSkillId ? [uniqueSkillId] : []), ...bought, ...rolled.skillIds])];
		const [run] = pairedRace(skills, { ...scenario, horse: ace, samples: 1, seed }, baseHorse);
		total += run.lengths;
	}
	return { mean: total / seeds.length, bought: Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, n / seeds.length])) };
}

/** The one seed list every version and pair is scored on (common random numbers): one seed per Whole-Ace run. */
export function wholeAceSeeds(seed: number, samples: number): number[] {
	return Array.from({ length: samples }, (_, i) => seed + i);
}
