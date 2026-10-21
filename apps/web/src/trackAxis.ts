import { surfaceOf } from '../../../packages/scoring/src/ace';

/** Horizontal layout shared by every drawing on the track's distance axis (the Track overview and the Ace skill chart rows). */
export const AXIS = { left: 8, width: 984, viewWidth: 1000 } as const;

export interface DistanceAxis {
	/** Metres to an x coordinate in the SVG view box. */
	x: (metres: number) => number;
	/** Width in view box units of a stretch of track. */
	span: (start: number, end: number) => number;
	/** Gridline positions in metres, every 200 m. */
	ticks: number[];
}

export function distanceAxis(distance: number): DistanceAxis {
	const { left, width } = AXIS;
	const x = (m: number) => left + (Math.min(Math.max(m, 0), distance) / distance) * width;
	const ticks: number[] = [];
	for (let m = 0; m <= distance; m += 200) ticks.push(m);
	return { x, span: (start, end) => x(end) - x(start), ticks };
}

/** Metres between the labelled ticks of the ruler under the Track overview: every 100 m on short courses, 200 m once labels would crowd. */
export function rulerStep(distance: number): number {
	return distance <= 1800 ? 100 : 200;
}

export function rulerTicks(distance: number): number[] {
	const step = rulerStep(distance);
	const out: number[] = [];
	for (let m = 0; m <= distance; m += step) out.push(m);
	return out;
}

export interface Covered<T> {
	start: number;
	end: number;
	/** The span it came from, or null for a filler between spans. */
	item: T | null;
}

/** The spans plus fillers so the result tiles 0 to distance with no gaps (a flat stretch between two slopes, say). */
export function coverSpans<T extends { start: number; end: number }>(spans: T[], distance: number): Covered<T>[] {
	const out: Covered<T>[] = [];
	let at = 0;
	for (const s of [...spans].sort((a, b) => a.start - b.start)) {
		if (s.start > at) out.push({ start: at, end: s.start, item: null });
		out.push({ start: s.start, end: s.end, item: s });
		at = s.end;
	}
	if (at < distance) out.push({ start: at, end: distance, item: null });
	return out;
}

/** The number the game gives a corner: the last corner of a race is always 4, the one before 3, and so on. */
export function cornerNumber(index: number, count: number): number {
	return ((((index - count) % 4) + 4) % 4) + 1;
}

/** Game ids: ground 2 is dirt (surfaceOf names it), turn 2 is left-handed. */
export function isLeftHanded(course: { turn: number }): boolean {
	return course.turn === 2;
}

/** "Tokyo 1600m dirt (left-handed)": the course as the game names it. The turn code is 1 right, 2 left, 4 straight. */
export function courseTitle(course: { trackId: number; distance: number; ground: number; turn: number }, tracks: Map<number, string>): string {
	const turn = isLeftHanded(course) ? ' (left-handed)' : course.turn === 1 ? ' (right-handed)' : course.turn === 4 ? ' (straight)' : '';
	const track = tracks.get(course.trackId);
	return `${track ? `${track} ` : ''}${course.distance}m ${surfaceOf(course.ground)}${turn}`;
}
