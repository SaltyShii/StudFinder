import { expect, it } from 'vitest';
import { idle, jobReducer, viewOf, type JobState } from './useJob';

const run = (actions: Parameters<typeof jobReducer<number, number>>[1][], from: JobState<number, number> = idle()) => actions.reduce(jobReducer<number, number>, from);

it('start marks the job busy and stale, keeping the old result unless asked to clear', () => {
	const done = run([{ type: 'start', clear: false }, { type: 'done', result: 1 }]);
	expect(viewOf(run([{ type: 'start', clear: false }], done))).toMatchObject({ result: 1, busy: true, stale: true });
	expect(viewOf(run([{ type: 'start', clear: true }], done))).toMatchObject({ result: null, busy: true, stale: true });
});

it('progress, done and failure settle busy and stale; failure drops the result', () => {
	const s = run([{ type: 'start', clear: false }, { type: 'progress', progress: 3 }]);
	expect(viewOf(s)).toMatchObject({ progress: 3, busy: true });
	expect(viewOf(run([{ type: 'done', result: 7 }], s))).toMatchObject({ result: 7, busy: false, stale: false });
	const failed = viewOf(run([{ type: 'fail', error: new Error('x') }], run([{ type: 'done', result: 7 }], s)));
	expect(failed).toMatchObject({ result: null, busy: false, stale: false });
	expect(failed.error?.message).toBe('x');
});

it('cancel stops busy; the result stays stale unless the job clears on restart', () => {
	const done = run([{ type: 'start', clear: false }, { type: 'done', result: 1 }]);
	const running = run([{ type: 'start', clear: false }], done);
	expect(viewOf(run([{ type: 'cancel', clear: false }], running))).toMatchObject({ result: 1, busy: false, stale: true });
	expect(viewOf(run([{ type: 'cancel', clear: true }], running))).toMatchObject({ result: null, busy: false, stale: false });
});

it('reset (no input) returns to idle', () => {
	const done = run([{ type: 'start', clear: false }, { type: 'done', result: 1 }]);
	expect(viewOf(run([{ type: 'reset' }], done))).toMatchObject({ result: null, progress: null, error: null, busy: false, stale: false });
});
