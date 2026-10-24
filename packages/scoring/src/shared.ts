import { FactorType } from '@stud-finder/lineage/src/types';
import { GRADE_A, GRADE_S, INSPIRATIONS, aptitudeChance, procChance, startingGrade } from '@stud-finder/lineage/src/inheritance';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { Tier } from '@stud-finder/lineage/src/tiers';
import type { SimAssumptions } from './assumptions';
import type { RaceConditions } from './pairedRace';
import type { SkillValue } from './skillValue';
import type { SkillCost } from './skillBudget';
import type { SupportInput } from './support';
import type { Style } from './ace';

/** Spark name (as in the tier list) to tier. */
export type TierList = Record<string, Tier>;

/** A white skill spark on a horse. */
export interface SkillSpark {
	skillId: string;
	name: string;
	stars: number;
}
/** The white (inherited) variant of a horse's own unique skill, which its green spark makes buyable for the Ace. */
export interface UniqueSpark extends SkillSpark {
	/** A parent always makes it buyable; a grandparent only when its green spark procs in an inheritance. */
	certain: boolean;
}
/** One horse a veteran brings into the Ace's lineage: itself as a parent, or one of its two parents as a grandparent. */
export interface LineageHorse {
	/** For its portrait. */
	cardId?: number;
	/** Affinity with the Ace; sets this horse's chance to inspire. */
	affinity: number;
	/** Stars of the CM-relevant pink spark (0 = none). */
	pinkStars: number;
	/** Total stars of its dirt pink sparks. */
	dirtStars: number;
	/** Total stars of its turf pink sparks (0 when unset). */
	turfStars?: number;
	/** Stars of its style pink spark per running style (missing = none). A horse has one pink spark, so this is empty when its pink spark is a distance or surface one. */
	styleStars?: Partial<Record<Style, number>>;
	skills: SkillSpark[];
	/** Absent for the Ace's own character (unique leveling covers it) and when the game data has no unique for the horse. */
	unique?: UniqueSpark;
}
/** A veteran considered as a parent: itself first, then its own two parents (the Ace's grandparents). */
export interface Candidate {
	id: string;
	/** Version name plus what tells two veterans of one version apart. */
	name: string;
	horses: LineageHorse[];
	/** Character of the veteran itself; two parents of one Ace can't share it. */
	charaId?: number;
}
export interface CandidateList {
	candidates: Candidate[];
}
/** A Skill point budget and what the skills in play cost (skills missing from `costs` are not for sale). */
export interface SkillPoints {
	budget: number;
	costs: Record<string, SkillCost>;
}
export interface CmPreset extends RaceConditions {
	courseId: number;
	/** The runner the CM is simulated for (a stand-in for the Ace). */
	runner: HorseDesc;
	samples?: number;
	seed?: number;
	/** The Skill point budget the Ace slot buys within; absent means unlimited (every Buyable skill is bought). Ace heroes only. */
	skillPoints?: SkillPoints;
	/** The Support cards the player would consider running; the Ace slot picks a Support deck from them per Ace hero. Absent or both lists empty changes nothing. Ace heroes only. */
	support?: SupportInput;
	/** Race conditions every paired race assumes; umalator's defaults when unset. */
	assumptions?: SimAssumptions;
}
export interface SkillDetail extends SkillValue {
	skillId: string;
	/** Value rests on the sim's default position assumption. */
	assumesPosition: boolean;
	/** Chance the pick's horses pass this skill on; set on pick details only. */
	inherit?: number;
	/** Simulated at fewer samples than asked; recommend() re-simulates every skill a pick shows. */
	screened?: boolean;
	/** Which runner's simulation this came from (recommend()'s cache key). */
	src?: string;
}
export interface CandidatePick {
	candidateId: string;
	score: number;
	reason: string;
	detail: SkillDetail[];
}

/** Stars each skill is already supplied at; the Ace baseline counts as Infinity. */
export type Supplied = Map<string, number>;

export function aceSupply(aceSkills: string[] = []): Supplied {
	return new Map(aceSkills.map((id) => [id, Infinity]));
}

/** Share of a spark's stars not already supplied: 0 when supplied at its tier or above, the difference over its stars when lower. */
export function newShare(stars: number, supplied = 0): number {
	return Math.max(0, stars - supplied) / stars;
}

/** Best stars per spark, keyed by skill id or (as the tier list is) by name. */
export function maxStars(sparks: SkillSpark[], key: 'skillId' | 'name' = 'skillId'): Supplied {
	const m: Supplied = new Map();
	for (const s of sparks) m.set(s[key], Math.max(m.get(s[key]) ?? 0, s.stars));
	return m;
}

/** Greedy marginal gain: take the best pick given what is supplied, add what it supplies, rescore the rest. No lineage optimizer. */
export function greedyRank(candidates: Candidate[], top: number, baseline: Supplied, scorePick: (c: Candidate, supplied: Supplied) => { pick: CandidatePick; supply: Supplied }, priority: (c: Candidate) => number = () => 0): CandidatePick[] {
	const supplied: Supplied = new Map(baseline);
	const left = [...candidates];
	const out: CandidatePick[] = [];
	while (left.length && out.length < top) {
		const scored = left.map((c) => ({ c, ...scorePick(c, supplied) }));
		const best = scored.sort((a, b) => priority(b.c) - priority(a.c) || b.pick.score - a.pick.score || a.pick.candidateId.localeCompare(b.pick.candidateId))[0];
		out.push(best.pick);
		left.splice(left.indexOf(best.c), 1);
		for (const [id, stars] of best.supply) supplied.set(id, Math.max(supplied.get(id) ?? 0, stars));
	}
	return out;
}

/** Best chance, over the Must-have skills, that these horses pass one on. */
export function mustHaveChance(horses: LineageHorse[], mustHaves: string[]): number {
	return Math.max(0, ...mustHaves.map((id) => skillChance(horses, id)));
}

/** Chance these horses pass one skill on (any of their sparks for it procs). */
export function skillChance(horses: LineageHorse[], skillId: string): number {
	let miss = 1; // multiplied in the order chanceAny would, so the result is the very same number
	for (const h of horses) for (const f of missFactors(h).get(skillId) ?? NONE) miss *= f;
	return 1 - miss;
}

// The ranking asks about the same horses over and over (every pair of candidates, every round), so each horse's chance to miss, per spark and skill, is worked out once.
// Assumes a horse's skills and affinity do not change after it is first asked about.
const NONE: number[] = [];
const MISS_FACTORS = new WeakMap<LineageHorse, Map<string, number[]>>();
function missFactors(h: LineageHorse): Map<string, number[]> {
	let bySkill = MISS_FACTORS.get(h);
	if (!bySkill) {
		MISS_FACTORS.set(h, (bySkill = new Map()));
		const add = (skillId: string, factor: number) => {
			const factors = bySkill.get(skillId);
			if (factors) factors.push(factor); else bySkill.set(skillId, [factor]);
		};
		for (const s of h.skills) add(s.skillId, (1 - procChance(FactorType.Skill, s.stars, h.affinity)) ** INSPIRATIONS);
		if (h.unique) add(h.unique.skillId, h.unique.certain ? 0 : (1 - procChance(FactorType.Unique, h.unique.stars, h.affinity)) ** INSPIRATIONS);
	}
	return bySkill;
}

/** Chance rounded to 1e-9 so float noise between equal chances does not skip a tie-break; compare these, never raw chances. */
export function chanceKey(chance: number): number {
	return Math.round(chance * 1e9);
}

/** A full-dirt lineage has dirt pink sparks on every horse (parent and both grandparents). */
export function isFullDirt(c: Candidate): boolean {
	return c.horses.every((h) => h.dirtStars > 0);
}

/** Chance these horses lift the CM distance aptitude of `base` to A through their distance pink sparks (same method as dirtAChance). */
export function distanceAChance(horses: LineageHorse[], base: number): number {
	const pink = horses.filter((h) => h.pinkStars > 0);
	const start = startingGrade(base, pink.reduce((s, h) => s + h.pinkStars, 0));
	return aptitudeChance(start, GRADE_A, pink.map((h) => procChance(FactorType.Aptitude, h.pinkStars, h.affinity))).min;
}

/** Chance these horses lift a dirt aptitude of `base` to A through their dirt pink sparks (start boost, then both inspirations; the lower bound the owner ranks by). */
export function dirtAChance(horses: LineageHorse[], base: number): number {
	const dirty = horses.filter((h) => h.dirtStars > 0);
	const start = startingGrade(base, dirty.reduce((s, h) => s + h.dirtStars, 0));
	return aptitudeChance(start, GRADE_A, dirty.map((h) => procChance(FactorType.Aptitude, h.dirtStars, h.affinity))).min;
}

/** Surface pink stars of a horse for the CM's surface. */
export function surfaceStarsOf(h: LineageHorse, surface: 'turf' | 'dirt'): number {
	return surface === 'dirt' ? h.dirtStars : (h.turfStars ?? 0);
}

/**
 * Where an aptitude of `base` ends up through these horses' pink sparks (`starsOf` picks the aptitude's stars), with the chance of each grade, lowest first.
 * Uses the lower bound of aptitudeChance throughout, as the dirt and distance A chances do. A grade at or above A can rise to S mid-run.
 */
export function aptitudeOutcomes(base: number, horses: LineageHorse[], starsOf: (h: LineageHorse) => number): { grade: number; chance: number }[] {
	const pink = horses.filter((h) => starsOf(h) > 0);
	const start = startingGrade(base, pink.reduce((s, h) => s + starsOf(h), 0));
	const chances = pink.map((h) => procChance(FactorType.Aptitude, starsOf(h), h.affinity));
	const atLeast = (g: number) => (g <= start ? 1 : aptitudeChance(start, g, chances).min);
	const out: { grade: number; chance: number }[] = [];
	for (let g = start; g <= GRADE_S; g++) {
		const chance = atLeast(g) - (g < GRADE_S ? atLeast(g + 1) : 0);
		if (chance > 1e-12) out.push({ grade: g, chance });
	}
	return out;
}
