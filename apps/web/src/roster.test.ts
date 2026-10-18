import { describe, expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { RawGameData } from '../../../packages/lineage/src/types';
import { clearRoster, importRoster, loadRoster, saveRoster } from './roster';

const data = new GameData({
	meta: {}, charas: {}, cards: { 100101: { id: 100101, charaId: 1001, name: 'Synth', title: 'Test' } },
	skills: {}, factors: {}, relations: { points: {}, members: {}, ranks: [] },
	saddles: {}, tracks: {}, courses: {}, races: [],
} as unknown as RawGameData);

const file = JSON.stringify([{ trained_chara_id: 1, card_id: 100101, succession_chara_array: [] }]);
const KEY = 'stud-finder:roster';

function fakeStorage(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, v),
		removeItem: (k: string) => void m.delete(k),
	} as Storage;
}

describe('roster', () => {
	it('imports a valid export', () => {
		expect(importRoster(file, data).veterans).toHaveLength(1);
	});

	it.each([['not json', '{oops'], ['wrong shape', '{"a":1}']])('rejects %s', (_n, text) => {
		expect(() => importRoster(text, data)).toThrow();
	});

	it('round-trips, then clears', () => {
		const s = fakeStorage();
		saveRoster(s, importRoster(file, data));
		expect(loadRoster(s)?.veterans).toHaveLength(1);
		clearRoster(s);
		expect(loadRoster(s)).toBeNull();
	});

	it('rejects a stale schema version or corrupt data', () => {
		const s = fakeStorage();
		saveRoster(s, importRoster(file, data));
		const stored = JSON.parse(s.getItem(KEY)!);
		s.setItem(KEY, JSON.stringify({ ...stored, version: 0 }));
		expect(loadRoster(s)).toBeNull();
		s.setItem(KEY, JSON.stringify({ version: stored.version, roster: { veterans: [{}] } }));
		expect(loadRoster(s)).toBeNull();
		s.setItem(KEY, 'garbage');
		expect(loadRoster(s)).toBeNull();
	});
});
