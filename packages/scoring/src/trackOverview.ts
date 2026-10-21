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
	/** Relative height in metres by position, ascending, from 0 at the start: the slopes added up (the course data has no absolute heights). */
	heights: { pos: number; height: number }[];
	/** Where the race changes gear for the Baseline runner: the start dash, the rest of the position-keep window, and the last-spurt kick. */
	events: { name: 'Start' | 'Pace change' | 'Last-spurt kick'; start: number; end: number }[];
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
	let dashEnd = -1;
	let kickStart = -1;
	let kickEnd = -1;
	while (solver.pos < distance) {
		solver.step(1 / 15);
		if (dashEnd < 0 && !solver.startDash) dashEnd = solver.pos;
		if (kickStart < 0 && solver.isLastSpurt) kickStart = solver.pos;
		else if (kickStart >= 0 && kickEnd < 0 && solver.currentSpeed >= solver.lastSpurtSpeed - 0.05) kickEnd = solver.pos;
		if (solver.pos - curve[curve.length - 1].pos >= CURVE_STEP) curve.push({ pos: solver.pos, speed: solver.currentSpeed });
	}
	const slopes = course.slopes.map((s) => ({ start: s.start, end: s.start + s.length, slope: s.slope / 10000 }));
	const dash = Math.min(dashEnd < 0 ? distance : dashEnd, solver.posKeepEnd);
	return {
		distance,
		heights: heightProfile(slopes, distance),
		events: [
			{ name: 'Start', start: 0, end: dash },
			{ name: 'Pace change', start: dash, end: Math.max(solver.posKeepEnd, dash) },
			// A runner that never reaches its spurt speed before the finish is kicking to the line.
			{ name: 'Last-spurt kick', start: kickStart < 0 ? distance : kickStart, end: kickEnd < 0 ? distance : kickEnd },
		],
		slopes,
		straights: course.straights.map((s) => ({ start: s.start, end: s.end })),
		corners: course.corners.map((c) => ({ start: c.start, end: c.start + c.length })),
		phases: ([0, 1, 2, 3] as const).map((phase) => ({ phase, start: CourseHelpers.phaseStart(distance, phase), end: CourseHelpers.phaseEnd(distance, phase) })),
		sections: Array.from({ length: SECTIONS }, (_, i) => ({ start: (distance * i) / SECTIONS, end: (distance * (i + 1)) / SECTIONS })),
		curve,
	};
}

function heightProfile(slopes: (Span & { slope: number })[], distance: number): { pos: number; height: number }[] {
	const points = [{ pos: 0, height: 0 }];
	let h = 0;
	let at = 0;
	const push = (pos: number) => points.push({ pos, height: h });
	for (const s of [...slopes].sort((a, b) => a.start - b.start)) {
		if (s.start > at) push(s.start);
		h += ((s.end - s.start) * s.slope) / 100;
		at = s.end;
		push(s.end);
	}
	if (at < distance) push(distance);
	return points;
}
