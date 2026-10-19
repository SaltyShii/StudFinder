import { recommend, type CmPreset, type Recommendation, type CandidateList, type TierList } from '../../../packages/scoring/src/recommend';
import type { JobRunner } from './jobRunner';

export interface RecommendJob {
	candidateList: CandidateList;
	preset: CmPreset;
	tierList?: TierList;
}
// shortcut: recommend() is synchronous, so progress is a busy flag, not a percentage; split per candidate if it gets slow.
export type RecommendRunner = JobRunner<RecommendJob, Recommendation>;

export function computeRecommend({ candidateList, preset, tierList }: RecommendJob): Recommendation {
	return recommend(candidateList, preset, tierList);
}
