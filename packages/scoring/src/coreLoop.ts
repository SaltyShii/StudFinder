import { TIER_VALUE } from '@stud-finder/lineage/src/tiers';
import { rank, type Candidate, type CandidatePick, type TierList } from './shared';

// A great-grandparent must carry dirt sparks: they raise the dirt aptitude of the grandparents built from it, which is what lifts affinity the most.
// That is a requirement, not something to maximise, so it gates the list instead of adding to the score.
function isGreatGrandparent(c: Candidate): boolean {
	return c.horses[0].dirtStars > 0;
}

// Only the veteran's own sparks count: its parents sit beyond the Ace's lineage.
export function coreLoopPicks(candidates: Candidate[], tierList: TierList, top: number): CandidatePick[] {
	return rank(
		candidates
		.filter(isGreatGrandparent)
		.map((c): CandidatePick => {
			const tiered = [...new Set(c.horses[0].skills.map((s) => s.name))].filter((n) => n in tierList);
			const score = tiered.reduce((s, n) => s + TIER_VALUE[tierList[n]], 0);
			const best = tiered.reduce<string | undefined>((b, n) => (!b || TIER_VALUE[tierList[n]] > TIER_VALUE[tierList[b]] ? n : b), undefined);
			const reason = [best && `${tierList[best]} spark ${best}`, `${c.horses[0].dirtStars} dirt stars`].filter(Boolean).join(', ');
			return { candidateId: c.id, score, reason, detail: [] }; // no skills: tier value has no proc or lengths
		}),
		top,
	);
}
