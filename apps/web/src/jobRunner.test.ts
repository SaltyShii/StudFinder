import { afterEach, expect, it, vi } from 'vitest';
import { poolRunner, workerRunner } from './jobRunner';

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

class PoolWorker extends FakeWorker {
	static all: PoolWorker[] = [];
	constructor() { super(); PoolWorker.all.push(this); }
	reply(result: unknown) { this.onmessage({ data: { result } }); }
}
function pool(size: number, tasks: number[]) {
	PoolWorker.all = [];
	const calls = { progress: [] as unknown[], done: [] as unknown[], error: [] as string[] };
	const stop = poolRunner<number[], number, number, number[]>(() => new PoolWorker() as unknown as Worker, size, (t) => t, (parts) => parts)(tasks, (p) => calls.progress.push(p), (r) => calls.done.push(r), (e) => calls.error.push(e.message));
	return { calls, stop, ws: PoolWorker.all };
}

it('pool: feeds idle workers the next task, joins results in task order, then terminates', () => {
	const { calls, ws } = pool(2, [10, 20, 30]);
	expect(ws.map((w) => w.postMessage.mock.calls)).toEqual([[[10]], [[20]]]);
	ws[1].reply('b');
	expect(ws[1].postMessage).toHaveBeenLastCalledWith(30);
	ws[0].reply('a');
	ws[1].reply('c');
	expect(calls).toEqual({ progress: [[1, 3], [2, 3], [3, 3]], done: [['a', 'b', 'c']], error: [] });
	expect(ws.every((w) => w.terminated)).toBe(true);
});

it('pool: starts no more workers than tasks and finishes at once without tasks', () => {
	expect(pool(4, [1]).ws).toHaveLength(1);
	const { calls, ws } = pool(4, []);
	expect(ws).toHaveLength(0);
	expect(calls.done).toEqual([[]]);
});

it('pool: the first failure terminates every worker and reports once; cancel terminates without reporting', () => {
	const failed = pool(2, [1, 2, 3]);
	failed.ws[0].onmessage({ data: { error: 'boom' } });
	failed.ws[1].reply('late');
	expect(failed.calls).toEqual({ progress: [], done: [], error: ['boom'] });
	expect(failed.ws.every((w) => w.terminated)).toBe(true);
	const cancelled = pool(2, [1, 2]);
	cancelled.stop();
	cancelled.ws[0].reply('x');
	expect(cancelled.calls).toEqual({ progress: [], done: [], error: [] });
	expect(cancelled.ws.every((w) => w.terminated)).toBe(true);
});

// Firefox stalls a pool that a worker starts itself (nested workers), so the page starts it and the worker calls it through its parent.
function withCalls() {
	const served: { payload: unknown; progress: (n: number) => void; done: (r: unknown) => void; fail: (e: Error) => void; stop: ReturnType<typeof vi.fn> }[] = [];
	const calls = { done: [] as unknown[], error: [] as string[] };
	workerRunner<number, string>(() => new FakeWorker() as unknown as Worker, (payload, progress, done, fail) => {
		const stop = vi.fn();
		served.push({ payload, progress, done, fail, stop });
		return stop;
	})(1, () => {}, (r) => calls.done.push(r), (e) => calls.error.push(e.message));
	return { calls, served, w: FakeWorker.last };
}

it('call: runs what the worker asks for and replies with its progress, result and error', () => {
	const { served, w } = withCalls();
	w.onmessage({ data: { call: { id: 7, payload: 'batch' } } });
	w.onmessage({ data: { call: { id: 8, payload: 'other' } } });
	expect(served.map((s) => s.payload)).toEqual(['batch', 'other']);
	served[0].progress(5);
	served[0].done(['d']);
	served[1].fail(new Error('boom'));
	expect(w.postMessage.mock.calls.slice(1)).toEqual([[{ reply: { id: 7, progress: 5 } }], [{ reply: { id: 7, result: ['d'] } }], [{ reply: { id: 8, error: 'boom' } }]]);
	expect(w.terminated).toBe(false);
});

it('call: stops the calls still running when the job is cancelled, ends or fails', () => {
	const cancelled = withCalls();
	cancelled.w.onmessage({ data: { call: { id: 1, payload: 'x' } } });
	cancelled.w.onerror({ message: 'boom' });
	expect(cancelled.served[0].stop).toHaveBeenCalled();
	const finished = withCalls();
	finished.w.onmessage({ data: { call: { id: 1, payload: 'x' } } });
	finished.w.onmessage({ data: { result: 'ok' } });
	expect(finished.served[0].stop).toHaveBeenCalled();
});

it('call: a worker that asks without a call runner is an error', () => {
	const { calls, w } = start();
	w.onmessage({ data: { call: { id: 1, payload: 'x' } } });
	expect(calls.error).toHaveLength(1);
});
