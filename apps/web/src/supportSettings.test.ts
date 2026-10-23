import { describe, expect, it } from 'vitest';
import type { SupportCardData } from '../../../packages/lineage/src/types';
import type { SupportCard } from '../../../packages/scoring/src/support';
import { addCard, isTypeMix, removeCard, setLimitBreak, setTypeCount, supportInputOf, typeMixOf, typeMixTotal, EMPTY_SUPPORT, MAX_LIMIT_BREAK } from './supportSettings';

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
		expect(supportInputOf(EMPTY_SUPPORT, catalogue, {})).toBeUndefined();
	});

	it('resolves ids against the catalogue and drops cards it no longer has', () => {
		const input = supportInputOf({ ...EMPTY_SUPPORT, own: [{ id: 1, limitBreak: 2 }, { id: 99, limitBreak: 4 }], borrowed: [{ id: 3, limitBreak: 0 }] }, catalogue, {})!;
		expect(input.own).toEqual([{ card: card(1), limitBreak: 2 }]);
		expect(input.borrowed).toEqual([{ card: card(3), limitBreak: 0 }]);
		expect(supportInputOf({ ...EMPTY_SUPPORT, own: [{ id: 99, limitBreak: 4 }] }, catalogue, {})).toBeUndefined();
	});

	it('passes the Type mix and trainings per card on; an empty mix is no constraint', () => {
		const settings = { ...EMPTY_SUPPORT, own: [{ id: 1, limitBreak: 4 }], trainingsPerCard: 45 };
		expect(supportInputOf(settings, catalogue, { speed: 3, wit: 3 })).toMatchObject({ typeMix: { speed: 3, wit: 3 }, trainingsPerCard: 45 });
		expect(supportInputOf(settings, catalogue, {})!.typeMix).toBeUndefined();
	});

	it('uses the CM mix when the player set one, else the distance default (sprint only)', () => {
		const settings = { ...EMPTY_SUPPORT, typeMixes: { '7': { power: 6 } } };
		expect(typeMixOf(settings, 7, 1200)).toEqual({ power: 6 });
		expect(typeMixOf(settings, 8, 1200)).toEqual({ speed: 3, wit: 2, friend: 1 });
		expect(typeMixOf(settings, 8, 2000)).toEqual({});
	});

	it('sets one type count, clamped to 0..6 whole numbers, dropping zeros; totals the mix', () => {
		expect(setTypeCount({ speed: 3 }, 'wit', 2)).toEqual({ speed: 3, wit: 2 });
		expect(setTypeCount({ speed: 3 }, 'speed', 0)).toEqual({});
		expect(setTypeCount({}, 'guts', 9)).toEqual({ guts: 6 });
		expect(setTypeCount({}, 'guts', -1)).toEqual({});
		expect(setTypeCount({}, 'guts', 2.6)).toEqual({ guts: 3 });
		expect(typeMixTotal({ speed: 3, wit: 2, friend: 1 })).toBe(6);
	});

	it('never lets the mix pass the 6 deck slots: a count takes only the room the other types leave', () => {
		expect(setTypeCount({ speed: 4, wit: 1 }, 'guts', 5)).toEqual({ speed: 4, wit: 1, guts: 1 });
		expect(setTypeCount({ speed: 6 }, 'wit', 2)).toEqual({ speed: 6 });
		expect(setTypeCount({ speed: 4, wit: 2 }, 'speed', 6)).toEqual({ speed: 4, wit: 2 });
		expect(isTypeMix(setTypeCount({ speed: 3, wit: 2 }, 'friend', 6))).toBe(true);
	});
});
