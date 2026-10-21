import { recommendAsync, type RefineBatch } from '../../../packages/scoring/src/recommend';
import type { SkillDetail } from '../../../packages/scoring/src/shared';
import type { JobProgress, JobRequest } from './jobs';
import { POOL_WORKERS, poolRunner, serveJob } from './jobRunner';

// Coordinates a Recommend run: the ranking and the screen step stay here, while the refine step (a list of independent skill sims) goes to a pool of jobs.worker.ts workers. Terminating this worker terminates them too.
const refinePool = poolRunner<RefineBatch, JobRequest, SkillDetail, SkillDetail[]>(
	() => new Worker(new URL('./jobs.worker.ts', import.meta.url), { type: 'module' }),
	POOL_WORKERS,
	(batch) => batch.requests.map((request): JobRequest => ({ kind: 'skill', task: { request, scenario: batch.scenario } })),
	(parts) => parts,
);
const runBatch = (batch: RefineBatch) => new Promise<SkillDetail[]>((done, fail) => { refinePool(batch, ([n]) => batch.progress(n), done, fail); });

serveJob<JobRequest, Awaited<ReturnType<typeof recommendAsync>>, JobProgress>((req, onProgress) => {
	if (req.kind !== 'recommend') throw new Error(`recommend.worker only runs recommend jobs, not ${req.kind}`);
	return recommendAsync(runBatch, req.job.candidateList, req.job.preset, req.job.tierList, req.job.owned, req.job.mustHaves, onProgress);
});
