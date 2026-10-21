import { RaceSolverBuilder } from '@stud-finder/sim/src/RaceSolverBuilder';
import type { RaceSolver } from '@stud-finder/sim/src/RaceSolver';
import { CourseHelpers } from '@stud-finder/sim/src/CourseData';
import { courseFacts } from './ace';
import type { Scenario } from './pairedRace';

/** A stretch of the course in metres from the start. */
export interface Span {
	start: number;
	end: number;
}
export interface TrackOverview {
	/** Every position below is metres on this axis (0 to distance). */
	distance: number;
	/** Slope in percent: positive uphill, negative downhill. */
	slopes: (Span & { slope: number })[];
	straights: Span[];
	corners: Span[];
	/** The 4 race phases (0 early-race to 3 last spurt). */
	phases: (Span & { phase: 0 | 1 | 2 | 3 })[];
	/** The 24 equal sections the course is divided in. */
	sections: Span[];
	/** Speed (m/s) of the Baseline runner by position, ascending. */
	curve: { pos: number; speed: number }[];
}

const SECTIONS = 24;
const CURVE_STEP = 10; // metres between curve points

/** The course and the Baseline runner's speed on it: the runner of the scenario with its skills removed, one seeded race. */
export function trackOverview({ horse, courseId, seed = 1, season, ground, weather, time }: Scenario): TrackOverview {
	const { distance } = courseFacts(courseId);
	const course = CourseHelpers.getCourse(courseId);
	const b = new RaceSolverBuilder(1).seed(seed).course(courseId).horse({ ...horse, skills: [] });
	if (season != null) b.season(season);
	if (ground != null) b.ground(ground);
	if (weather != null) b.weather(weather);
	if (time != null) b.time(time);
	const solver = b.build().next().value as RaceSolver;
	const curve = [{ pos: 0, speed: solver.currentSpeed }];
	while (solver.pos < distance) {
		solver.step(1 / 15);
		if (solver.pos - curve[curve.length - 1].pos >= CURVE_STEP) curve.push({ pos: solver.pos, speed: solver.currentSpeed });
	}
	return {
		distance,
		slopes: course.slopes.map((s) => ({ start: s.start, end: s.start + s.length, slope: s.slope / 10000 })),
		straights: course.straights.map((s) => ({ start: s.start, end: s.end })),
		corners: course.corners.map((c) => ({ start: c.start, end: c.start + c.length })),
		phases: ([0, 1, 2, 3] as const).map((phase) => ({ phase, start: CourseHelpers.phaseStart(distance, phase), end: CourseHelpers.phaseEnd(distance, phase) })),
		sections: Array.from({ length: SECTIONS }, (_, i) => ({ start: (distance * i) / SECTIONS, end: (distance * (i + 1)) / SECTIONS })),
		curve,
	};
}
