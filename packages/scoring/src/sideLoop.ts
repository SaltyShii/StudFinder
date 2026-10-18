import { FactorType } from '@stud-finder/lineage/src/types';
import { chanceAny, procChance } from '@stud-finder/lineage/src/inheritance';
import { rank, type Candidate, type Pick, type SkillDetail } from './shared';

// Lengths-equivalent of landing the CM pink spark (aptitude up). The player re-runs the veteran until the pink lands,
// because the distance aptitude speed boost is too big to settle for less, so a landed pink is worth a fixed amount.
const PINK_LENGTHS = 1;

// Like uma.guide's roster viewer, only sparks a veteran really carries are scored, at their real stars.
// Both the veteran and its two parents inspire: each horse rolls its own sparks with its own affinity at both inspirations.
export function sideLoopPicks(candidates: Candidate[], detailOf: (id: string) => SkillDetail, top: number, aceSkills: string[] = []): Pick[] {
	return rank(
		candidates
		.map((c): Pick => {
			const rolls = new Map<string, number[]>();
			for (const h of c.horses) for (const s of h.skills) rolls.set(s.skillId, [...(rolls.get(s.skillId) ?? []), procChance(FactorType.Skill, s.stars, h.affinity)]);
			// Skills the Ace already has cannot be inherited.
			const carried = [...rolls].filter(([id]) => !aceSkills.includes(id)).map(([id, ps]) => ({ detail: detailOf(id), p: chanceAny(ps) }));
			const pinks = c.horses.filter((h) => h.pinkStars > 0);
			const pinkP = chanceAny(pinks.map((h) => procChance(FactorType.Aptitude, h.pinkStars, h.affinity)));
			const score = carried.reduce((s, x) => s + x.p * x.detail.value, 0) + pinkP * PINK_LENGTHS;
			const reason = [pinks.length && `CM pink ${Math.max(...pinks.map((h) => h.pinkStars))} stars`, carried.length && `${carried.length} carried skill sparks`].filter(Boolean).join(', ') || 'no CM pink or carried skill sparks';
			return { candidateId: c.id, score, reason, detail: carried.map((x) => x.detail) };
		}),
		top,
	);
}
