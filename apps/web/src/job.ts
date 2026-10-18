import type { Veteran } from '../../../packages/lineage/src/types';
import { recommend, type CmPreset, type Recommendation, type Roster, type TierList } from '../../../packages/scoring/src/recommend';
import { scoreVeterans, type AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { JobRunner } from './jobRunner';

export interface VeteranJob {
	veterans: Veteran[];
	courseId: number;
	/** [card id, unique skill id] pairs (structured-cloneable for the worker). */
	uniqueSkills: [number, number][];
}
export type VeteranProgress = [done: number, total: number];
export type VeteranRunner = JobRunner<VeteranJob, AceVeteranScore[], VeteranProgress>;

export function computeVeterans({ veterans, courseId, uniqueSkills }: VeteranJob, onProgress?: (done: number, total: number) => void): AceVeteranScore[] {
	return scoreVeterans(veterans, { courseId, uniqueSkills: new Map(uniqueSkills), onProgress });
}

export interface Job {
	roster: Roster;
	preset: CmPreset;
	tierList?: TierList;
}
// shortcut: recommend() is synchronous, so progress is a busy flag, not a percentage; split per candidate if it gets slow.
export type Runner = JobRunner<Job, Recommendation>;

export function compute({ roster, preset, tierList }: Job): Recommendation {
	return recommend(roster, preset, tierList);
}
