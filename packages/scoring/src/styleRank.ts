import type { Aptitudes } from '@stud-finder/lineage/src/types';
import { STYLES, type Category, type Style } from './ace';

/** Distance aptitude counts double: it scales the whole race, style only the pace. */
const DISTANCE_WEIGHT = 2;

export function styleScore(apt: Aptitudes, category: Category, style: Style): number {
	return DISTANCE_WEIGHT * apt[category] + apt[style];
}

/** Styles best first for a course distance category; ties keep STYLES order. */
export function rankStyles(apt: Aptitudes, category: Category): Style[] {
	return [...STYLES].sort((a, b) => styleScore(apt, category, b) - styleScore(apt, category, a));
}
