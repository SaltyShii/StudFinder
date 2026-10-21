import { median, pairedRace, type ActivationSpot, type Scenario } from './pairedRace';

export interface SkillValue {
	/** % of runs where the skill activated. */
	proc: number;
	/** Lengths gained over the same horse without the skill, in runs where it activated. */
	lengths: { min: number; avg: number; median: number; max: number };
	/** proc % x median lengths, as a fraction of 100 (50% proc, 2 lengths -> 1). */
	value: number;
	/** Where each run that activated the skill fired it and how far the effect carried, from the same paired races as proc and lengths. */
	spots: ActivationSpot[];
	/** Min, median and max of the activation positions (metres); all 0 when the skill never fired. */
	spotSpread: { min: number; median: number; max: number };
	/** Median effect duration in seconds over the runs that activated. */
	duration: number;
}

/** Paired race for one skill; proc and lengths are read over the runs where it activated. */
export function skillValue(skillId: string, scenario: Scenario): SkillValue {
	const runs = pairedRace([skillId], scenario);
	const hits = runs.filter((r) => r.activated);
	const gains = hits.map((r) => r.lengths);
	const spots = hits.flatMap((r) => (r.spot ? [r.spot] : []));
	const positions = spots.map((s) => s.pos);
	const spotInfo = spots.length
		? { spots, spotSpread: { min: Math.min(...positions), median: median(positions), max: Math.max(...positions) }, duration: median(spots.map((s) => s.duration)) }
		: { spots, spotSpread: { min: 0, median: 0, max: 0 }, duration: 0 };
	const proc = gains.length / runs.length;
	if (!gains.length) return { proc, lengths: { min: 0, avg: 0, median: 0, max: 0 }, value: 0, ...spotInfo };
	const med = median(gains);
	return {
		proc: proc * 100,
		lengths: { min: Math.min(...gains), avg: gains.reduce((x, y) => x + y) / gains.length, median: med, max: Math.max(...gains) },
		value: proc * med,
		...spotInfo,
	};
}
