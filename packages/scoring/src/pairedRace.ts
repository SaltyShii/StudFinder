import { RaceSolverBuilder, type HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';
import { courseFacts } from './ace';

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
}

export interface PairedRun {
	/** Lengths the skilled runner is ahead when the first of the two finishes. */
	lengths: number;
	/** At least one of the skills was used in this run. */
	activated: boolean;
}

export function median(xs: number[]) {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Races the horse without and with the skills on the same seed, once per sample. */
export function pairedRace(skillIds: string[], { horse, courseId, samples = 100, seed = 1, season, ground, weather, time }: Scenario): PairedRun[] {
	const { distance } = courseFacts(courseId); // first, so an unknown course id gets its own message
	const make = (ids: string[]) => {
		const b = new RaceSolverBuilder(samples).seed(seed).course(courseId).horse(horse);
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
		while (a.pos < distance && t.pos < distance) {
			a.step(1 / 15);
			t.step(1 / 15);
		}
		runs.push({ lengths: (t.pos - a.pos) / BASHIN, activated: skillIds.some((id) => t.usedSkills.has(id)) });
	}
	return runs;
}
