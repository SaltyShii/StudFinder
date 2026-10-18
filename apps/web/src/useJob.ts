import { useEffect, useRef, useState } from 'preact/hooks';
import type { JobRunner } from './jobRunner';

interface Options {
	/** Drop the previous result when the input changes or the job is cancelled (it belongs to another input). */
	clearOnRestart?: boolean;
	onError?: (e: Error) => void;
}

/** Runs `run` whenever `input` changes (null = nothing to run); the latest input wins and the older job is cancelled. */
export function useJob<In, Out, P = never>(run: JobRunner<In, Out, P>, input: In | null, { clearOnRestart = false, onError }: Options = {}) {
	const [result, setResult] = useState<Out | null>(null);
	const [progress, setProgress] = useState<P | null>(null);
	const [busy, setBusy] = useState(false);
	const [stale, setStale] = useState(false);
	const cancelRef = useRef<() => void>(() => {});
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	useEffect(() => {
		setProgress(null);
		if (input == null) { setResult(null); setBusy(false); setStale(false); return; }
		let live = true;
		setBusy(true);
		setStale(true);
		if (clearOnRestart) setResult(null);
		const stop = run(
			input,
			(p) => { if (live) setProgress(p); },
			(r) => { if (live) { setResult(r); setBusy(false); setStale(false); } },
			(e) => { if (live) { setBusy(false); setStale(false); onErrorRef.current?.(e); } },
		);
		cancelRef.current = () => { live = false; stop(); setBusy(false); if (clearOnRestart) { setStale(false); setResult(null); } };
		return () => { live = false; stop(); };
	}, [run, input, clearOnRestart]);

	return { result, progress, busy, stale, cancel: () => cancelRef.current() };
}
