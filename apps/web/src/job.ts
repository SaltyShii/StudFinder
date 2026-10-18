import type { Veteran } from '../../../packages/lineage/src/types';
import { recommend, type CmPreset, type Recommendation, type Roster, type TierList } from '../../../packages/scoring/src/recommend';
import { scoreVeterans, type AceVeteranScore } from '../../../packages/scoring/src/veterans';

export interface VeteranJob {
	veterans: Veteran[];
	courseId: number;
	/** [card id, unique skill id] pairs (structured-cloneable for the worker). */
	uniqueSkills: [number, number][];
}
/** Progress is posted from inside the worker; the returned function cancels by terminating it. */
export type VeteranRunner = (job: VeteranJob, onProgress: (done: number, total: number) => void, done: (r: AceVeteranScore[]) => void) => () => void;

export function computeVeterans({ veterans, courseId, uniqueSkills }: VeteranJob, onProgress?: (done: number, total: number) => void): AceVeteranScore[] {
	return scoreVeterans(veterans, { courseId, uniqueSkills: new Map(uniqueSkills), onProgress });
}

export type VeteranMessage = { progress: [number, number] } | { result: AceVeteranScore[] };

export interface Job {
	roster: Roster;
	preset: CmPreset;
	tierList?: TierList;
}
/** Starts a job; the returned function cancels it. */
export type Runner = (job: Job, done: (r: Recommendation) => void) => () => void;

export function compute({ roster, preset, tierList }: Job): Recommendation {
	return recommend(roster, preset, tierList);
}
