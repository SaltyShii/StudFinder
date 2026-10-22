import { recommendAsync, type SimBatch } from '../../../packages/scoring/src/recommend';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import type { SkillDetail } from '../../../packages/scoring/src/shared';
import { aceRowsOf, recommendArgs, type JobProgress, type JobRequest } from './jobs';
import { serveJob } from './jobRunner';

// Runs the ranking and the screen step; the skill sims of a batch are a call to the page (runners.ts), which has the pool of jobs.worker.ts workers. A worker that started the pool itself stalls in Firefox.
serveJob<JobRequest, Awaited<ReturnType<typeof recommendAsync>> | AceSkillRow[], JobProgress>((req, onProgress, call) => {
	if (req.kind !== 'recommend' && req.kind !== 'aceRows') throw new Error(`recommend.worker only runs recommend jobs, not ${req.kind}`);
	const runBatch = async ({ scenario, requests, progress }: SimBatch) => (await call({ scenario, requests }, progress)) as SkillDetail[];
	const rec = recommendAsync(runBatch, ...recommendArgs(req.job, onProgress));
	return req.kind === 'aceRows' ? rec.then(aceRowsOf) : rec;
});
