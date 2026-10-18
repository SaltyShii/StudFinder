import type { Job, VeteranJob, VeteranProgress, Runner, VeteranRunner } from './job';
import { workerRunner } from './jobRunner';
import type { Recommendation } from '../../../packages/scoring/src/recommend';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';

export const recommendRunner: Runner = workerRunner<Job, Recommendation>(() => new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' }));
export const veteranRunner: VeteranRunner = workerRunner<VeteranJob, AceVeteranScore[], VeteranProgress>(() => new Worker(new URL('./veterans.worker.ts', import.meta.url), { type: 'module' }));
