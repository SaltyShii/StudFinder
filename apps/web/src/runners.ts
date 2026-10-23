import type { AceRowsRunner, JobProgress, JobRequest, RecommendRunner, VeteranRunner } from './jobs';
import { veteranTasks } from './jobs';
import { POOL_WORKERS, poolRunner, workerRunner } from './jobRunner';
import type { SimBatch, SimResult } from '../../../packages/scoring/src/recommend';
import { rankVeterans } from '../../../packages/scoring/src/rankVeterans';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';

const make = () => new Worker(new URL('./jobs.worker.ts', import.meta.url), { type: 'module' });

// Veterans score independently, so a pool shares them.
export const veteranRunner: VeteranRunner = poolRunner<Parameters<VeteranRunner>[0], JobRequest, AceVeteranScore, AceVeteranScore[]>(
	make, POOL_WORKERS, (job) => veteranTasks(job).map((task): JobRequest => ({ kind: 'veteran', task })), rankVeterans,
);

// The skill sims and Whole-Ace runs of a Recommend run's batches are independent too. The pool is started here, not in recommend.worker.ts, which asks for it with a call.
type Batch = Pick<SimBatch, 'scenario' | 'requests'>;
const skillPool = poolRunner<Batch, JobRequest, SimResult, SimResult[]>(
	make, POOL_WORKERS, (batch) => batch.requests.map((request): JobRequest => ({ kind: 'sim', task: { request, scenario: batch.scenario } })), (parts) => parts,
);
const run = workerRunner<JobRequest, unknown, JobProgress>(
	() => new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' }),
	(batch, onProgress, done, onError) => skillPool(batch as Batch, ([n]) => onProgress(n), done, onError),
);

// The worker answers with whatever the request's kind produces; the cast restates that for the runner's result type.
const runnerOf = <R extends RecommendRunner | AceRowsRunner>(kind: 'recommend' | 'aceRows') => ((job, onProgress, done, onError) => run({ kind, job }, onProgress as (p: JobProgress) => void, done as (r: unknown) => void, onError)) as R;
export const recommendRunner = runnerOf<RecommendRunner>('recommend');
export const aceRowsRunner = runnerOf<AceRowsRunner>('aceRows');
