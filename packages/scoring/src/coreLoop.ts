import { TIER_VALUE } from '@stud-finder/lineage/src/tiers';
import { rank, supplied, type Outfit, type Pick, type TierList } from './shared';

// Dirt sparks matter for affinity, not skills, so they get a flat per-spark credit.
const DIRT_CREDIT = 0.25;

export function coreLoopPicks(outfits: Outfit[], tierList: TierList, top: number): Pick[] {
	return rank(
		outfits
		.map((o): Pick => {
			const have = supplied(outfits, o).sparks;
			const tiered = [...new Set(o.whiteSparks ?? [])].filter((n) => n in tierList && !have.has(n));
			const dirt = o.dirtSparks ?? 0;
			const score = tiered.reduce((s, n) => s + TIER_VALUE[tierList[n]], 0) + dirt * DIRT_CREDIT;
			const best = tiered.reduce<string | undefined>((b, n) => (!b || TIER_VALUE[tierList[n]] > TIER_VALUE[tierList[b]] ? n : b), undefined);
			const reason = [best && `${tierList[best]} spark ${best}`, dirt && `${dirt} dirt for affinity`].filter(Boolean).join(', ') || 'no tiered or dirt sparks';
			return { outfitId: o.id, owned: o.owned, score, reason, detail: [] }; // no skills: tier value and dirt credit have no proc or lengths
		}),
		top,
	);
}
