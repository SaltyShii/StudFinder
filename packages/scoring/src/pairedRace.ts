import { RaceSolverBuilder, type HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';
import { courseFacts } from './ace';
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

/** Races the horse without and with the skills on the same seed, once per sample. */
export function pairedRace(skillIds: string[], { horse, courseId, samples = 100, seed = 1, season, ground, weather, time, assumptions = DEFAULT_ASSUMPTIONS }: Scenario): PairedRun[] {
	const { distance } = courseFacts(courseId); // first, so an unknown course id gets its own message
	const make = (ids: string[]) => {
		const b = new RaceSolverBuilder(samples).seed(seed).course(courseId).horse(horse);
		applyAssumptions(b, assumptions);
		if (season != null) b.season(season);
		if (ground != null) b.ground(ground);
		if (weather != null) b.weather(weather);
		if (time != null) b.time(time);
		ids.forEach((id) => b.addSkill(id));
		return b.build();
	};
	const base = make([]);
	const test = make(skillIds);
	const runs: PairedRun[] = [];
	for (let i = 0; i < samples; i++) {
		const a = base.next().value as RaceSolver;
		const t = test.next().value as RaceSolver;
		// The two runners are each other's field: two front runners in the same group is what triggers a spot struggle for both, umalator's "on" for front runners.
		a.initUmas([t]);
		t.initUmas([a]);
		let spot: ActivationSpot | undefined;
		let expiry = 0;
		while (a.pos < distance && t.pos < distance) {
			a.step(1 / 15);
			t.step(1 / 15);
			if (!spot) {
				const act = t.activations.find((x) => skillIds.includes(x.skillId));
				if (act) {
					spot = { pos: act.pos, duration: act.duration, end: distance };
					expiry = act.time + act.duration;
				}
			}
			if (spot && spot.end === distance && t.accumulatetime.t >= expiry) spot.end = Math.min(t.pos, distance);
		}
		runs.push({ lengths: (t.pos - a.pos) / BASHIN, activated: skillIds.some((id) => t.usedSkills.has(id)), spot });
	}
	return runs;
}
