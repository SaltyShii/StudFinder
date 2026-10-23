import { describe, expect, it } from 'vitest';
import type { SupportCardData } from '../../../packages/lineage/src/types';
import type { SupportCard } from '../../../packages/scoring/src/support';
import { addCard, removeCard, setLimitBreak, supportInputOf, MAX_LIMIT_BREAK } from './supportSettings';

const raw = (id: number): SupportCardData => ({ id, charaId: 1, name: `Card ${id}`, title: '[T]', rarity: 3, type: 'speed', pool: [200162], hintFrequency: [0, 0, 0, 0, 0], hintLevelBonus: [0, 0, 0, 0, 0] });
// The scorer keys skills by string id.
const card = (id: number): SupportCard => ({ id, name: `Card ${id}`, type: 'speed', pool: ['200162'], hintFrequency: [0, 0, 0, 0, 0], hintLevelBonus: [0, 0, 0, 0, 0] });
const catalogue = new Map([1, 2, 3].map((id) => [id, raw(id)]));

describe('supportSettings', () => {
	it('adds a card at max limit break, once, and removes it', () => {
		const added = addCard([], 1);
		expect(added).toEqual([{ id: 1, limitBreak: MAX_LIMIT_BREAK }]);
		expect(addCard(added, 1)).toBe(added);
		expect(removeCard(added, 1)).toEqual([]);
	});

	it('sets a limit break level on one card only, clamped to 0..4', () => {
		const list = [{ id: 1, limitBreak: 4 }, { id: 2, limitBreak: 4 }];
		expect(setLimitBreak(list, 2, 1)).toEqual([{ id: 1, limitBreak: 4 }, { id: 2, limitBreak: 1 }]);
		expect(setLimitBreak(list, 2, 9)[1].limitBreak).toBe(4);
		expect(setLimitBreak(list, 2, -3)[1].limitBreak).toBe(0);
	});

	it('gives no Support input for empty shortlists, so the ranking stays as it was', () => {
		expect(supportInputOf({ own: [], borrowed: [] }, catalogue)).toBeUndefined();
	});

	it('resolves ids against the catalogue and drops cards it no longer has', () => {
		const input = supportInputOf({ own: [{ id: 1, limitBreak: 2 }, { id: 99, limitBreak: 4 }], borrowed: [{ id: 3, limitBreak: 0 }] }, catalogue)!;
		expect(input.own).toEqual([{ card: card(1), limitBreak: 2 }]);
		expect(input.borrowed).toEqual([{ card: card(3), limitBreak: 0 }]);
		expect(supportInputOf({ own: [{ id: 99, limitBreak: 4 }], borrowed: [] }, catalogue)).toBeUndefined();
	});
});
