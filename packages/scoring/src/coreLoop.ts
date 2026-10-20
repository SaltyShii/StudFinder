import { TIER_VALUE } from '@stud-finder/lineage/src/tiers';
import { greedyRank, isFullDirt, maxStars, newShare, type Candidate, type CandidatePick, type TierList } from './shared';

// A great-grandparent's lineage must carry dirt sparks: they raise the dirt aptitude of the grandparents built from it, which is what lifts affinity the most.
// That is a requirement, not something to maximise, so it gates the list instead of adding to the score. Full-dirt lineages (candidate and both parents)
// are the best route to dirt A through inheritance, so partial-dirt lineages (the candidate itself still has dirt) only count when no full one exists.
function dirtGate(candidates: Candidate[]): Candidate[] {
	const full = candidates.filter(isFullDirt);
	return full.length ? full : candidates.filter((c) => c.horses[0].dirtStars > 0);
}

// The candidate and its own two parents count, so a great-grandparent's whole lineage feeds the grandparents built from it.
// Marginal over what the Ace and better picks already supply, keyed by spark name as the tier list is.
export function coreLoopPicks(candidates: Candidate[], tierList: TierList, top: number, aceSkills: string[] = []): CandidatePick[] {
	return greedyRank(dirtGate(candidates), top, new Map(), (c, supplied) => {
		const stars = maxStars(c.horses.flatMap((h) => h.skills).filter((s) => s.name in tierList && !aceSkills.includes(s.skillId)), 'name');
		const marginalTier = (n: string) => TIER_VALUE[tierList[n]] * newShare(stars.get(n), supplied.get(n));
		const score = [...stars.keys()].reduce((sum, n) => sum + marginalTier(n), 0);
		const best = [...stars.keys()].filter((n) => marginalTier(n) > 0).reduce<string | undefined>((b, n) => (!b || marginalTier(n) > marginalTier(b) ? n : b), undefined);
		const reason = [best && `${tierList[best]} spark ${best}`, `${c.horses[0].dirtStars} dirt stars`].filter(Boolean).join(', ');
		return { pick: { candidateId: c.id, score, reason, detail: [] }, supply: stars }; // no skills: tier value has no proc or lengths
	});
}
