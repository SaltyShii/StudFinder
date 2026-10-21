import skillData from '@stud-finder/sim/src/data/skill_data.json';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { Veteran } from '@stud-finder/lineage/src/types';
import { buildAce, categoryOf, courseFacts, STYLES, type Style } from './ace';
import type { SimAssumptions } from './assumptions';
import { skillDetail } from './skillDetail';
import { median, pairedRace, type RaceConditions } from './pairedRace';
import type { SkillDetail } from './shared';

const CAREER_STYLE: Style[] = ['nige', 'senko', 'sashi', 'oikomi']; // game running_style 1-4

export interface AceVeteranScore {
	trainedId: number;
	cardId: number;
	style: Style;
	rankScore: number;
	createdAt: string;
	/** Aptitude grades (1 = G ... 8 = S) for the CM's surface and distance. */
	aptitude: { surface: number; distance: number };
	/** Median lengths gained by the full skill set over the same runner with no skills, same seed. */
	setLengthsGained: number;
	/** Equipped skills the sim has no data for, so they add nothing to the score. */
	skillsNotSimulated: number;
	/** Lengths behind the best Ace veteran (0 for the best). */
	gap: number;
	detail: SkillDetail[];
	/** Some value rests on the sim's default position assumption. */
	assumesPosition: boolean;
}

export interface VeteranScoreOptions extends RaceConditions {
	courseId: number;
	samples?: number;
	seed?: number;
	assumptions?: SimAssumptions;
	/** Unique skill id per card id; the unique skill counts as equipped even if the export's skill list omits it. */
	uniqueSkills?: ReadonlyMap<number, number>;
	/** Called after each veteran is scored. Cancel by terminating the worker, as with recommend(). */
	onProgress?: (done: number, total: number) => void;
}

/** Scores every veteran as herself: own stats, aptitudes, equipped skills, career style; no Target stats. Best first, ties by trained id. */
export function scoreVeterans(veterans: Veteran[], { courseId, samples = 100, seed = 1, uniqueSkills, onProgress, ...conditions }: VeteranScoreOptions): AceVeteranScore[] {
	const course = courseFacts(courseId);
	const category = categoryOf(course.distance);
	const surface = course.surface;
	const scored = veterans.map((v, i) => {
		const style = CAREER_STYLE[v.runningStyle - 1] ?? STYLES.reduce((b, s) => (v.aptitudes[s] > v.aptitudes[b] ? s : b));
		const horse: HorseDesc = buildAce({
			aptitudes: v.aptitudes, style, category, surface,
			target: { speed: v.stats.speed, stamina: v.stats.stamina, power: v.stats.power, guts: v.stats.guts, wisdom: v.stats.wiz },
		});
		const unique = uniqueSkills?.get(v.cardId);
		const equipped = [...new Set([...v.skillIds, ...(unique == null ? [] : [unique])].map(String))];
		const ids = equipped.filter((id) => id in skillData); // skills the sim does not know are skipped
		// Per-skill detail is each skill alone on the skill-less runner; the headline is the whole set together.
		const detail = ids.map((skillId) => skillDetail(skillId, { horse, courseId, samples, seed, ...conditions }));
		const setLengthsGained = median(pairedRace(ids, { horse, courseId, samples, seed, ...conditions }).map((r) => r.lengths)); // all runs, procced or not
		onProgress?.(i + 1, veterans.length);
		return {
			trainedId: v.trainedId, cardId: v.cardId, style, rankScore: v.rankScore, createdAt: v.createdAt,
			aptitude: { surface: v.aptitudes[surface], distance: v.aptitudes[category] },
			setLengthsGained, skillsNotSimulated: equipped.length - ids.length, gap: 0, detail,
			assumesPosition: detail.some((d) => d.assumesPosition),
		};
	});
	scored.sort((a, b) => b.setLengthsGained - a.setLengthsGained || a.trainedId - b.trainedId);
	const best = scored[0]?.setLengthsGained ?? 0;
	return scored.map((s) => ({ ...s, gap: best - s.setLengthsGained }));
}
