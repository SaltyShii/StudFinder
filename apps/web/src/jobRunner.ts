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
		w.onmessageerror = () => fail(new Error('Worker result could not be read'));
		w.postMessage(input);
		return () => w.terminate();
	};
}

/**
 * Runs a job as one task per input piece on `size` workers pulling from a shared queue, so uneven pieces balance out.
 * `progress` gets (done, total) after each piece; `join` receives the results in task order. The first failure cancels the rest.
 */
export function poolRunner<In, Task, Part, Out>(make: () => Worker, size: number, split: (input: In) => Task[], join: (parts: Part[]) => Out): JobRunner<In, Out, [done: number, total: number]> {
	return (input, onProgress, done, onError) => {
		const tasks = split(input);
		const parts: Part[] = new Array(tasks.length);
		const workers: Worker[] = [];
		let next = 0;
		let finished = 0;
		let over = false;
		const stop = () => { over = true; workers.forEach((w) => w.terminate()); };
		const fail = (e: Error) => { if (over) return; stop(); onError(e); };
		const feed = (w: Worker, task: number) => w.postMessage(tasks[task]);
		if (!tasks.length) { done(join(parts)); return () => {}; }
		for (let k = 0; k < Math.min(size, tasks.length); k++) {
			const w = make();
			workers.push(w);
			let current = next++;
			w.onmessage = (e: MessageEvent<unknown>) => {
				const m = e.data;
				if (over) return;
				if (!isJobMessage(m)) return fail(new Error('Unexpected message from worker'));
				if ('error' in m) return fail(new Error(m.error));
				if (!('result' in m)) return; // tasks report no progress
				parts[current] = m.result as Part;
				onProgress([++finished, tasks.length]);
				if (finished === tasks.length) { stop(); done(join(parts)); }
				else if (next < tasks.length) feed(w, (current = next++));
			};
			w.onerror = (e) => fail(new Error(e.message || 'Worker failed'));
			w.onmessageerror = () => fail(new Error('Worker result could not be read'));
			feed(w, current);
		}
		return stop;
	};
}

/** Worker side of `workerRunner`: runs `fn` per posted input and replies with progress, result or error. */
export function serveJob<In, Out, P = never>(fn: (input: In, onProgress: (p: P) => void) => Out): void {
	// worker global has no DOM-free typing
	// eslint-disable-next-line no-restricted-syntax
	const w = self as unknown as { postMessage(m: JobMessage<Out, P>): void; onmessage: (e: MessageEvent<In>) => void };
	w.onmessage = (e) => {
		try { w.postMessage({ result: fn(e.data, (progress) => w.postMessage({ progress })) }); }
		catch (err) { w.postMessage({ error: err instanceof Error ? err.message : String(err) }); }
	};
}
