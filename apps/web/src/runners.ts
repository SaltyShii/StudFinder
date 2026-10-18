// Kept apart from job.ts: the workers import job.ts, and Vite rejects circular worker imports.
import type { Recommendation } from '../../../packages/scoring/src/recommend';
import type { Runner, VeteranMessage, VeteranRunner } from './job';

// shortcut: recommend() is synchronous, so progress is a busy flag, not a percentage; split per outfit if it gets slow.
export const workerRunner: Runner = (job, done) => {
	const w = new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' });
	w.onmessage = (e: MessageEvent<Recommendation>) => { done(e.data); w.terminate(); };
	w.postMessage(job);
	return () => w.terminate();
};

function isMessage(m: unknown): m is VeteranMessage {
	if (typeof m !== 'object' || m === null) return false;
	if ('progress' in m) return Array.isArray(m.progress) && m.progress.length === 2 && m.progress.every((n) => typeof n === 'number');
	return 'result' in m && Array.isArray(m.result);
}

export const workerVeteranRunner: VeteranRunner = (job, onProgress, done) => {
	const w = new Worker(new URL('./veterans.worker.ts', import.meta.url), { type: 'module' });
	w.onmessage = (e: MessageEvent<VeteranMessage>) => {
		const m = e.data;
		if (isMessage(m) && 'progress' in m) onProgress(...m.progress);
		else if (isMessage(m) && 'result' in m) { done(m.result); w.terminate(); }
	};
	w.postMessage(job);
	return () => w.terminate();
};
