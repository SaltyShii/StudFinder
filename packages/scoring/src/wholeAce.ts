import { SeededRng } from '@stud-finder/sim/src/Random';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import { FactorType } from '@stud-finder/lineage/src/types';
import { GRADE_S, INSPIRATIONS, RED_PROC_POINTS, gradesFromPoints, procChance, startingGrade } from '@stud-finder/lineage/src/inheritance';
import { buildAce, categoryOf, courseFacts, type Style, type TargetStats } from './ace';
import { pairedRace, type Scenario } from './pairedRace';
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
	const skillIds = new Set<string>();
	for (const h of horses) {
		for (const s of h.skills) {
			for (let i = 0; i < INSPIRATIONS; i++) if (rolls(procChance(FactorType.Skill, s.stars, h.affinity), rng)) skillIds.add(s.skillId);
		}
	}
	return { distance, surface: surfaceGrade, skillIds: [...skillIds] };
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
	/** Buyable skills the Ace meets (the caller has dropped those whose conditions it cannot meet); all are bought. */
	buyableSkillIds: string[];
	/** The pair's lineage: both parents and their parents. Empty for a version without candidates. */
	horses: LineageHorse[];
	/** Race seeds shared by every version and pair; one Whole-Ace run per seed, the spark roll uses the same seed. */
	seeds: number[];
}

/**
 * Mean lengths gained over the Whole-Ace runs: per seed, roll the pair's sparks, build the trained Ace (rolled aptitudes, unique skill, Buyable skills, procced inherited skills, each skill once) and race it paired against the untrained base (own aptitudes, no skills) on that seed.
 * Pure and deterministic.
 */
export function wholeAceMean(input: WholeAceInput): number {
	const { aptitudes, style, scenario, target, uniqueSkillId, buyableSkillIds, horses, seeds } = input;
	if (!seeds.length) return 0;
	const { distance, surface } = courseFacts(scenario.courseId);
	const category = categoryOf(distance);
	const baseHorse = buildAce({ aptitudes, style, category, surface, target });
	let total = 0;
	for (const seed of seeds) {
		const rolled = rollSparks(horses, { distance: aptitudes[category], surface: aptitudes[surface] }, surface, seed);
		const ace = buildAce({ aptitudes: { ...aptitudes, [category]: rolled.distance, [surface]: rolled.surface }, style, category, surface, target });
		const skills = [...new Set([...(uniqueSkillId ? [uniqueSkillId] : []), ...buyableSkillIds, ...rolled.skillIds])];
		const [run] = pairedRace(skills, { ...scenario, horse: ace, samples: 1, seed }, baseHorse);
		total += run.lengths;
	}
	return total / seeds.length;
}

/** The one seed list every version and pair is scored on (common random numbers): one seed per Whole-Ace run. */
export function wholeAceSeeds(seed: number, samples: number): number[] {
	return Array.from({ length: samples }, (_, i) => seed + i);
}
