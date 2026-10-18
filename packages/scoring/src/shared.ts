import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { Tier } from '@stud-finder/lineage/src/tiers';
import type { SkillValue } from './skillValue';

/** Spark name (as in the tier list) to tier. */
export type TierList = Record<string, Tier>;

// Minimal Roster until the importer lands; pinkSparks exists only so Ace can ignore it.
export interface Outfit {
	id: string;
	name: string;
	owned: boolean;
	/** Skills this outfit would pass on to the Ace. */
	skillIds: string[];
	/** Stars (1-3) of the CM-relevant pink spark; Ace ignores it, side loop scores it. */
	pinkSparks?: number;
	/** Affinity with the target lineage; raises inheritance chances (side loop). */
	affinity?: number;
	/** Core loop inputs; blue sparks are deliberately not modelled. */
	whiteSparks?: string[];
	dirtSparks?: number;
}
export interface Roster {
	outfits: Outfit[];
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
	outfitId: string;
	owned: boolean;
	score: number;
	reason: string;
	detail: SkillDetail[];
}

// What the other owned outfits already supply; the candidate itself never counts.
// Tie rule: an owned candidate is only redundant against owned outfits with a lower id, so two owned outfits sharing a skill credit the first one.
// shortcut: compared per exact skill id / spark name, so a higher-rarity version of a skill is a different id and is credited in full.
export function supplied(outfits: Outfit[], self: Outfit) {
	const others = outfits.filter((o) => o.owned && o.id !== self.id && (!self.owned || o.id < self.id));
	return { skills: new Set(others.flatMap((o) => o.skillIds)), sparks: new Set(others.flatMap((o) => o.whiteSparks ?? [])) };
}

export function rank(picks: Pick[], top: number): Pick[] {
	return picks.sort((a, b) => b.score - a.score || a.outfitId.localeCompare(b.outfitId)).slice(0, top);
}
