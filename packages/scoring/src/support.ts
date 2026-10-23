import { discounted, MAX_HINT_LEVEL } from './skillBudget';

export type SupportType = 'speed' | 'stamina' | 'power' | 'guts' | 'wit' | 'friend';

/** A Support card as the catalogue lists it (`supportCards` in the game data). The two arrays hold one value per limit break level, 0 to 4. */
export interface SupportCard {
	id: number;
	name: string;
	type: SupportType;
	/** Skill ids the card hints, 1 Hint level each. */
	pool: string[];
	hintFrequency: number[];
	hintLevelBonus: number[];
}

/** A shortlisted card at the limit break level (0 to 4) the player owns it at. */
export interface SupportPick {
	card: SupportCard;
	limitBreak: number;
}

/** The Support input of `recommend()`: what the player would consider running. Both lists empty (or the input absent) changes nothing. */
export interface SupportInput {
	own: SupportPick[];
	borrowed: SupportPick[];
	/** Trainings each deck card appears in over a run (a Sim assumption); DEFAULT_TRAININGS_PER_CARD when absent. */
	trainingsPerCard?: number;
}

/** The Support deck an Ace hero was ranked with: up to 5 own cards and at most 1 Borrowed support card (exactly 1 when a borrowed card is shortlisted). */
export interface SupportDeck {
	own: SupportPick[];
	borrowed?: SupportPick;
	/** Why the deck is not the full 5 + 1. */
	notes: string[];
}

/** Hint chance per training with no Hint Frequency; not in master.mdb, so an assumption (about 7%). */
export const BASE_HINT_CHANCE = 0.07;
export const DEFAULT_TRAININGS_PER_CARD = 30;
export const OWN_SLOTS = 5;

/** A Support card's hint chance per training: the base chance raised by its Hint Frequency (a percentage). */
export function hintChance(frequency: number): number {
	return Math.min(1, BASE_HINT_CHANCE * (1 + frequency / 100));
}

/** The value at a limit break level; the arrays hold 5, a malformed one counts as 0. */
export function atLimitBreak(values: number[], limitBreak: number): number {
	return values[Math.min(Math.max(limitBreak, 0), values.length - 1)] ?? 0;
}

/** The Hint level one hint of a card adds. */
export function hintLevelOf(pick: SupportPick): number {
	return Math.min(MAX_HINT_LEVEL, 1 + atLimitBreak(pick.card.hintLevelBonus, pick.limitBreak));
}

/** What the deck picker needs to know about the Ace: which skills it can use and buy, and what each is worth (lengths gained). */
export interface DeckContext {
	/** The skills of the Ace's card list (cheaper when hinted); a hinted skill off it becomes buyable, which is worth more. */
	onList: ReadonlySet<string>;
	usable(ids: string[]): string[];
	value(id: string): number;
}

/** A cheap additive score of one card: per usable pool skill, its value times the chance it gets hinted, times the discount (on the card list) or the whole of it (off, as the hint makes it buyable). Overlap between cards is ignored on purpose. */
function cardScore(pick: SupportPick, trainings: number, { onList, usable, value }: DeckContext): number {
	const { pool, hintFrequency } = pick.card;
	if (!pool.length) return 0;
	const hintsPerSkill = (trainings * hintChance(atLimitBreak(hintFrequency, pick.limitBreak))) / pool.length;
	const chance = Math.min(1, hintsPerSkill);
	const level = hintLevelOf(pick);
	let total = 0;
	for (const id of usable(pool)) {
		const v = value(id);
		if (v <= 0) continue;
		total += v * chance * (onList.has(id) ? (100 - discounted(100, level)) / 100 : 1);
	}
	return total;
}

/**
 * The deck for one Ace hero: its best 5 own cards and its best borrowed card, by the additive score. Ties keep the earlier card.
 * Undefined without a shortlist. Type mix is not considered yet.
 */
export function pickDeck(support: SupportInput | undefined, ctx: DeckContext): SupportDeck | undefined {
	if (!support || (!support.own.length && !support.borrowed.length)) return undefined;
	const trainings = support.trainingsPerCard ?? DEFAULT_TRAININGS_PER_CARD;
	const best = (picks: SupportPick[], n: number) => picks
		.map((p, i) => ({ p, i, s: cardScore(p, trainings, ctx) }))
		.sort((a, b) => b.s - a.s || a.i - b.i)
		.slice(0, n)
		.map((x) => x.p);
	const own = best(support.own, OWN_SLOTS);
	const borrowed = best(support.borrowed, 1)[0];
	const notes: string[] = [];
	if (own.length < OWN_SLOTS) notes.push(`Only ${own.length} own support cards shortlisted: the deck has fewer than ${OWN_SLOTS}.`);
	if (!borrowed) notes.push('No Borrowed support card shortlisted: the deck is own cards only.');
	return { own, borrowed, notes };
}
