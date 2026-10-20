import type { JobRequest, RecommendRunner, VeteranProgress, VeteranRunner } from './jobs';
import { workerRunner } from './jobRunner';

const run = workerRunner<JobRequest, unknown, VeteranProgress>(() => new Worker(new URL('./jobs.worker.ts', import.meta.url), { type: 'module' }));

// The worker answers with whatever the request's kind produces; the casts restate that per kind.
export const recommendRunner = ((job, onProgress, done, onError) => run({ kind: 'recommend', job }, onProgress, done as (r: unknown) => void, onError)) as RecommendRunner;
export const veteranRunner = ((job, onProgress, done, onError) => run({ kind: 'veterans', job }, onProgress, done as (r: unknown) => void, onError)) as VeteranRunner;
