import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { RaceSolverBuilder, type HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';
import type { Veteran } from '@stud-finder/lineage/src/types';
import { buildAce, categoryOf, STYLES, type Style } from './ace';
import { assumesPosition } from './recommend';
import { skillValue } from './skillValue';
import type { SkillDetail } from './shared';

const BASHIN = 2.5; // metres per length
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
	lengthsGained: number;
	/** Lengths behind the best Ace veteran (0 for the best). */
	gap: number;
	detail: SkillDetail[];
	/** Some value rests on the sim's default position assumption. */
	assumesPosition: boolean;
}

export interface VeteranScoreOptions {
	courseId: number;
	samples?: number;
	seed?: number;
}

function median(xs: number[]) {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function gained(horse: HorseDesc, skillIds: string[], courseId: number, samples: number, seed: number) {
	const make = (ids: string[]) => {
		const b = new RaceSolverBuilder(samples).seed(seed).course(courseId).horse(horse);
		ids.forEach((id) => b.addSkill(id));
		return { b, g: b.build() };
	};
	const base = make([]);
	const test = make(skillIds);
	const distance = base.b._course.distance;
	const out: number[] = [];
	for (let i = 0; i < samples; i++) {
		const a = base.g.next().value as RaceSolver;
		const t = test.g.next().value as RaceSolver;
		while (a.pos < distance && t.pos < distance) {
			a.step(1 / 15);
			t.step(1 / 15);
		}
		out.push((t.pos - a.pos) / BASHIN);
	}
	return median(out);
}

/** Scores every veteran as herself: own stats, aptitudes, equipped skills, career style; no Target stats. Best first, ties by trained id. */
export function scoreVeterans(veterans: Veteran[], { courseId, samples = 100, seed = 1 }: VeteranScoreOptions): AceVeteranScore[] {
	const course = new RaceSolverBuilder(1).course(courseId)._course;
	const category = categoryOf(course.distance);
	const surface = course.surface === 2 ? 'dirt' : 'turf';
	const scored = veterans.map((v) => {
		const style = CAREER_STYLE[v.runningStyle - 1] ?? STYLES.reduce((b, s) => (v.aptitudes[s] > v.aptitudes[b] ? s : b));
		const horse: HorseDesc = {
			...buildAce({ aptitudes: v.aptitudes, style, category, surface }),
			speed: v.stats.speed, stamina: v.stats.stamina, power: v.stats.power, guts: v.stats.guts, wisdom: v.stats.wiz,
		};
		const ids = [...new Set(v.skillIds.map(String))].filter((id) => id in skillData); // skills the sim does not know are skipped
		// Per-skill detail is each skill alone on the skill-less runner; the headline is the whole set together.
		const detail = ids.map((skillId): SkillDetail => ({ skillId, ...skillValue(skillId, { horse, courseId, samples, seed }), assumesPosition: assumesPosition(skillId) }));
		return {
			trainedId: v.trainedId, cardId: v.cardId, style, rankScore: v.rankScore, createdAt: v.createdAt,
			aptitude: { surface: v.aptitudes[surface], distance: v.aptitudes[category] },
			lengthsGained: gained(horse, ids, courseId, samples, seed), gap: 0, detail,
			assumesPosition: detail.some((d) => d.assumesPosition),
		};
	});
	scored.sort((a, b) => b.lengthsGained - a.lengthsGained || a.trainedId - b.trainedId);
	const best = scored[0]?.lengthsGained ?? 0;
	return scored.map((s) => ({ ...s, gap: best - s.lengthsGained }));
}
