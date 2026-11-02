import { afterEach, expect, it, vi } from 'vitest';
import { fetchCmUsage, parseSummaryPairs, sameCourse, suggestViable, type CmUsagePair } from './cmData';

const pair = (cardId: number, style: number, winRate: number, usage: number): CmUsagePair => ({ cardId, style, winRate, usage });
const manifest = { snapshots: [{ cmId: 'cm22', snapshotId: 'cm22-a b', label: 'CM22 - 10 million races', meta: { course: 'CM22 - Tokyo 1,600 m - Dirt' } }] };
const summary = { pairs: [{ card: 100601, style: 2, team: 0.4, pop: 0.05, name: 'ignored' }] };
const tokyoDirt = { distance: 1600, ground: 2 };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(answer: (url: string) => { ok?: boolean; status?: number; body?: unknown }) {
	const calls: { url: string; init?: RequestInit }[] = [];
	vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		const a = answer(url);
		return { ok: a.ok ?? true, status: a.status ?? 200, json: async () => a.body };
	});
	return calls;
}

it('matches a snapshot to a course by distance and surface', () => {
	expect(sameCourse('CM22 - Tokyo 1,600 m - Dirt', tokyoDirt)).toBe(true);
	expect(sameCourse('CM22 - Tokyo 1,600 m - Turf', tokyoDirt)).toBe(false);
	expect(sameCourse('CM22 - Tokyo 2,400 m - Dirt', tokyoDirt)).toBe(false);
	expect(sameCourse('no course here', tokyoDirt)).toBe(false);
});

it('reads a CM without credentials, finding its snapshot in the manifest', async () => {
	const calls = stubFetch((url) => ({ body: url.endsWith('/manifest') ? manifest : summary }));
	expect(await fetchCmUsage({ id: 22 }, tokyoDirt)).toEqual({ label: 'CM22 - 10 million races', pairs: [pair(100601, 2, 0.4, 0.05)] });
	expect(calls.map((c) => c.url)).toEqual(['https://hakuraku.moe/api/simdata/manifest', 'https://hakuraku.moe/api/simdata/snapshots/cm22-a%20b/summary']);
	expect(calls.every((c) => c.init?.credentials === 'omit')).toBe(true);
});

it('has nothing for a CM the data lacks, or one on another course', async () => {
	stubFetch(() => ({ body: manifest }));
	expect(await fetchCmUsage({ id: 23 }, tokyoDirt)).toBeNull();
	expect(await fetchCmUsage({ id: 22 }, { distance: 1200, ground: 1 })).toBeNull();
});

it('fails on a bad answer rather than suggesting from it', async () => {
	stubFetch(() => ({ ok: false, status: 503 }));
	await expect(fetchCmUsage({ id: 22 }, tokyoDirt)).rejects.toThrow('503');
	stubFetch(() => ({ body: { nothing: true } }));
	await expect(fetchCmUsage({ id: 22 }, tokyoDirt)).rejects.toThrow('shape');
	expect(() => parseSummaryPairs({ pairs: [{ card: 'x', style: 2, team: 0.4, pop: 0.1 }] })).toThrow('shape');
	expect(() => parseSummaryPairs({})).toThrow('shape');
});

it('suggests the Owned versions that beat the field, each in its best running style, best first', () => {
	const usage = {
		label: '',
		pairs: [
			pair(1, 2, 0.45, 0.1), // owned, strong
			pair(1, 3, 0.5, 0.0001), // too few runners to trust its better win rate
			pair(2, 1, 0.25, 0.3), // owned, below the field
			pair(3, 2, 0.6, 0.0001), // owned, wins but barely run
			pair(4, 2, 0.36, 0.2), // owned, just above
			pair(9, 2, 0.34, 0.3), // not owned
		],
	};
	const out = suggestViable(usage, [1, 2, 3, 4, 5]);
	expect(out.map((s) => [s.cardId, s.style, s.suggested])).toEqual([[1, 2, true], [4, 2, true], [3, 2, false], [2, 1, false]]);
	expect(out[0].styleName).toBe('Pace Chaser');
});
