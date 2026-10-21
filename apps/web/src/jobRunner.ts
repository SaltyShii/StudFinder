// No scoring imports: the worker entry files import this, and Vite rejects circular worker imports.
export type JobMessage<Out, P> = { progress: P } | { result: Out } | { error: string } | { call: { id: number; payload: unknown } };
/** The page's answer to a `call` of the worker. */
export type CallReply = { reply: { id: number; progress?: number; result?: unknown; error?: string } };

/** Starts a job; the returned function cancels it. Exactly one of `done` and `onError` fires, unless cancelled. */
export type JobRunner<In, Out, P = never> = (input: In, onProgress: (p: P) => void, done: (r: Out) => void, onError: (e: Error) => void) => () => void;

function isJobMessage(m: unknown): m is JobMessage<unknown, unknown> {
	if (typeof m !== 'object' || m === null) return false;
	if ('error' in m) return typeof m.error === 'string';
	return 'progress' in m || 'call' in m || ('result' in m && m.result != null);
}

/**
 * `make` holds the literal `new Worker(new URL(...))` so Vite can bundle the worker.
 * `serveCall` runs what the worker asks of the page through `serveJob`'s `call`: a worker must not start workers itself, because Firefox stalls such a nested pool after a few seconds.
 */
export function workerRunner<In, Out, P = never>(make: () => Worker, serveCall?: JobRunner<unknown, unknown, number>): JobRunner<In, Out, P> {
	return (input, onProgress, done, onError) => {
		const w = make();
		const calls = new Map<number, () => void>();
		const end = () => { w.terminate(); calls.forEach((stop) => stop()); calls.clear(); };
		const fail = (e: Error) => { end(); onError(e); };
		const reply = (id: number, r: Omit<CallReply['reply'], 'id'>, last = true) => {
			if (!calls.has(id)) return; // cancelled, or already answered
			if (last) calls.delete(id);
			w.postMessage({ reply: { ...r, id } });
		};
		w.onmessage = (e: MessageEvent<unknown>) => {
			const m = e.data;
			if (!isJobMessage(m)) fail(new Error('Unexpected message from worker'));
			else if ('progress' in m) onProgress(m.progress as P);
			else if ('result' in m) { end(); done(m.result as Out); }
			else if ('call' in m) {
				const { id, payload } = m.call;
				if (!serveCall) return fail(new Error('Worker asked for a call nobody serves'));
				calls.set(id, serveCall(payload, (progress) => reply(id, { progress }, false), (result) => reply(id, { result }), (err) => reply(id, { error: err.message })));
			}
			else fail(new Error(m.error));
		};
		w.onerror = (e) => fail(new Error(e.message || 'Worker failed'));
		w.onmessageerror = () => fail(new Error('Worker result could not be read'));
		w.postMessage(input);
		return end;
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

/** Workers a pool runs at once; leaves cores for the page and bounds the sim data each worker loads. */
export const POOL_WORKERS = 4;

/** Asks the page to run `payload` (see `workerRunner`'s `serveCall`); `onProgress` hears its progress. */
export type Call = (payload: unknown, onProgress: (n: number) => void) => Promise<unknown>;

/** Worker side of `workerRunner`: runs `fn` per posted input and replies with progress, result or error. `fn` may answer later with a promise, and may `call` the page meanwhile. */
export function serveJob<In, Out, P = never>(fn: (input: In, onProgress: (p: P) => void, call: Call) => Out | Promise<Out>): void {
	// worker global has no DOM-free typing
	// eslint-disable-next-line no-restricted-syntax
	const w = self as unknown as { postMessage(m: JobMessage<Out, P>): void; onmessage: (e: MessageEvent<In | CallReply>) => void };
	const fail = (err: unknown) => w.postMessage({ error: err instanceof Error ? err.message : String(err) });
	const asked = new Map<number, { progress: (n: number) => void; done: (r: unknown) => void; fail: (e: Error) => void }>();
	let nextCall = 0;
	const call: Call = (payload, progress) => new Promise((done, failCall) => {
		const id = nextCall++;
		asked.set(id, { progress, done, fail: failCall });
		w.postMessage({ call: { id, payload } });
	});
	const isReply = (m: unknown): m is CallReply => typeof m === 'object' && m !== null && 'reply' in m;
	w.onmessage = (e) => {
		const m = e.data;
		if (isReply(m)) {
			const { id, progress, result, error } = m.reply;
			const c = asked.get(id);
			if (!c) return;
			if (error !== undefined) { asked.delete(id); c.fail(new Error(error)); }
			else if (progress !== undefined) c.progress(progress);
			else { asked.delete(id); c.done(result); }
			return;
		}
		try { Promise.resolve(fn(m as In, (progress) => w.postMessage({ progress }), call)).then((result) => w.postMessage({ result }), fail); }
		catch (err) { fail(err); }
	};
}
