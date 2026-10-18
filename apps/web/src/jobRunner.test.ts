import { afterEach, expect, it, vi } from 'vitest';
import { workerRunner } from './jobRunner';

class FakeWorker {
	static last: FakeWorker;
	onmessage: (e: { data: unknown }) => void = () => {};
	onerror: (e: { message: string }) => void = () => {};
	onmessageerror: () => void = () => {};
	terminated = false;
	postMessage = vi.fn();
	terminate() { this.terminated = true; }
	constructor() { FakeWorker.last = this; }
}
afterEach(() => vi.restoreAllMocks());

function start() {
	const calls = { progress: [] as unknown[], done: [] as unknown[], error: [] as string[] };
	workerRunner<number, string, number>(() => new FakeWorker() as unknown as Worker)(1, (p) => calls.progress.push(p), (r) => calls.done.push(r), (e) => calls.error.push(e.message));
	return { calls, w: FakeWorker.last };
}

it('forwards progress, then the result, and terminates', () => {
	const { calls, w } = start();
	w.onmessage({ data: { progress: 3 } });
	w.onmessage({ data: { result: 'ok' } });
	expect(calls).toEqual({ progress: [3], done: ['ok'], error: [] });
	expect(w.terminated).toBe(true);
});

it('reports worker errors, thrown messages and malformed messages', () => {
	for (const fire of [(w: FakeWorker) => w.onerror({ message: 'boom' }), (w: FakeWorker) => w.onmessage({ data: { error: 'boom' } }), (w: FakeWorker) => w.onmessage({ data: 'junk' }), (w: FakeWorker) => w.onmessageerror()]) {
		const { calls, w } = start();
		fire(w);
		expect(calls.error).toHaveLength(1);
		expect(calls.done).toEqual([]);
		expect(w.terminated).toBe(true);
	}
});
