import { SeededRng } from '@stud-finder/sim/src/Random';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import { FactorType } from '@stud-finder/lineage/src/types';
import { GRADE_S, INSPIRATIONS, RED_PROC_POINTS, gradesFromPoints, procChance, startingGrade } from '@stud-finder/lineage/src/inheritance';
import { buildAce, categoryOf, courseFacts, type Style, type TargetStats } from './ace';
import { pairedRace, type Scenario } from './pairedRace';
import { buySet, MAX_HINT_LEVEL, type AceBudget } from './skillBudget';
import { surfaceStarsOf, type LineageHorse } from './shared';

/** The aptitudes a pair of parents can change: the CM distance and surface (grade numbers, 1 = G ... 8 = S). */
export interface RolledAptitudes {
	distance: number;
	surface: number;
}

/** What one roll of a pair's sparks gave. */
export interface SparkRoll extends RolledAptitudes {
	/** White skill sparks that procced, each skill once however many horses carry it. */
	skillIds: string[];
	/** The Hint level of each skill a spark procced for: the stars of its procs added up, at most 5. */
	hints: Record<string, number>;
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
 * Rolls which sparks of these lineage horses (both parents and all four grandparents) procced, from the seed alone: pink distance and surface sparks, white skill sparks.
 * Chances are the inheritance model's (stars, affinity, two inspirations). Pure: the same seed gives the same roll.
 */
export function rollSparks(horses: LineageHorse[], base: RolledAptitudes, surface: 'turf' | 'dirt', seed: number): SparkRoll {
	const prng = new SeededRng(seed);
	const rng = () => prng.random();
	const pink = (starsOf: (h: LineageHorse) => number, grade: number) => {
		const hs = horses.filter((h) => starsOf(h) > 0);
		return rollAptitude(grade, hs.map(starsOf), hs.map((h) => h.affinity), rng);
	};
	const distance = pink((h) => h.pinkStars, base.distance);
	const surfaceGrade = pink((h) => surfaceStarsOf(h, surface), base.surface);
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
	return { distance, surface: surfaceGrade, skillIds, hints };
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
	/** The pair's lineage: both parents and their parents. Empty for a version without candidates. */
	horses: LineageHorse[];
	/** The Skill point budget the Ace buys within; absent means unlimited: every Buyable skill is bought. */
	budget?: AceBudget;
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
	const { aptitudes, style, scenario, target, uniqueSkillId, buyableSkillIds, horses, seeds, budget } = input;
	if (!seeds.length) return { mean: 0, bought: {} };
	const { distance, surface } = courseFacts(scenario.courseId);
	const category = categoryOf(distance);
	const baseHorse = buildAce({ aptitudes, style, category, surface, target });
	// Runs whose sparks hint the same skills at the same levels buy the same set.
	const sets = new Map<string, string[]>();
	const counts: Record<string, number> = {};
	let total = 0;
	for (const seed of seeds) {
		const rolled = rollSparks(horses, { distance: aptitudes[category], surface: aptitudes[surface] }, surface, seed);
		const ace = buildAce({ aptitudes: { ...aptitudes, [category]: rolled.distance, [surface]: rolled.surface }, style, category, surface, target });
		let bought = buyableSkillIds;
		if (budget) {
			const key = rolled.skillIds.map((id) => `${id}:${rolled.hints[id]}`).join();
			let set = sets.get(key);
			if (!set) sets.set(key, (set = buySet(budget, buyableSkillIds, rolled)));
			bought = set;
		}
		for (const id of bought) counts[id] = (counts[id] ?? 0) + 1;
		const skills = [...new Set([...(uniqueSkillId ? [uniqueSkillId] : []), ...bought, ...rolled.skillIds])];
		const [run] = pairedRace(skills, { ...scenario, horse: ace, samples: 1, seed }, baseHorse);
		total += run.lengths;
	}
	return { mean: total / seeds.length, bought: Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, n / seeds.length])) };
}

/** Mean lengths gained over the Whole-Ace runs. */
export function wholeAceMean(input: WholeAceInput): number {
	return wholeAceRuns(input).mean;
}

/** The one seed list every version and pair is scored on (common random numbers): one seed per Whole-Ace run. */
export function wholeAceSeeds(seed: number, samples: number): number[] {
	return Array.from({ length: samples }, (_, i) => seed + i);
}
