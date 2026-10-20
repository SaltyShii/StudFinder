import { TIER_VALUE } from '@stud-finder/lineage/src/tiers';
import { greedyRank, newShare, type Candidate, type CandidatePick, type TierList } from './shared';

// A great-grandparent must carry dirt sparks: they raise the dirt aptitude of the grandparents built from it, which is what lifts affinity the most.
// That is a requirement, not something to maximise, so it gates the list instead of adding to the score.
function isGreatGrandparent(c: Candidate): boolean {
	return c.horses[0].dirtStars > 0;
}

// Only the veteran's own sparks count: its parents sit beyond the Ace's lineage.
// Marginal over what the Ace and better picks already supply, keyed by spark name as the tier list is.
export function coreLoopPicks(candidates: Candidate[], tierList: TierList, top: number, aceSkills: string[] = []): CandidatePick[] {
	return greedyRank(candidates.filter(isGreatGrandparent), top, new Map(), (c, supplied) => {
		const stars = new Map<string, number>();
		for (const s of c.horses[0].skills) if (s.name in tierList && !aceSkills.includes(s.skillId)) stars.set(s.name, Math.max(stars.get(s.name) ?? 0, s.stars));
		const gain = (n: string) => TIER_VALUE[tierList[n]] * newShare(stars.get(n)!, supplied.get(n));
		const score = [...stars.keys()].reduce((sum, n) => sum + gain(n), 0);
		const best = [...stars.keys()].filter((n) => gain(n) > 0).reduce<string | undefined>((b, n) => (!b || gain(n) > gain(b) ? n : b), undefined);
		const reason = [best && `${tierList[best]} spark ${best}`, `${c.horses[0].dirtStars} dirt stars`].filter(Boolean).join(', ');
		return { pick: { candidateId: c.id, score, reason, detail: [] }, supply: stars }; // no skills: tier value has no proc or lengths
	});
}
