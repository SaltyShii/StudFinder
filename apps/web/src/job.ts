import { recommend, type CmPreset, type Recommendation, type Roster, type TierList } from '../../../packages/scoring/src/recommend';

export interface Job {
	roster: Roster;
	preset: CmPreset;
	tierList?: TierList;
}
/** Starts a job; the returned function cancels it. */
export type Runner = (job: Job, done: (r: Recommendation) => void) => () => void;

export function compute({ roster, preset, tierList }: Job): Recommendation {
	return recommend(roster, preset, tierList);
}

// shortcut: recommend() is synchronous, so progress is a busy flag, not a percentage; split per outfit if it gets slow.
export const workerRunner: Runner = (job, done) => {
	const w = new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' });
	w.onmessage = (e: MessageEvent<Recommendation>) => { done(e.data); w.terminate(); };
	w.postMessage(job);
	return () => w.terminate();
};
