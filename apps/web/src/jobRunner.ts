// No scoring imports: the worker entry files import this, and Vite rejects circular worker imports.
export type JobMessage<Out, P> = { progress: P } | { result: Out } | { error: string };

/** Starts a job; the returned function cancels it. Exactly one of `done` and `onError` fires, unless cancelled. */
export type JobRunner<In, Out, P = never> = (input: In, onProgress: (p: P) => void, done: (r: Out) => void, onError: (e: Error) => void) => () => void;

function isJobMessage(m: unknown): m is JobMessage<unknown, unknown> {
	if (typeof m !== 'object' || m === null) return false;
	if ('error' in m) return typeof m.error === 'string';
	return 'progress' in m || ('result' in m && m.result != null);
}

/** `make` holds the literal `new Worker(new URL(...))` so Vite can bundle the worker. */
export function workerRunner<In, Out, P = never>(make: () => Worker): JobRunner<In, Out, P> {
	return (input, onProgress, done, onError) => {
		const w = make();
		const fail = (e: Error) => { w.terminate(); onError(e); };
		w.onmessage = (e: MessageEvent<unknown>) => {
			const m = e.data;
			if (!isJobMessage(m)) fail(new Error('Unexpected message from worker'));
			else if ('progress' in m) onProgress(m.progress as P);
			else if ('result' in m) { w.terminate(); done(m.result as Out); }
			else fail(new Error(m.error));
		};
		w.onerror = (e) => fail(new Error(e.message || 'Worker failed'));
		w.postMessage(input);
		return () => w.terminate();
	};
}

/** Worker side of `workerRunner`: runs `fn` per posted input and replies with progress, result or error. */
export function serveJob<In, Out, P = never>(fn: (input: In, onProgress: (p: P) => void) => Out): void {
	const w = self as unknown as { postMessage(m: JobMessage<Out, P>): void; onmessage: (e: MessageEvent<In>) => void };
	w.onmessage = (e) => {
		try { w.postMessage({ result: fn(e.data, (progress) => w.postMessage({ progress })) }); }
		catch (err) { w.postMessage({ error: err instanceof Error ? err.message : String(err) }); }
	};
}
