import { sideLoopPicks } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillDetail } from './skillDetail';
import { rank, type CmPreset, type CandidatePick, type CandidateList, type SkillDetail, type TierList } from './shared';

export type { Candidate, CmPreset, LineageHorse, CandidatePick, CandidateList, SkillDetail, SkillSpark, TierList } from './shared';

export interface Recommendation {
	ace: CandidatePick[];
	core: CandidatePick[];
	side: CandidatePick[];
}

const TOP = 5;

export function recommend(roster: CandidateList, { samples = 100, seed = 1, runner: horse, ...cm }: CmPreset, tierList?: TierList): Recommendation {
	const cache = new Map<string, SkillDetail>();
	const detailOf = (skillId: string) => {
		let d = cache.get(skillId);
		if (!d) cache.set(skillId, (d = skillDetail(skillId, { ...cm, horse, samples, seed })));
		return d;
	};
	// Ignores spark chance on purpose: it counts every distinct skill the veteran and its parents carry.
	const aces = roster.candidates
		.map((c): CandidatePick => {
			const ids = [...new Set(c.horses.flatMap((h) => h.skills.map((s) => s.skillId)))].filter((id) => !horse.skills?.includes(id));
			const detail = ids.map(detailOf);
			const score = detail.reduce((s, d) => s + d.value, 0);
			const best = detail.reduce<SkillDetail | undefined>((b, d) => (!b || d.value > b.value ? d : b), undefined);
			const reason = best ? `${best.proc.toFixed(0)}% proc, ${best.lengths.median.toFixed(2)} median lengths from skill ${best.skillId}` : 'no inheritable skills';
			return { candidateId: c.id, score, reason, detail };
		});
	return { ace: rank(aces, TOP), core: tierList ? coreLoopPicks(roster.candidates, tierList, TOP) : [], side: sideLoopPicks(roster.candidates, detailOf, TOP, horse.skills) };
}
