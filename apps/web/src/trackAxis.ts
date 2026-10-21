/** Horizontal layout shared by every drawing on the track's distance axis (the Track overview now, skill rows later). */
export const AXIS = { left: 8, width: 984, viewWidth: 1000 } as const;

export interface DistanceAxis {
	/** Metres to an x coordinate in the SVG view box. */
	x: (metres: number) => number;
	/** Width in view box units of a stretch of track. */
	span: (start: number, end: number) => number;
	/** Gridline positions in metres, every 200 m. */
	ticks: number[];
}

export function distanceAxis(distance: number, { left, width }: { left: number; width: number } = AXIS): DistanceAxis {
	const x = (m: number) => left + (Math.min(Math.max(m, 0), distance) / distance) * width;
	const ticks: number[] = [];
	for (let m = 0; m <= distance; m += 200) ticks.push(m);
	return { x, span: (start, end) => x(end) - x(start), ticks };
}
