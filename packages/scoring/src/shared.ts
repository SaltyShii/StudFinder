import { FactorType } from '@stud-finder/lineage/src/types';
import { GRADE_A, aptitudeChance, chanceAny, procChance, startingGrade } from '@stud-finder/lineage/src/inheritance';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { Tier } from '@stud-finder/lineage/src/tiers';
import type { SkillValue } from './skillValue';

/** Spark name (as in the tier list) to tier. */
export type TierList = Record<string, Tier>;

/** A white skill spark on a horse. */
export interface SkillSpark {
	skillId: string;
	name: string;
	stars: number;
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
	skills: SkillSpark[];
}
/** A veteran considered as a parent: itself first, then its own two parents (the Ace's grandparents). */
export interface Candidate {
	id: string;
	/** Version name plus what tells two veterans of one version apart. */
	name: string;
	horses: LineageHorse[];
}
export interface CandidateList {
	candidates: Candidate[];
}
export interface CmPreset {
	courseId: number;
	/** The runner the CM is simulated for (a stand-in for the Ace). */
	runner: HorseDesc;
	samples?: number;
	seed?: number;
}
export interface SkillDetail extends SkillValue {
	skillId: string;
	/** Value rests on the sim's default position assumption. */
	assumesPosition: boolean;
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
	return Math.max(0, ...mustHaves.map((id) => chanceAny(horses.flatMap((h) => h.skills.filter((s) => s.skillId === id).map((s) => procChance(FactorType.Skill, s.stars, h.affinity))))));
}

/** Chance rounded to 1e-9 so float noise between equal chances does not skip a tie-break; compare these, never raw chances. */
export function chanceKey(chance: number): number {
	return Math.round(chance * 1e9);
}

/** A full-dirt lineage has dirt pink sparks on every horse (parent and both grandparents). */
export function isFullDirt(c: Candidate): boolean {
	return c.horses.every((h) => h.dirtStars > 0);
}

/** Chance these horses lift a dirt aptitude of `base` to A through their dirt pink sparks (start boost, then both inspirations; the lower bound the owner ranks by). */
export function dirtAChance(horses: LineageHorse[], base: number): number {
	const dirty = horses.filter((h) => h.dirtStars > 0);
	const start = startingGrade(base, dirty.reduce((s, h) => s + h.dirtStars, 0));
	return aptitudeChance(start, GRADE_A, dirty.map((h) => procChance(FactorType.Aptitude, h.dirtStars, h.affinity))).min;
}
