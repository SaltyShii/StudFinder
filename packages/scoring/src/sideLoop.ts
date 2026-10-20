import { FactorType } from '@stud-finder/lineage/src/types';
import { chanceAny, procChance } from '@stud-finder/lineage/src/inheritance';
import { aceSupply, chanceKey, greedyRank, mustHaveChance, maxStars, type Candidate, type CandidatePick, type SkillDetail } from './shared';

// Lengths-equivalent of landing the CM pink spark (aptitude up). The player re-runs the veteran until the pink lands,
// because the distance aptitude speed boost is too big to settle for less, so a landed pink is worth a fixed amount.
const PINK_LENGTHS = 1;

const PINK = 'cm-pink'; // supply key: a better pick carrying the CM pink spark supplies it like a skill

// Unlike ace and core (which use newShare, as they ignore spark chance), this weighs by inspire chance, so it subtracts the chance of the supplied tier.
function extraChance(type: FactorType, stars: number, supplied: number | undefined, affinity: number): number {
	return stars <= (supplied ?? 0) ? 0 : procChance(type, stars, affinity) - (supplied ? procChance(type, supplied, affinity) : 0);
}

// Like uma.guide's roster viewer, only sparks a veteran really carries are scored, at their real stars.
// Both the veteran and its two parents inspire: each horse rolls its own sparks with its own affinity at both inspirations.
// Marginal: a roll only counts for the stars above what the Ace and better picks supply, so a skill supplied at that tier adds nothing.
export function sideLoopPicks(candidates: Candidate[], detailOf: (id: string) => SkillDetail, top: number, aceSkills: string[] = [], mustHaves: string[] = []): CandidatePick[] {
	const ranked = greedyRank(candidates, mustHaves.length ? candidates.length : top, aceSupply(aceSkills), (c, supplied) => {
		const rolls = new Map<string, number[]>();
		for (const h of c.horses) for (const s of h.skills) {
			const p = extraChance(FactorType.Skill, s.stars, supplied.get(s.skillId), h.affinity);
			if (p > 0) rolls.set(s.skillId, [...(rolls.get(s.skillId) ?? []), p]);
		}
		const carried = [...rolls].map(([id, ps]) => ({ detail: detailOf(id), p: chanceAny(ps) }));
		const pinks = c.horses.filter((h) => h.pinkStars > 0);
		const pinkP = chanceAny(pinks.map((h) => extraChance(FactorType.Aptitude, h.pinkStars, supplied.get(PINK), h.affinity)));
		const score = carried.reduce((s, x) => s + x.p * x.detail.value, 0) + pinkP * PINK_LENGTHS;
		const reason = [pinks.length && `CM pink ${Math.max(...pinks.map((h) => h.pinkStars))} stars`, carried.length && `${carried.length} carried skill sparks`].filter(Boolean).join(', ') || 'no CM pink or carried skill sparks';
		return { pick: { candidateId: c.id, score, reason, detail: carried.map((x) => x.detail) }, supply: new Map([...maxStars(c.horses.flatMap((h) => h.skills)), [PINK, Math.max(...c.horses.map((h) => h.pinkStars))]]) };
	});
	// With Must-haves, spark % of them plus the CM pink ranks first so the veteran can parent the Ace; simulated value (the greedy order) only breaks ties.
	if (!mustHaves.length) return ranked;
	const byId = new Map(candidates.map((c) => [c.id, c]));
	const priority = (p: CandidatePick) => { const hs = byId.get(p.candidateId)?.horses ?? []; return chanceKey(mustHaveChance(hs, mustHaves) + chanceAny(hs.filter((h) => h.pinkStars > 0).map((h) => procChance(FactorType.Aptitude, h.pinkStars, h.affinity)))); };
	return ranked.sort((a, b) => priority(b) - priority(a)).slice(0, top);
}
