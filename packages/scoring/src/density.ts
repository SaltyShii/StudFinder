/** Where a skill fires over the simulated runs, as a histogram over the course. */
export interface SpotDensity {
	/** Metres per bin. */
	binWidth: number;
	/** Share of activations per bin (sums to 1); empty when the skill never fired. */
	bins: number[];
}

export interface DensityOptions {
	binWidth?: number;
	/** Bins either side the triangular smoothing reaches. */
	smooth?: number;
}

const BIN_WIDTH = 10;
const SMOOTH = 3;

/** Histogram of activation positions, lightly smoothed with a triangular kernel so a handful of runs reads as a curve. The total stays 1. */
export function spotDensity(positions: number[], distance: number, { binWidth = BIN_WIDTH, smooth = SMOOTH }: DensityOptions = {}): SpotDensity {
	if (!positions.length) return { binWidth, bins: [] };
	const n = Math.ceil(distance / binWidth);
	const raw = new Array<number>(n).fill(0);
	for (const p of positions) raw[Math.min(Math.max(Math.floor(p / binWidth), 0), n - 1)] += 1 / positions.length;
	if (smooth <= 0) return { binWidth, bins: raw };
	const bins = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
		if (!raw[i]) continue;
		// Weights fall off linearly; renormalised per source bin so mass near an edge is kept.
		const lo = Math.max(i - smooth, 0);
		const hi = Math.min(i + smooth, n - 1);
		let total = 0;
		for (let j = lo; j <= hi; j++) total += smooth + 1 - Math.abs(j - i);
		for (let j = lo; j <= hi; j++) bins[j] += (raw[i] * (smooth + 1 - Math.abs(j - i))) / total;
	}
	return { binWidth, bins };
}

/** Spots this close together (metres) are one fixed spot, drawn as a pin rather than a spike. */
const FIXED_SPREAD = 5;

export function isFixedSpot(spread: { min: number; max: number }): boolean {
	return spread.max - spread.min <= FIXED_SPREAD;
}

export type EffectKind = 'accelerating' | 'cruise' | 'ended';
export interface EffectStretch {
	start: number;
	end: number;
	kind: EffectKind;
}

import { median } from './pairedRace';

// Speed gain in m/s between two curve points (10 m apart) that still counts as accelerating.
const ACCELERATING_SPEED_DELTA = 0.01;

/**
 * What a speed effect can do for the Baseline runner along [from, reach]: 'accelerating' where the runner is still gaining speed (acceleration and target speed both help),
 * 'cruise' where it already holds its target speed (only a target speed effect helps), then 'ended' from reach to the finish. Neighbouring spans of one kind are merged.
 */
export function effectStretches(curve: { pos: number; speed: number }[], from: number, reach: number, distance: number): EffectStretch[] {
	const out: EffectStretch[] = [];
	const push = (start: number, end: number, kind: EffectKind) => {
		if (end <= start) return;
		const last = out[out.length - 1];
		if (last && last.kind === kind && last.end === start) last.end = end;
		else out.push({ start, end, kind });
	};
	const live = Math.min(reach, distance);
	for (let i = 0; i + 1 < curve.length; i++) {
		const a = curve[i];
		const b = curve[i + 1];
		push(Math.max(a.pos, from), Math.min(b.pos, live), b.speed - a.speed > ACCELERATING_SPEED_DELTA ? 'accelerating' : 'cruise');
	}
	if (reach < distance) push(Math.max(live, from), distance, 'ended');
	return out;
}

/** A skill row's reach and effect stretches from `from`: the effect is assumed to last until the median end of its Activation spots, but never ends before `reachFloor`. */
export function rowEffect(curve: { pos: number; speed: number }[], spots: { end: number }[], from: number, distance: number, reachFloor = from): { reach: number; stretches: EffectStretch[] } {
	const reach = Math.max(median(spots.map((s) => s.end)), reachFloor);
	return { reach, stretches: effectStretches(curve, from, reach, distance) };
}
