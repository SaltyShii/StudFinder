import { strict as assert } from 'node:assert';

export enum Strategy { Nige = 1, Senkou, Sasi, Oikomi, Oonige }
export enum Aptitude { S, A, B, C, D, E, F, G }

export const StrategyProficiencyModifier = Object.freeze([1.1, 1.0, 0.85, 0.75, 0.6, 0.4, 0.2, 0.1]);

export interface HorseParameters {
	readonly speed: number
	readonly stamina: number
	readonly power: number
	readonly guts: number
	readonly wisdom: number
	readonly strategy: Strategy
	readonly distanceAptitude: Aptitude
	readonly surfaceAptitude: Aptitude
	readonly strategyAptitude: Aptitude
	readonly rawStamina: number
	readonly rawWisdom: number  // Base wisdom before strategy proficiency (used for skill activation chance)
}

export namespace StrategyHelpers {
	export function assertIsStrategy(strategy: number): asserts strategy is Strategy {
		assert(Strategy.hasOwnProperty(strategy));
	}

	export function strategyMatches(s1: Strategy, s2: Strategy) {
		return s1 == s2 || (s1 == Strategy.Nige && s2 == Strategy.Oonige) || (s1 == Strategy.Oonige && s2 == Strategy.Nige);
	}
}
