import type { Card } from '../../../packages/lineage/src/types';
import { startingGrade } from '../../../packages/lineage/src/inheritance';
import { categoryOf, gradeLetter, surfaceOf } from '../../../packages/scoring/src/ace';
import type { AcePick, AceSkillRow, CmPreset } from '../../../packages/scoring/src/recommend';
import { styleStarsOf, surfaceStarsOf } from '../../../packages/scoring/src/shared';

const STRATEGY = { nige: 'Nige', senko: 'Senkou', sashi: 'Sasi', oikomi: 'Oikomi' } as const;

/** uma.moe's Build optimizer opens a code passed as `?build=`; https://uma.moe/contracts/build-code.schema.json describes the JSON. */
const BUILD_OPTIMIZER = 'https://uma.moe/simulator/skills';

export interface BuildCode {
	version: 1;
	mode: 'cm';
	courseId: number;
	racedef: { ground?: number; weather?: number; season?: number; time?: number };
	uma1: {
		outfitId: string;
		speed: number;
		stamina: number;
		power: number;
		guts: number;
		wisdom: number;
		strategy: string;
		distanceAptitude: string;
		surfaceAptitude: string;
		strategyAptitude: string;
		skills: string[];
		mood: number;
		sp?: number;
		fastLearner?: boolean;
	};
	chartSkills: string[];
}

/**
 * The Ace hero as uma.moe reads it: the Target stats, its Best style, its career-start aptitudes (the pink sparks' boost, none of the rolls a run may add) and its unique skill.
 * On offer are the skills its chart lists as its own or inheritable; the Other buyable skills stay out, as no parent carries them.
 */
export function aceBuildCode(pick: AcePick, card: Card, rows: AceSkillRow[], course: { distance: number; ground: number }, preset: CmPreset): BuildCode {
	const { speed, stamina, power, guts, wisdom, mood } = preset.runner;
	const horses = pick.horses.flat();
	const stars = (of: (h: (typeof horses)[number]) => number) => horses.reduce((t, h) => t + of(h), 0);
	const surface = surfaceOf(course.ground);
	const unique = card.uniqueSkillId == null ? undefined : String(card.uniqueSkillId);
	const { skillPoints: points } = preset;
	return {
		version: 1,
		mode: 'cm',
		courseId: preset.courseId,
		racedef: { ground: preset.ground, weather: preset.weather, season: preset.season, time: preset.time },
		uma1: {
			outfitId: String(card.id),
			speed,
			stamina,
			power,
			guts,
			wisdom,
			strategy: STRATEGY[pick.style],
			distanceAptitude: gradeLetter(startingGrade(card.aptitudes[categoryOf(course.distance)], stars((h) => h.pinkStars))),
			surfaceAptitude: gradeLetter(startingGrade(card.aptitudes[surface], stars((h) => surfaceStarsOf(h, surface)))),
			strategyAptitude: gradeLetter(startingGrade(card.aptitudes[pick.style], stars(styleStarsOf(pick.style)))),
			skills: unique ? [unique] : [],
			mood,
			...(points ? { sp: points.budget } : {}),
			...(points?.fastLearner ? { fastLearner: true } : {}),
		},
		chartSkills: rows.filter((r) => !r.other && r.skillId !== unique).map((r) => r.skillId),
	};
}

/** The JSON, gzipped, in base64. */
export async function encodeBuildCode(code: BuildCode): Promise<string> {
	const stream = new Response(JSON.stringify(code)).body!.pipeThrough(new CompressionStream('gzip'));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	return btoa(String.fromCharCode(...bytes));
}

export function buildOptimizerLink(encoded: string): string {
	return `${BUILD_OPTIMIZER}?build=${encodeURIComponent(encoded)}`;
}
