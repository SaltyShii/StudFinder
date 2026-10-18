import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { Aptitudes } from '@stud-finder/lineage/src/types';

export const CATEGORIES = ['short', 'mile', 'middle', 'long'] as const;
export const STYLES = ['nige', 'senko', 'sashi', 'oikomi'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Style = (typeof STYLES)[number];
export interface TargetStats {
	speed: number;
	stamina: number;
	power: number;
	guts: number;
	wisdom: number;
}

/** Factor groups of the distance pink sparks (see lineage APTITUDE_BY_GROUP). */
export const PINK_GROUP: Record<Category, number> = { short: 31, mile: 32, middle: 33, long: 34 };
/** Factor group of the dirt aptitude spark. */
export const DIRT_GROUP = 12;

export function categoryOf(distance: number): Category {
	return distance <= 1400 ? 'short' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'middle' : 'long';
}

// shortcut: rough community-guide values, not tuned against the sim; revisit if rankings look off.
const STAMINA: Record<Category, number> = { short: 500, mile: 700, middle: 900, long: 1100 };
const STYLE_TWEAK: Record<Style, Partial<TargetStats>> = { nige: { speed: 50 }, senko: {}, sashi: { power: 50 }, oikomi: { power: 50, wisdom: 50 } };

export function defaultTargetStats(category: Category, style: Style): TargetStats {
	const t = STYLE_TWEAK[style];
	return { speed: 1100 + (t.speed ?? 0), stamina: STAMINA[category], power: 800 + (t.power ?? 0), guts: 400, wisdom: 400 + (t.wisdom ?? 0) };
}

const GRADES = 'GFEDCBAS'; // lineage grade 1 = G ... 8 = S
function grade(n: number) {
	return GRADES[n - 1] ?? 'G';
}
const STRATEGY: Record<Style, string> = { nige: 'Nige', senko: 'Senkou', sashi: 'Sasi', oikomi: 'Oikomi' };

export interface AceInput {
	aptitudes: Aptitudes;
	style: Style;
	category: Category;
	surface: 'turf' | 'dirt';
	/** Overrides applied on top of the recommended defaults. */
	target?: Partial<TargetStats>;
	uniqueSkillId?: string;
}

/** The runner skill value is measured on; the unique skill is part of the baseline. */
export function buildAce({ aptitudes, style, category, surface, target, uniqueSkillId }: AceInput): HorseDesc {
	return {
		...defaultTargetStats(category, style),
		...target,
		strategy: STRATEGY[style],
		distanceAptitude: grade(aptitudes[category]),
		surfaceAptitude: grade(aptitudes[surface]),
		strategyAptitude: grade(aptitudes[style]),
		mood: 2,
		skills: uniqueSkillId ? [uniqueSkillId] : [],
	};
}
