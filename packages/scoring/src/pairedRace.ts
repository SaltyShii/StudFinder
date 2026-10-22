import { RaceSolverBuilder, type HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';
import { courseFacts, styleOfStrategy } from './ace';
import { applyAssumptions, DEFAULT_ASSUMPTIONS, type SimAssumptions } from './assumptions';

const BASHIN = 2.5; // metres per length

/** Race conditions a skill's activation can depend on; ids as in the sim enums (and cm-presets.json). Unset keeps the sim default (spring, sunny, firm, midday). */
export interface RaceConditions {
	season?: number;
	ground?: number;
	weather?: number;
	time?: number;
}

export interface Scenario extends RaceConditions {
	horse: HorseDesc;
	courseId: number;
	samples?: number;
	seed?: number;
	/** Race conditions the sim assumes; umalator's defaults when unset. */
	assumptions?: SimAssumptions;
}

export interface PairedRun {
	/** Lengths the skilled runner is ahead when the first of the two finishes. */
	lengths: number;
	/** At least one of the skills was used in this run. */
	activated: boolean;
	/** First activation among the skills in this run; unset when none activated. */
	spot?: ActivationSpot;
}

/** One skill activation on the track. */
export interface ActivationSpot {
	/** Metres from the start where the skill fired. */
	pos: number;
	/** Seconds its longest effect lasts. */
	duration: number;
	/** Metres where the effect has run out, or the finish when the race ended first. */
	end: number;
}

export function median(xs: number[]) {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function raceBuilder(skillIds: string[], { horse, courseId, samples = 100, seed = 1, season, ground, weather, time, assumptions = DEFAULT_ASSUMPTIONS }: Scenario) {
	const b = new RaceSolverBuilder(samples).seed(seed).course(courseId).horse(horse);
	applyAssumptions(b, assumptions);
	if (season != null) b.season(season);
	if (ground != null) b.ground(ground);
	if (weather != null) b.weather(weather);
	if (time != null) b.time(time);
	skillIds.forEach((id) => b.addSkill(id));
	return b.build();
}

/** Follows the skilled runner for the first activation among the skills and how far its effect carries. */
function spotWatcher(skillIds: string[], distance: number) {
	let spot: ActivationSpot | undefined;
	let expiry = 0;
	return {
		step(t: RaceSolver) {
			if (!spot) {
				const act = t.activations.find((x) => skillIds.includes(x.skillId));
				if (act) {
					spot = { pos: act.pos, duration: act.duration, end: distance };
					expiry = act.time + act.duration;
				}
			}
			if (spot && spot.end === distance && t.accumulatetime.t >= expiry) spot.end = Math.min(t.pos, distance);
		},
		get spot() { return spot; },
	};
}

/** Races the horse without and with the skills on the same seed, once per sample. With `versus`, the reference is that other horse instead (and every run counts as activated): what the scenario's horse gains over it. */
export function pairedRace(skillIds: string[], scenario: Scenario, versus?: HorseDesc): PairedRun[] {
	const { samples = 100 } = scenario;
	const { distance } = courseFacts(scenario.courseId); // first, so an unknown course id gets its own message
	const base = raceBuilder([], versus ? { ...scenario, horse: versus } : scenario);
	const test = raceBuilder(skillIds, scenario);
	const runs: PairedRun[] = [];
	for (let i = 0; i < samples; i++) {
		const a = base.next().value as RaceSolver;
		const t = test.next().value as RaceSolver;
		// The two runners are each other's field: two front runners in the same group is what triggers a spot struggle for both, umalator's "on" for front runners.
		a.initUmas([t]);
		t.initUmas([a]);
		const watch = spotWatcher(skillIds, distance);
		while (a.pos < distance && t.pos < distance) {
			a.step(1 / 15);
			t.step(1 / 15);
			watch.step(t);
		}
		runs.push({ lengths: (t.pos - a.pos) / BASHIN, activated: !!versus || skillIds.some((id) => t.usedSkills.has(id)), spot: watch.spot });
	}
	return runs;
}

/**
 * `pairedRace` for several skill sets of one horse, simulating the skill-less runner once per sample instead of once per set.
 * Gives the same runs as `pairedRace` only where the skill-less runner and the skilled one cannot affect each other:
 * not for front runners while the Sim assumptions have spot struggle on (it needs the other runner) and not for sets with a skill whose condition reads the order of the field.
 * Those sets are raced as before.
 */
export function pairedRaces(skillSets: string[][], scenario: Scenario, assumesPosition: (skillId: string) => boolean): PairedRun[][] {
	const { samples = 100 } = scenario;
	const { distance } = courseFacts(scenario.courseId);
	const { spotStruggle } = scenario.assumptions ?? DEFAULT_ASSUMPTIONS;
	const apart = styleOfStrategy(scenario.horse.strategy) !== 'nige' || !spotStruggle;
	const shared = skillSets.map((ids) => apart && !ids.some(assumesPosition));
	const results = skillSets.map((ids, k) => (shared[k] ? [] : pairedRace(ids, scenario)));
	if (!shared.includes(true)) return results;
	const base = raceBuilder([], scenario);
	const tests = skillSets.map((ids, k) => (shared[k] ? raceBuilder(ids, scenario) : null));
	for (let i = 0; i < samples; i++) {
		// Skill-less runner alone: where it is after each step.
		const a = base.next().value as RaceSolver;
		a.initUmas([]);
		const trace: number[] = [];
		while (a.pos < distance) { a.step(1 / 15); trace.push(a.pos); }
		skillSets.forEach((ids, k) => {
			if (!tests[k]) return;
			const t = tests[k].next().value as RaceSolver;
			t.initUmas([]);
			const watch = spotWatcher(ids, distance);
			let aPos = 0;
			for (let step = 0; aPos < distance && t.pos < distance; step++) {
				t.step(1 / 15);
				aPos = trace[step];
				watch.step(t);
			}
			results[k].push({ lengths: (t.pos - aPos) / BASHIN, activated: ids.some((id) => t.usedSkills.has(id)), spot: watch.spot });
		});
	}
	return results;
}
