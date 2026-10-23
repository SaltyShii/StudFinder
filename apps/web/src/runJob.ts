import { recommend, simulateRequest, type AceSkillRow, type Recommendation, type SimResult } from '../../../packages/scoring/src/recommend';
import { scoreVeteran, type AceVeteranScore } from '../../../packages/scoring/src/veterans';
import { aceRowsOf, recommendArgs, type JobProgress, type JobRequest } from './jobs';

// Kept out of jobs.ts so the main bundle (App imports jobs.ts) does not pull in the scoring and sim code; only the worker and tests import this.
export function runJob(req: JobRequest, onProgress: (p: JobProgress) => void): Recommendation | AceSkillRow[] | AceVeteranScore | SimResult {
	if (req.kind === 'recommend') return recommend(...recommendArgs(req.job, onProgress));
	if (req.kind === 'aceRows') return aceRowsOf(recommend(...recommendArgs(req.job, onProgress)));
	if (req.kind === 'sim') return simulateRequest(req.task.request, req.task.scenario);
	const { veteran, ...options } = req.task;
	return scoreVeteran(veteran, options);
}
