import type { EffectKind } from '../../../packages/scoring/src/density';

export interface ChipInput {
	id: string;
	label: string;
	/** Metres where the chip points (the skill's median Activation spot). */
	pos: number;
	/** What the skill's effect does for the runner at that spot: speeds it up (accelerating), only lifts top speed (cruise), or neither. */
	kind: Exclude<EffectKind, 'ended'> | 'neutral';
}
export interface PlacedChip extends ChipInput {
	/** 0 is the row nearest the track, higher rows stack above it. */
	lane: number;
	/** Chip centre in metres, nudged inside the course so the label is not cut off. */
	at: number;
}

const MAX_CHIPS = 10;
const LANES = 4;
// Names are cut to this many characters on screen, so longer ones take no more room.
export const CHIP_CHARS = 11;
// Rough on-screen size: the axis is about this many pixels wide, a label character about CHAR_PX.
const AXIS_PX = 800;
const CHAR_PX = 6.5;
const PAD_PX = 16;
const GAP_PX = 4;

/** Name chips for the best skills, best first: at most MAX_CHIPS, each on the first of LANES rows where it does not overlap an earlier chip. A chip that fits nowhere is dropped, so the labels stay readable. */
export function placeChips(items: ChipInput[], distance: number): PlacedChip[] {
	const metres = (px: number) => (px / AXIS_PX) * distance;
	const lanes: { from: number; to: number }[][] = Array.from({ length: LANES }, () => []);
	const out: PlacedChip[] = [];
	for (const item of items) {
		if (out.length >= MAX_CHIPS) break;
		const half = metres(Math.min(item.label.length, CHIP_CHARS) * CHAR_PX + PAD_PX) / 2;
		const at = Math.min(Math.max(item.pos, half), distance - half);
		const from = at - half - metres(GAP_PX);
		const to = at + half + metres(GAP_PX);
		const lane = lanes.findIndex((taken) => taken.every((t) => to <= t.from || from >= t.to));
		if (lane < 0) continue;
		lanes[lane].push({ from, to });
		out.push({ ...item, lane, at });
	}
	return out;
}
