import { describe, expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { RawGameData } from '../../../packages/lineage/src/types';
import { DEFAULT_ASSUMPTIONS } from '../../../packages/scoring/src/assumptions';
import { clearRoster, importRoster, loadAssumptions, saveAssumptions, loadSkillPointBudget, saveSkillPointBudget, loadSupportSettings, saveSupportSettings, loadRoster, loadMustHaves, loadTierEdits, saveMustHaves, saveRoster, saveTierEdits } from './roster';

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

it('persists Tier edits and drops stale-versioned or malformed ones', () => {
	const s = fakeStorage();
	const edits = { sashi: { moved: { 'Late Surger Straightaways': 'T5' as const }, disabled: ['Uma Stan'] } };
	saveTierEdits(s, edits);
	expect(loadTierEdits(s)).toEqual(edits);
	s.setItem('stud-finder:tier-edits', JSON.stringify({ version: 99, edits }));
	expect(loadTierEdits(s)).toEqual({});
	s.setItem('stud-finder:tier-edits', JSON.stringify({ version: 1, edits: { sashi: { moved: 3 } } }));
	expect(loadTierEdits(s)).toEqual({});
	s.setItem('stud-finder:tier-edits', JSON.stringify({ version: 1, edits: { bogus: edits.sashi } }));
	expect(loadTierEdits(s)).toEqual({});
	s.setItem('stud-finder:tier-edits', JSON.stringify({ version: 1, edits: [edits.sashi] }));
	expect(loadTierEdits(s)).toEqual({});
});

it('persists Sim assumptions and falls back to the defaults for stale-versioned or malformed ones', () => {
	const s = fakeStorage();
	expect(loadAssumptions(s)).toEqual(DEFAULT_ASSUMPTIONS);
	const changed = { ...DEFAULT_ASSUMPTIONS, witCheck: true, dueling: true, duelingRates: { ...DEFAULT_ASSUMPTIONS.duelingRates, frontRunner: 40 } };
	saveAssumptions(s, changed);
	expect(loadAssumptions(s)).toEqual(changed);
	s.setItem('stud-finder:sim-assumptions', JSON.stringify({ version: 99, assumptions: changed }));
	expect(loadAssumptions(s)).toEqual(DEFAULT_ASSUMPTIONS);
	s.setItem('stud-finder:sim-assumptions', JSON.stringify({ version: 1, assumptions: { ...changed, rushed: 'yes' } }));
	expect(loadAssumptions(s)).toEqual(DEFAULT_ASSUMPTIONS);
	s.setItem('stud-finder:sim-assumptions', JSON.stringify({ version: 1, assumptions: { ...changed, duelingRates: { ...changed.duelingRates, endCloser: 150 } } }));
	expect(loadAssumptions(s)).toEqual(DEFAULT_ASSUMPTIONS);
});

it('clearing data also drops Must-haves and Tier edits', () => {
	const s = fakeStorage();
	saveMustHaves(s, ['10071']);
	saveTierEdits(s, { sashi: { moved: {}, disabled: ['x'] } });
	clearRoster(s);
	expect(loadMustHaves(s)).toEqual([]);
	expect(loadTierEdits(s)).toEqual({});
});

it('persists the Skill point budget: 2700 by default, a cleared field is unlimited, stale or malformed saves get 2700', () => {
	const s = fakeStorage();
	expect(loadSkillPointBudget(s)).toBe(2700);
	saveSkillPointBudget(s, 1500);
	expect(loadSkillPointBudget(s)).toBe(1500);
	saveSkillPointBudget(s, null);
	expect(loadSkillPointBudget(s)).toBeNull();
	for (const body of [{ version: 99, budget: 1500 }, { version: 1, budget: -5 }, { version: 1, budget: 'lots' }, { version: 1 }]) {
		s.setItem('stud-finder:skill-point-budget', JSON.stringify(body));
		expect(loadSkillPointBudget(s)).toBe(2700);
	}
	s.setItem('stud-finder:skill-point-budget', 'garbage');
	expect(loadSkillPointBudget(s)).toBe(2700);
});

it('persists the Support shortlists under their own keys; absent, stale or malformed saves load as empty; Clear data keeps them', () => {
	const s = fakeStorage();
	expect(loadSupportSettings(s)).toEqual({ own: [], borrowed: [] });
	const settings = { own: [{ id: 10001, limitBreak: 2 }], borrowed: [{ id: 30001, limitBreak: 4 }] };
	saveSupportSettings(s, settings);
	expect(loadSupportSettings(s)).toEqual(settings);
	clearRoster(s);
	expect(loadSupportSettings(s)).toEqual(settings);
	for (const body of [{ version: 99, list: settings.own }, { version: 1, list: [{ id: 'x', limitBreak: 4 }] }, { version: 1, list: [{ id: 1, limitBreak: 7 }] }, { version: 1, list: 'no' }, { version: 1 }]) {
		s.setItem('stud-finder:support-own', JSON.stringify(body));
		expect(loadSupportSettings(s).own).toEqual([]);
	}
	s.setItem('stud-finder:support-borrowed', 'garbage');
	expect(loadSupportSettings(s).borrowed).toEqual([]);
});
