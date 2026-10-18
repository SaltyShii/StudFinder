import { TIER_VALUE, type Tier } from '@stud-finder/lineage/src/tiers';
import type { Outfit, Pick } from './recommend';

/** Spark name (as in the tier list) to tier. */
export type TierList = Record<string, Tier>;

// Dirt sparks matter for affinity, not skills, so they get a flat per-spark credit.
const DIRT_CREDIT = 0.25;

export function coreLoopPicks(outfits: Outfit[], tierList: TierList, top: number): Pick[] {
	return outfits
		.map((o): Pick => {
			const tiered = [...new Set(o.whiteSparks ?? [])].filter((n) => n in tierList);
			const dirt = o.dirtSparks ?? 0;
			const score = tiered.reduce((s, n) => s + TIER_VALUE[tierList[n]], 0) + dirt * DIRT_CREDIT;
			const best = tiered.reduce<string | undefined>((b, n) => (!b || TIER_VALUE[tierList[n]] > TIER_VALUE[tierList[b]] ? n : b), undefined);
			const reason = [best && `${tierList[best]} spark ${best}`, dirt && `${dirt} dirt for affinity`].filter(Boolean).join(', ') || 'no tiered or dirt sparks';
			return { outfitId: o.id, owned: o.owned, score, reason, detail: [] };
		})
		.sort((a, b) => b.score - a.score || a.outfitId.localeCompare(b.outfitId))
		.slice(0, top);
}
