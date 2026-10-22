import { useEffect, useRef, useState } from 'preact/hooks';
import type { AceSkillRow, Recommendation } from '../../../packages/scoring/src/recommend';
import { aceRowsJob, type AceRowsRunner, type RecommendJob } from './jobs';

interface Cache {
	/** The result the rows belong to; rows of another result are not current. */
	owner: Recommendation | null;
	rows: Map<number, AceSkillRow[]>;
	failed: Map<number, string>;
}

const emptyCache = (owner: Recommendation | null): Cache => ({ owner, rows: new Map(), failed: new Map() });

/**
 * The chart rows of the Ace hero `cardId`. The ranking builds them for the first hero only; any other is built on request by `run`
 * (from `job`, the job `result` came from) and kept until a new result arrives. `idle` is false while that result is being replaced.
 */
export function useAceRows(run: AceRowsRunner, result: Recommendation | null, job: RecommendJob | null, cardId: number | undefined, idle: boolean) {
	const [cache, setCache] = useState<Cache>(() => emptyCache(null));
	const inflight = useRef(new Map<number, () => void>());
	const current = cache.owner === result ? cache : emptyCache(result);
	const first = result?.aceSlots[0];

	// A new result makes the running requests (and the rows kept) obsolete.
	useEffect(() => () => { inflight.current.forEach((stop) => stop()); inflight.current.clear(); }, [result]);

	useEffect(() => {
		if (!result || !job || cardId == null || !idle || cardId === first?.cardId || inflight.current.has(cardId) || current.rows.has(cardId) || current.failed.has(cardId)) return;
		const rowsJob = aceRowsJob(job, cardId);
		if (!rowsJob) return;
		let settled = false;
		const settle = (change: (c: Cache) => void) => {
			settled = true;
			inflight.current.delete(cardId);
			setCache((prev) => {
				const base = prev.owner === result ? prev : emptyCache(result);
				const next = { ...base, rows: new Map(base.rows), failed: new Map(base.failed) };
				change(next);
				return next;
			});
		};
		const stop = run(rowsJob, () => {}, (rows) => settle((c) => c.rows.set(cardId, rows)), (e) => settle((c) => c.failed.set(cardId, e.message)));
		if (!settled) inflight.current.set(cardId, stop); // a runner may answer before it returns
	}, [result, job, cardId, idle, cache]);

	if (cardId == null || !result) return { rows: [] as AceSkillRow[], loading: false, error: undefined };
	if (cardId === first?.cardId) return { rows: first.skills, loading: false, error: undefined };
	const rows = current.rows.get(cardId);
	const error = current.failed.get(cardId);
	return { rows: rows ?? [], loading: !rows && !error, error };
}
