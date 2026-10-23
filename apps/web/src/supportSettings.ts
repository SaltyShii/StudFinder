import type { SupportCardData } from '../../../packages/lineage/src/types';
import type { SupportCard, SupportInput, SupportPick } from '../../../packages/scoring/src/support';

export const MAX_LIMIT_BREAK = 4;

/** A shortlisted Support card as stored: the catalogue id and the limit break level the player owns it at. Ids rather than cards, so a stored list survives a catalogue refresh. */
export interface ShortlistEntry {
	id: number;
	limitBreak: number;
}

/**
 * The Support settings the player edits. Extend this shape for the Type mix and trainings per card: each new field gets its own storage key in roster.ts
 * and a default in EMPTY_SUPPORT, so older saves load with the default.
 */
export interface SupportSettings {
	own: ShortlistEntry[];
	borrowed: ShortlistEntry[];
}

export const EMPTY_SUPPORT: SupportSettings = { own: [], borrowed: [] };

const clampLevel = (level: number) => Math.min(MAX_LIMIT_BREAK, Math.max(0, Math.round(level)));

export function isLimitBreak(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_LIMIT_BREAK;
}

/** Adds the card at max limit break; a card already on the list leaves it as it was. */
export function addCard(list: ShortlistEntry[], id: number): ShortlistEntry[] {
	return list.some((e) => e.id === id) ? list : [...list, { id, limitBreak: MAX_LIMIT_BREAK }];
}

export function removeCard(list: ShortlistEntry[], id: number): ShortlistEntry[] {
	return list.filter((e) => e.id !== id);
}

export function setLimitBreak(list: ShortlistEntry[], id: number, level: number): ShortlistEntry[] {
	return list.map((e) => (e.id === id ? { ...e, limitBreak: clampLevel(level) } : e));
}

/** The scorer keys skills by string id; the game data lists the hint pool as numbers. */
function cardOf({ id, name, type, pool, hintFrequency, hintLevelBonus }: SupportCardData): SupportCard {
	return { id, name, type, pool: pool.map(String), hintFrequency, hintLevelBonus };
}

/** The `recommend()` input: ids resolved against the catalogue (cards it no longer has are dropped). Undefined with nothing shortlisted, so the preset is the one the ranking had before Support cards. */
export function supportInputOf(settings: SupportSettings, catalogue: ReadonlyMap<number, SupportCardData>): SupportInput | undefined {
	const picks = (list: ShortlistEntry[]): SupportPick[] => list.flatMap((e) => { const card = catalogue.get(e.id); return card ? [{ card: cardOf(card), limitBreak: e.limitBreak }] : []; });
	const own = picks(settings.own);
	const borrowed = picks(settings.borrowed);
	return own.length || borrowed.length ? { own, borrowed } : undefined;
}
