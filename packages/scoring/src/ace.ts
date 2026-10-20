import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { Aptitudes, Card } from '@stud-finder/lineage/src/types';
import courses from '@stud-finder/sim/src/data/course_data.json';
import { CourseHelpers } from '@stud-finder/sim/src/CourseData';

export const CATEGORIES = ['short', 'mile', 'middle', 'long'] as const;
export const STYLES = ['nige', 'senko', 'sashi', 'oikomi'] as const;
/** Global names for UI copy; the ids stay internal. */
export const STYLE_LABEL = { nige: 'Front Runner', senko: 'Pace Chaser', sashi: 'Late Surger', oikomi: 'End Closer' } as const;
export type Category = (typeof CATEGORIES)[number];
export type Style = (typeof STYLES)[number];
export interface TargetStats {
	speed: number;
	stamina: number;
	power: number;
	guts: number;
	wisdom: number;
}

export function categoryOf(distance: number): Category {
	return distance <= 1400 ? 'short' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'middle' : 'long';
}

/** Game ground id (1 = turf, 2 = dirt); the lineage Course and the sim course both use it. */
export function surfaceOf(ground: number): 'turf' | 'dirt' {
	return ground === 2 ? 'dirt' : 'turf';
}

// shortcut: rough community-guide values, not tuned against the sim; revisit if rankings look off.
const STAMINA: Record<Category, number> = { short: 500, mile: 700, middle: 900, long: 1100 };
const STYLE_TWEAK: Record<Style, Partial<TargetStats>> = { nige: { speed: 50 }, senko: {}, sashi: { power: 50 }, oikomi: { power: 50, wisdom: 50 } };

export function defaultTargetStats(category: Category, style: Style): TargetStats {
	const t = STYLE_TWEAK[style];
	return { speed: 1100 + (t.speed ?? 0), stamina: STAMINA[category], power: 800 + (t.power ?? 0), guts: 400, wisdom: 400 + (t.wisdom ?? 0) };
}

const GRADES = 'GFEDCBAS'; // aptitude grade 1 = G ... 8 = S
/** Aptitude grade letter for a lineage number; throws when out of range. */
export function gradeLetter(n: number) {
	const g = GRADES[n - 1];
	if (!g) throw new Error(`Unknown aptitude grade ${n}`);
	return g;
}
/** Like gradeLetter, but '?' for out-of-range grades (veteran records with missing aptitude) so the UI never throws. */
export function gradeLabel(n: number) {
	return GRADES[n - 1] ?? '?';
}
const STRATEGY: Record<Style, string> = { nige: 'Nige', senko: 'Senkou', sashi: 'Sasi', oikomi: 'Oikomi' };

/** Style of a sim runner's strategy name. */
export function styleOfStrategy(strategy: unknown): Style | undefined {
	return STYLES.find((s) => STRATEGY[s] === strategy);
}

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
		distanceAptitude: gradeLetter(aptitudes[category]),
		surfaceAptitude: gradeLetter(aptitudes[surface]),
		strategyAptitude: gradeLetter(aptitudes[style]),
		mood: 2,
		skills: uniqueSkillId ? [uniqueSkillId] : [],
	};
}

/** The untrained Ace for a CM course: the card's aptitudes and unique skill, the given style, recommended stats unless overridden. */
export function aceForCourse(card: Pick<Card, 'aptitudes' | 'uniqueSkillId'>, course: CourseFacts, style: Style, target?: Partial<TargetStats>): HorseDesc {
	return buildAce({
		aptitudes: card.aptitudes, style, category: categoryOf(course.distance), surface: course.surface, target,
		uniqueSkillId: card.uniqueSkillId == null ? undefined : String(card.uniqueSkillId),
	});
}

/** What the scoring code needs to know about a CM course. */
export interface CourseFacts {
	distance: number;
	surface: 'turf' | 'dirt';
}

/** The one place scoring reads a course out of the sim. */
export function courseFacts(courseId: number): CourseFacts {
	if (!Object.hasOwn(courses, courseId)) throw new Error(`Unknown course id ${courseId}`);
	const c = CourseHelpers.getCourse(courseId);
	return { distance: c.distance, surface: surfaceOf(c.surface) };
}

/** Distance aptitude counts double: it scales the whole race, style only the pace. */
const DISTANCE_WEIGHT = 2;

export function styleScore(apt: Aptitudes, category: Category, style: Style): number {
	return DISTANCE_WEIGHT * apt[category] + apt[style];
}

/** Styles best first for a course distance category; ties keep STYLES order. */
export function rankStyles(apt: Aptitudes, category: Category): Style[] {
	return [...STYLES].sort((x, y) => styleScore(apt, category, y) - styleScore(apt, category, x));
}
