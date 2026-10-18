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
export interface Roster {
	candidates: Candidate[];
}
export interface CmPreset {
	courseId: number;
	/** The Ace the CM is simulated for. */
	ace: HorseDesc;
	samples?: number;
	seed?: number;
}
export interface SkillDetail extends SkillValue {
	skillId: string;
	/** Value rests on the sim's default position assumption. */
	assumesPosition: boolean;
}
export interface Pick {
	candidateId: string;
	score: number;
	reason: string;
	detail: SkillDetail[];
}

export function rank(picks: Pick[], top: number): Pick[] {
	return picks.sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId)).slice(0, top);
}
