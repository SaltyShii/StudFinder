import type { RaceSolverBuilder } from '@stud-finder/sim/src/RaceSolverBuilder';

/** Percent chance per running style that a runner duels on the final straight. */
export interface DuelingRates {
	runaway: number;
	frontRunner: number;
	paceChaser: number;
	lateSurger: number;
	endCloser: number;
}

/** HP other runners' skills drain from the runner in a race. The paired race has no such runners, so it is assumed. */
export interface HpDebuffs {
	count: number;
	/** Percent of max HP each one drains. */
	percent: number;
}

/** The Sim assumptions: race conditions every simulated race assumes. */
export interface SimAssumptions {
	witCheck: boolean;
	rushed: boolean;
	spotStruggle: boolean;
	dueling: boolean;
	duelingRates: DuelingRates;
	laneMovement: boolean;
	hpDebuffs: HpDebuffs;
}

export const DEFAULT_DUELING_RATES: DuelingRates = { runaway: 10, frontRunner: 10, paceChaser: 10, lateSurger: 10, endCloser: 10 };

/** Umalator-global's defaults: spot struggle on, wit checks off, rushed always simulated (pos keep needs a pacemaker the paired race does not run, so it is left out). Lane movement keeps the sim's own default (on); dueling is off because umalator has no such option. */
export const DEFAULT_HP_DEBUFFS: HpDebuffs = { count: 0, percent: 1 };

export const DEFAULT_ASSUMPTIONS: SimAssumptions = {
	witCheck: false,
	rushed: true,
	spotStruggle: true,
	dueling: false,
	duelingRates: DEFAULT_DUELING_RATES,
	laneMovement: true,
	hpDebuffs: DEFAULT_HP_DEBUFFS,
};

export function applyAssumptions(b: RaceSolverBuilder, a: SimAssumptions): RaceSolverBuilder {
	b.mode('compare').skillWisdomCheck(a.witCheck).rushedKakari(a.rushed).leadCompetition(a.spotStruggle).competeFight(a.dueling).laneMovement(a.laneMovement);
	if (a.dueling) b.duelingRates(a.duelingRates);
	// An older save has none; nothing drained draws nothing, so scores stay as they were.
	if (a.hpDebuffs?.count > 0) b.hpDebuff((a.hpDebuffs.count * a.hpDebuffs.percent) / 100);
	return b;
}
