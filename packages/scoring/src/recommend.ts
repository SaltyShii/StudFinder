import { sideLoopPicks } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillDetail } from './skillDetail';
import { aceSupply, greedyRank, maxStars, newShare, type CmPreset, type CandidatePick, type CandidateList, type SkillDetail, type TierList } from './shared';

export type { Candidate, CmPreset, LineageHorse, CandidatePick, CandidateList, SkillDetail, SkillSpark, TierList } from './shared';

export interface Recommendation {
	ace: CandidatePick[];
	core: CandidatePick[];
	side: CandidatePick[];
}

const TOP = 5;

export function recommend(candidateList: CandidateList, { samples = 100, seed = 1, runner: horse, ...cm }: CmPreset, tierList?: TierList): Recommendation {
	const cache = new Map<string, SkillDetail>();
	const detailOf = (skillId: string) => {
		let d = cache.get(skillId);
		if (!d) cache.set(skillId, (d = skillDetail(skillId, { ...cm, horse, samples, seed })));
		return d;
	};
	// Ignores spark chance on purpose: it counts every distinct skill the veteran and its parents carry, marginal over what better picks supply.
	const ace = greedyRank(candidateList.candidates, TOP, aceSupply(horse.skills), (c, supplied) => {
		const stars = maxStars(c.horses.flatMap((h) => h.skills));
		const detail = [...stars.keys()].filter((id) => newShare(stars.get(id), supplied.get(id)) > 0).map(detailOf);
		const marginalValue = (d: SkillDetail) => d.value * newShare(stars.get(d.skillId), supplied.get(d.skillId));
		const score = detail.reduce((s, d) => s + marginalValue(d), 0);
		const best = detail.reduce<SkillDetail | undefined>((b, d) => (!b || marginalValue(d) > marginalValue(b) ? d : b), undefined);
		const reason = best ? `${best.proc.toFixed(0)}% proc, ${best.lengths.median.toFixed(2)} median lengths from skill ${best.skillId}` : 'no inheritable skills';
		return { pick: { candidateId: c.id, score, reason, detail }, supply: stars };
	});
	return { ace, core: tierList ? coreLoopPicks(candidateList.candidates, tierList, TOP, horse.skills) : [], side: sideLoopPicks(candidateList.candidates, detailOf, TOP, horse.skills) };
}
