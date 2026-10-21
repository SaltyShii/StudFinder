import type { JobProgress, JobRequest, RecommendRunner, VeteranRunner } from './jobs';
import { veteranTasks } from './jobs';
import { poolRunner, workerRunner } from './jobRunner';
import { rankVeterans } from '../../../packages/scoring/src/rankVeterans';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';

const make = () => new Worker(new URL('./jobs.worker.ts', import.meta.url), { type: 'module' });
const run = workerRunner<JobRequest, unknown, JobProgress>(make);

// Veterans score independently, so a few workers share them; 4 leaves cores for the page and bounds the sim data each worker loads.
const VETERAN_WORKERS = 4;
export const veteranRunner: VeteranRunner = poolRunner<Parameters<VeteranRunner>[0], JobRequest, AceVeteranScore, AceVeteranScore[]>(
	make, VETERAN_WORKERS, (job) => veteranTasks(job).map((task): JobRequest => ({ kind: 'veteran', task })), rankVeterans,
);

// The worker answers with whatever the request's kind produces; the cast restates that for recommend.
export const recommendRunner = ((job, onProgress, done, onError) => run({ kind: 'recommend', job }, onProgress as (p: JobProgress) => void, done as (r: unknown) => void, onError)) as RecommendRunner;
