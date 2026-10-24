import type { SupportCardData } from '../../../packages/lineage/src/types';
import { DECK_SLOTS, DEFAULT_TRAININGS_PER_CARD, defaultTypeMix, SUPPORT_TYPES, type SupportCard, type SupportInput, type SupportPick, type SupportType, type TypeMix } from '../../../packages/scoring/src/support';

export const MAX_LIMIT_BREAK = 4;

/** A shortlisted Support card as stored: the catalogue id and the limit break level the player owns it at. Ids rather than cards, so a stored list survives a catalogue refresh. */
export interface ShortlistEntry {
	id: number;
	limitBreak: number;
}

export { DECK_SLOTS, SUPPORT_TYPES };

/**
 * The Support settings the player edits. Each field has its own storage key in roster.ts and a default in EMPTY_SUPPORT, so older saves load with the default.
 */
export interface SupportSettings {
	own: ShortlistEntry[];
	borrowed: ShortlistEntry[];
	/** Trainings each deck card appears in over a run, a Sim assumption. */
	trainingsPerCard: number;
	/** The Type mix the player set, by Champions Meeting id; a CM without an entry uses the distance default. */
	typeMixes: Record<string, TypeMix>;
}

export const EMPTY_SUPPORT: SupportSettings = { own: [], borrowed: [], trainingsPerCard: DEFAULT_TRAININGS_PER_CARD, typeMixes: {} };

/** A mix is valid when every count is a whole number of 0 to 6 over known types and the total fits the 6 slots. */
export function isTypeMix(v: unknown): v is TypeMix {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
	const entries = Object.entries(v);
	return entries.every(([t, n]) => (SUPPORT_TYPES as readonly string[]).includes(t) && Number.isInteger(n) && n >= 0 && n <= DECK_SLOTS) && entries.reduce((a, [, n]) => a + (n as number), 0) <= DECK_SLOTS;
}

export function typeMixTotal(mix: TypeMix): number {
	return Object.values(mix).reduce((a, n) => a + (n ?? 0), 0);
}

/** The mix the Champions Meeting ranks with: the player's, else the default for its course distance. */
export function typeMixOf(settings: SupportSettings, cmId: number, distance: number): TypeMix {
	return settings.typeMixes[String(cmId)] ?? defaultTypeMix(distance);
}

/** One type's count set (whole number, 0 to 6, at most the room the other types leave in the 6 slots, so a stored mix always passes `isTypeMix`); zeros are dropped so an empty mix means no constraint. */
export function setTypeCount(mix: TypeMix, type: SupportType, count: number): TypeMix {
	const rest = Object.fromEntries(Object.entries(mix).filter(([t]) => t !== type));
	const n = Math.min(DECK_SLOTS - typeMixTotal(rest), Math.max(0, Math.round(count)));
	return n > 0 ? { ...rest, [type]: n } : rest;
}

function clampLevel(level: number): number {
	return Math.min(MAX_LIMIT_BREAK, Math.max(0, Math.round(level)));
}

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
function cardOf({ id, charaId, name, type, pool, hintFrequency, hintLevelBonus }: SupportCardData): SupportCard {
	return { id, charaId, name, type, pool: pool.map(String), hintFrequency, hintLevelBonus };
}

/** The `recommend()` input (with the Type mix of the current Champions Meeting): ids resolved against the catalogue (cards it no longer has are dropped). Undefined with nothing shortlisted, so the preset is the one the ranking had before Support cards. */
export function supportInputOf(settings: SupportSettings, catalogue: ReadonlyMap<number, SupportCardData>, typeMix: TypeMix): SupportInput | undefined {
	const picks = (list: ShortlistEntry[]): SupportPick[] => list.flatMap((e) => { const card = catalogue.get(e.id); return card ? [{ card: cardOf(card), limitBreak: e.limitBreak }] : []; });
	const own = picks(settings.own);
	const borrowed = picks(settings.borrowed);
	return own.length || borrowed.length ? { own, borrowed, trainingsPerCard: settings.trainingsPerCard, ...(typeMixTotal(typeMix) > 0 ? { typeMix } : {}) } : undefined;
}
