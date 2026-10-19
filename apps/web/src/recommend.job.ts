import { recommend, type CmPreset, type Recommendation, type Roster, type TierList } from '../../../packages/scoring/src/recommend';
import type { JobRunner } from './jobRunner';

export interface RecommendJob {
	roster: Roster;
	preset: CmPreset;
	tierList?: TierList;
}
// shortcut: recommend() is synchronous, so progress is a busy flag, not a percentage; split per candidate if it gets slow.
export type RecommendRunner = JobRunner<RecommendJob, Recommendation>;

export function computeRecommend({ roster, preset, tierList }: RecommendJob): Recommendation {
	return recommend(roster, preset, tierList);
}
