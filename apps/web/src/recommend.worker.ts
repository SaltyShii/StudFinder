import { recommendAsync, type SimBatch } from '../../../packages/scoring/src/recommend';
import type { SkillDetail } from '../../../packages/scoring/src/shared';
import type { JobProgress, JobRequest } from './jobs';
import { serveJob } from './jobRunner';

// Runs the ranking and the screen step; the skill sims of a batch are a call to the page (runners.ts), which has the pool of jobs.worker.ts workers. A worker that started the pool itself stalls in Firefox.
serveJob<JobRequest, Awaited<ReturnType<typeof recommendAsync>>, JobProgress>((req, onProgress, call) => {
	if (req.kind !== 'recommend') throw new Error(`recommend.worker only runs recommend jobs, not ${req.kind}`);
	const runBatch = async ({ scenario, requests, progress }: SimBatch) => (await call({ scenario, requests }, progress)) as SkillDetail[];
	return recommendAsync(runBatch, req.job.candidateList, req.job.preset, req.job.tierList, req.job.owned, req.job.mustHaves, onProgress, req.job.loopVersions);
});
