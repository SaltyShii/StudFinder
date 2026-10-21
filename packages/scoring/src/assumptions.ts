import type { RaceSolverBuilder } from '@stud-finder/sim/src/RaceSolverBuilder';

/** Percent chance per running style that a runner duels on the final straight. */
export interface DuelingRates {
	runaway: number;
	frontRunner: number;
	paceChaser: number;
	lateSurger: number;
	endCloser: number;
}

/** The Sim assumptions: race conditions every simulated race assumes. */
export interface SimAssumptions {
	witCheck: boolean;
	rushed: boolean;
	spotStruggle: boolean;
	dueling: boolean;
	duelingRates: DuelingRates;
	laneMovement: boolean;
}

export const DEFAULT_DUELING_RATES: DuelingRates = { runaway: 10, frontRunner: 10, paceChaser: 10, lateSurger: 10, endCloser: 10 };

/** Umalator-global's defaults: spot struggle on, wit checks off, rushed always simulated (pos keep needs a pacemaker the paired race does not run, so it is left out). Lane movement keeps the sim's own default (on); dueling is off because umalator has no such option. */
export const DEFAULT_ASSUMPTIONS: SimAssumptions = {
	witCheck: false,
	rushed: true,
	spotStruggle: true,
	dueling: false,
	duelingRates: DEFAULT_DUELING_RATES,
	laneMovement: true,
};

export function applyAssumptions(b: RaceSolverBuilder, a: SimAssumptions): RaceSolverBuilder {
	b.mode('compare').skillWisdomCheck(a.witCheck).rushedKakari(a.rushed).leadCompetition(a.spotStruggle).competeFight(a.dueling).laneMovement(a.laneMovement);
	if (a.dueling) b.duelingRates(a.duelingRates);
	return b;
}
