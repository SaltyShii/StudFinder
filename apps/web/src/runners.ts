import type { JobProgress, JobRequest, RecommendRunner, VeteranRunner } from './jobs';
import { veteranTasks } from './jobs';
import { POOL_WORKERS, poolRunner, workerRunner } from './jobRunner';
import { rankVeterans } from '../../../packages/scoring/src/rankVeterans';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';

const make = () => new Worker(new URL('./jobs.worker.ts', import.meta.url), { type: 'module' });
const run = workerRunner<JobRequest, unknown, JobProgress>(() => new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' }));

// Veterans score independently, so a pool shares them.
export const veteranRunner: VeteranRunner = poolRunner<Parameters<VeteranRunner>[0], JobRequest, AceVeteranScore, AceVeteranScore[]>(
	make, POOL_WORKERS, (job) => veteranTasks(job).map((task): JobRequest => ({ kind: 'veteran', task })), rankVeterans,
);

// The worker answers with whatever the request's kind produces; the cast restates that for recommend.
export const recommendRunner = ((job, onProgress, done, onError) => run({ kind: 'recommend', job }, onProgress as (p: JobProgress) => void, done as (r: unknown) => void, onError)) as RecommendRunner;
