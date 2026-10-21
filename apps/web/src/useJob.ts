import { useEffect, useReducer, useRef } from 'preact/hooks';
import type { JobRunner } from './jobRunner';

interface Options {
	/** Drop the previous result when the input changes or the job is cancelled (it belongs to another input). */
	clearOnRestart?: boolean;
}

/** `cancelled` keeps the last result on screen, still stale: the input it answered has moved on. */
type Status = 'idle' | 'running' | 'done' | 'failed' | 'cancelled';
export interface JobState<Out, P> {
	status: Status;
	result: Out | null;
	progress: P | null;
	error: Error | null;
}
type Action<Out, P> =
	| { type: 'reset' }
	| { type: 'start'; clear: boolean }
	| { type: 'progress'; progress: P }
	| { type: 'done'; result: Out }
	| { type: 'fail'; error: Error }
	| { type: 'cancel'; clear: boolean };

export function idle<Out, P>(): JobState<Out, P> {
	return { status: 'idle', result: null, progress: null, error: null };
}

export function jobReducer<Out, P>(s: JobState<Out, P>, a: Action<Out, P>): JobState<Out, P> {
	switch (a.type) {
		case 'reset': return idle();
		case 'start': return { status: 'running', result: a.clear ? null : s.result, progress: null, error: null };
		case 'progress': return { ...s, progress: a.progress };
		case 'done': return { ...s, status: 'done', result: a.result };
		// a result of another input must not pass as current
		case 'fail': return { ...s, status: 'failed', result: null, error: a.error };
		case 'cancel':
			if (a.clear) return { ...s, status: 'idle', result: null };
			return s.status === 'running' ? { ...s, status: 'cancelled' } : s; // a settled result is still current
	}
}

export function viewOf<Out, P>(s: JobState<Out, P>) {
	return { result: s.result, progress: s.progress, busy: s.status === 'running', stale: s.status === 'running' || s.status === 'cancelled', error: s.error };
}

/** Runs `run` whenever `input` changes (null = nothing to run); the latest input wins and the older job is cancelled. */
export function useJob<In, Out, P = never>(run: JobRunner<In, Out, P>, input: In | null, { clearOnRestart = false }: Options = {}) {
	const [state, dispatch] = useReducer<JobState<Out, P>, Action<Out, P>>(jobReducer, idle());
	const cancelRef = useRef<() => void>(() => {});

	useEffect(() => {
		cancelRef.current = () => {};
		if (input == null) { dispatch({ type: 'reset' }); return; }
		let live = true;
		dispatch({ type: 'start', clear: clearOnRestart });
		const started = performance.now();
		const stop = run(
			input,
			(progress) => { if (live) dispatch({ type: 'progress', progress }); },
			(result) => { if (live) { console.info(`Job done in ${((performance.now() - started) / 1000).toFixed(1)} s`); dispatch({ type: 'done', result }); } }, // for timing a change without polling the page
			(error) => { if (live) dispatch({ type: 'fail', error }); },
		);
		cancelRef.current = () => { live = false; stop(); dispatch({ type: 'cancel', clear: clearOnRestart }); };
		return () => { live = false; stop(); };
	}, [run, input, clearOnRestart]);

	return { ...viewOf(state), cancel: () => cancelRef.current() };
}
