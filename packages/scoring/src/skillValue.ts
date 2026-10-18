import { median, pairedRace, type Scenario } from './pairedRace';

export interface SkillValue {
	/** % of runs where the skill activated. */
	proc: number;
	/** Lengths gained over the same horse without the skill, in runs where it activated. */
	lengths: { min: number; avg: number; median: number; max: number };
	/** proc % x median lengths, as a fraction of 100 (50% proc, 2 lengths -> 1). */
	value: number;
}

/** Paired race for one skill; proc and lengths are read over the runs where it activated. */
export function skillValue(skillId: string, scenario: Scenario): SkillValue {
	const runs = pairedRace([skillId], scenario);
	const gains = runs.filter((r) => r.activated).map((r) => r.lengths);
	const proc = gains.length / runs.length;
	if (!gains.length) return { proc, lengths: { min: 0, avg: 0, median: 0, max: 0 }, value: 0 };
	const med = median(gains);
	return {
		proc: proc * 100,
		lengths: { min: Math.min(...gains), avg: gains.reduce((x, y) => x + y) / gains.length, median: med, max: Math.max(...gains) },
		value: proc * med,
	};
}
