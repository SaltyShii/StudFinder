// Kept apart from job.ts: the workers import job.ts, and Vite rejects circular worker imports.
import type { Recommendation } from '../../../packages/scoring/src/recommend';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';
import type { Runner, VeteranMessage, VeteranRunner } from './job';

// shortcut: recommend() is synchronous, so progress is a busy flag, not a percentage; split per outfit if it gets slow.
export const workerRunner: Runner = (job, done) => {
	const w = new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' });
	w.onmessage = (e: MessageEvent<Recommendation>) => { done(e.data); w.terminate(); };
	w.postMessage(job);
	return () => w.terminate();
};

export const workerVeteranRunner: VeteranRunner = (job, onProgress, done) => {
	const w = new Worker(new URL('./veterans.worker.ts', import.meta.url), { type: 'module' });
	w.onmessage = (e: MessageEvent<VeteranMessage>) => {
		if ('progress' in e.data) onProgress(...e.data.progress);
		else { done((e.data as { result: AceVeteranScore[] }).result); w.terminate(); }
	};
	w.postMessage(job);
	return () => w.terminate();
};
