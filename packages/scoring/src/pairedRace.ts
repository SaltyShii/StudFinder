import { RaceSolverBuilder, type HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';
import { courseFacts } from './courseFacts';

const BASHIN = 2.5; // metres per length

export interface Scenario {
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
export function pairedRace(skillIds: string[], { horse, courseId, samples = 100, seed = 1 }: Scenario): PairedRun[] {
	const { distance } = courseFacts(courseId); // first, so an unknown course id gets its own message
	const make = (ids: string[]) => {
		const b = new RaceSolverBuilder(samples).seed(seed).course(courseId).horse(horse);
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
