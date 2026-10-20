// Conserve power (asitame) per docs/race-mechanics.md "Late-game mechanics"; the community PDF wins (ADR 0001).
import { Strategy } from './HorseTypes';
import { DistanceType } from './CourseData';

// Strategy rows are 1-indexed (nige, senkou, sasi, oikomi, oonige); distance rows by DistanceType.
const StrategyDistanceCoefficient = Object.freeze([
	[],
	[0, 1.0, 0.7, 0.75, 0.7, 1.0], // short
	[0, 1.0, 0.8, 0.7, 0.75, 1.0], // mile
	[0, 1.0, 0.9, 0.875, 0.86, 1.0], // mid
	[0, 1.0, 0.9, 1.0, 0.9, 1.0] // long
]);

// Doc gives four values for four styles; Oonige is treated as Nige.
const StyleCoef = Object.freeze([0, 1, 0.75, 1, 0.7, 1]);

export const ConserveSections = 10;

// BasePower is the capped part (min(raw, 1200)) times motivation, so the halved overflow is not counted twice.
export function powerStat(rawPower: number, motivation: number, skillPower: number) {
	return Math.min(rawPower, 1200) * motivation + 0.5 * Math.max(rawPower - 1200, 0) + skillPower;
}

export function creditPerSecond(strategy: Strategy, paceDown: boolean) {
	return (paceDown ? 6.7 : 4.2) * StyleCoef[strategy];
}

// ActivityCoef is 1 here: the spot struggle (0.95) and rushed (0.8) factors scale the credit instead, as the doc's mechanics section says.
export function releaseAccel(power: number, strategy: Strategy, distance: DistanceType) {
	if (power <= 1200) return 0;
	return Math.sqrt((power - 1200) * 130) * 0.001 * StrategyDistanceCoefficient[distance][strategy];
}

// DistanceTypeCoef is 1 for every distance type (the doc lists no values) and Conserved is the raw credit sum, unitless.
export function releaseDuration(conserved: number, distance: number) {
	return (conserved * Math.sqrt(distance)) / 1450;
}
