import { recommend, type Recommendation } from '../../../packages/scoring/src/recommend';
import { scoreVeterans, type AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { JobProgress, JobRequest } from './jobs';

// Kept out of jobs.ts so the main bundle (App imports jobs.ts) does not pull in the scoring and sim code; only the worker and tests import this.
export function runJob(req: JobRequest, onProgress: (p: JobProgress) => void): Recommendation | AceVeteranScore[] {
	if (req.kind === 'recommend') return recommend(req.job.candidateList, req.job.preset, req.job.tierList, req.job.owned, req.job.mustHaves, onProgress);
	const { veterans, courseId, uniqueSkills } = req.job;
	return scoreVeterans(veterans, { courseId, uniqueSkills: new Map(uniqueSkills), onProgress: (done, total) => onProgress([done, total]) });
}
