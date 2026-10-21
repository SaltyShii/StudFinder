// Apart from veterans.ts so the main bundle can rank pooled results without pulling in the sim.
import type { AceVeteranScore } from './veterans';

/** Best first, ties by trained id; `gap` is the lengths behind the best. */
export function rankVeterans(scored: AceVeteranScore[]): AceVeteranScore[] {
	const sorted = [...scored].sort((a, b) => b.setLengthsGained - a.setLengthsGained || a.trainedId - b.trainedId);
	const best = sorted[0]?.setLengthsGained ?? 0;
	return sorted.map((s) => ({ ...s, gap: best - s.setLengthsGained }));
}
