import type { Veteran } from '../../../packages/lineage/src/types';
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
