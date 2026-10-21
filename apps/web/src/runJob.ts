import { recommend, simulateSkill, type Recommendation } from '../../../packages/scoring/src/recommend';
import { scoreVeteran, type AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { SkillDetail } from '../../../packages/scoring/src/shared';
import type { JobProgress, JobRequest } from './jobs';

// Kept out of jobs.ts so the main bundle (App imports jobs.ts) does not pull in the scoring and sim code; only the worker and tests import this.
export function runJob(req: JobRequest, onProgress: (p: JobProgress) => void): Recommendation | AceVeteranScore | SkillDetail {
	if (req.kind === 'recommend') return recommend(req.job.candidateList, req.job.preset, req.job.tierList, req.job.owned, req.job.mustHaves, onProgress);
	if (req.kind === 'skill') return simulateSkill(req.task.request, req.task.scenario);
	const { veteran, ...options } = req.task;
	return scoreVeteran(veteran, options);
}
