import { RaceSolverBuilder, type HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';

const BASHIN = 2.5; // metres per length

export interface SkillValue {
	/** % of runs where the skill activated. */
	proc: number;
	/** Lengths gained over the same horse without the skill, in runs where it activated. */
	lengths: { min: number; avg: number; median: number; max: number };
	/** proc % x median lengths, as a fraction of 100 (50% proc, 2 lengths -> 1). */
	value: number;
}

export interface Scenario {
	horse: HorseDesc;
	courseId: number;
	samples?: number;
	seed?: number;
}

const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Runs the horse with and without the skill on the same seed, and measures the gap when the first one finishes. */
export function skillValue(skillId: string, { horse, courseId, samples = 100, seed = 1 }: Scenario): SkillValue {
	const make = (withSkill: boolean) => {
		const b = new RaceSolverBuilder(samples).seed(seed).course(courseId).horse(horse);
		if (withSkill) b.addSkill(skillId);
		return { b, g: b.build() };
	};
	const base = make(false);
	const test = make(true);
	const distance = base.b._course.distance;

	const gains: number[] = [];
	for (let i = 0; i < samples; i++) {
		const a = base.g.next().value as RaceSolver;
		const t = test.g.next().value as RaceSolver;
		while (a.pos < distance && t.pos < distance) {
			a.step(1 / 15);
			t.step(1 / 15);
		}
		if (t.usedSkills.has(skillId)) gains.push((t.pos - a.pos) / BASHIN);
	}

	const proc = gains.length / samples;
	if (!gains.length) return { proc, lengths: { min: 0, avg: 0, median: 0, max: 0 }, value: 0 };
	const med = median(gains);
	return {
		proc: proc * 100,
		lengths: { min: Math.min(...gains), avg: gains.reduce((x, y) => x + y) / gains.length, median: med, max: Math.max(...gains) },
		value: proc * med,
	};
}
