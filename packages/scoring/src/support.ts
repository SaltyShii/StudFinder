import { discounted, MAX_HINT_LEVEL } from './skillBudget';
import { categoryOf } from './ace';

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

/** The Type mix: cards per type over the 6 deck slots (for example 3 speed, 2 wit, 1 friend). Any mix is allowed. */
export type TypeMix = Partial<Record<SupportType, number>>;

/** The Type mix a Champions Meeting starts with, by course distance in metres. Only sprint has one (the spec gives just that); the rest start empty, no constraint, for the player to set. */
export function defaultTypeMix(distance: number): TypeMix {
	return categoryOf(distance) === 'short' ? { speed: 3, wit: 2, friend: 1 } : {};
}

/** The Support input of `recommend()`: what the player would consider running. Both lists empty (or the input absent) changes nothing. */
export interface SupportInput {
	own: SupportPick[];
	borrowed: SupportPick[];
	/** How many cards of each type the deck holds over all 6 slots, the borrowed card included. Absent or empty: no constraint. */
	typeMix?: TypeMix;
	/** Trainings each deck card appears in over a run (a Sim assumption); DEFAULT_TRAININGS_PER_CARD when absent. */
	trainingsPerCard?: number;
}

/** The Support deck an Ace hero was ranked with: up to 5 own cards and at most 1 Borrowed support card (exactly 1 when a borrowed card is shortlisted). */
export interface SupportDeck {
	own: SupportPick[];
	borrowed?: SupportPick;
	/**
	 * Own slots held by a hintless filler: the Type mix asked for friend cards and none is shortlisted. The catalogue has no friend cards (they carry no skill hints), so a friend slot counts toward the mix, gives no hints and needs no card.
	 */
	friendFillers?: number;
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

const TYPES: SupportType[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend'];

interface Scored { p: SupportPick; i: number; s: number }

/** Own cards for the slots a borrowed card leaves in the mix: best per type up to its quota (friend quota with no card becomes a filler), then the best of the rest. */
function ownForMix(scored: Scored[], quota: TypeMix): { picks: Scored[]; fillers: number } {
	const picks: Scored[] = [];
	let fillers = 0;
	for (const t of TYPES) {
		const of = scored.filter((x) => x.p.card.type === t).slice(0, quota[t] ?? 0);
		picks.push(...of);
		if (t === 'friend') fillers += (quota.friend ?? 0) - of.length;
	}
	// Quotas past the 5 own slots drop their lowest scores first; a filler scores 0.
	const room = OWN_SLOTS - fillers;
	const kept = picks.sort((a, b) => b.s - a.s || a.i - b.i).slice(0, Math.max(0, room));
	fillers = Math.min(fillers, OWN_SLOTS);
	const rest = scored.filter((x) => !kept.includes(x));
	const gap = OWN_SLOTS - fillers - kept.length;
	return { picks: [...kept, ...rest.slice(0, Math.max(0, gap))], fillers };
}

function mixNote(mix: TypeMix, held: SupportPick[], fillers: number): string | undefined {
	const short = TYPES.filter((t) => (mix[t] ?? 0) > held.filter((p) => p.card.type === t).length + (t === 'friend' ? fillers : 0));
	if (!short.length) return undefined;
	const label = short.map((t) => `${mix[t]} ${t}`).join(', ');
	return `Type mix not met (wanted ${label}): the shortlist cannot fill it, so the gaps are filled from other shortlisted cards.`;
}

/**
 * The deck for one Ace hero: its best 5 own cards and its best borrowed card, by the additive score. Ties keep the earlier card.
 * With a Type mix the borrowed card counts in it; every borrowed candidate is tried and the deck with the fewest unmet slots wins, then the highest score.
 * A friend slot no shortlisted card fills is a hintless filler (see `friendFillers`), not a gap. A mix the shortlists cannot fill is filled from other shortlisted cards, with a note.
 * Undefined without a shortlist.
 */
export function pickDeck(support: SupportInput | undefined, ctx: DeckContext): SupportDeck | undefined {
	if (!support || (!support.own.length && !support.borrowed.length)) return undefined;
	const trainings = support.trainingsPerCard ?? DEFAULT_TRAININGS_PER_CARD;
	const rank = (picks: SupportPick[]): Scored[] => picks
		.map((p, i) => ({ p, i, s: cardScore(p, trainings, ctx) }))
		.sort((a, b) => b.s - a.s || a.i - b.i);
	const ownRanked = rank(support.own);
	const borrowedRanked = rank(support.borrowed);
	const mix = support.typeMix;
	const constrained = !!mix && TYPES.some((t) => (mix[t] ?? 0) > 0);
	let own: SupportPick[];
	let borrowed: SupportPick | undefined;
	let fillers = 0;
	if (!constrained) {
		own = ownRanked.slice(0, OWN_SLOTS).map((x) => x.p);
		borrowed = borrowedRanked[0]?.p;
	} else {
		let best: { own: Scored[]; fillers: number; b?: Scored; unmet: number; score: number } | undefined;
		for (const b of borrowedRanked.length ? borrowedRanked : [undefined]) {
			const quota = { ...mix };
			if (b && (quota[b.p.card.type] ?? 0) > 0) quota[b.p.card.type]! -= 1;
			const { picks, fillers: f } = ownForMix(ownRanked, quota);
			const held = [...picks.map((x) => x.p), ...(b ? [b.p] : [])];
			const unmet = TYPES.reduce((n, t) => n + Math.max(0, (mix[t] ?? 0) - held.filter((p) => p.card.type === t).length - (t === 'friend' ? f : 0)), 0);
			const score = picks.reduce((n, x) => n + x.s, 0) + (b?.s ?? 0);
			if (!best || unmet < best.unmet || (unmet === best.unmet && score > best.score)) best = { own: picks, fillers: f, b, unmet, score };
		}
		own = best!.own.map((x) => x.p);
		borrowed = best!.b?.p;
		fillers = best!.fillers;
	}
	const notes: string[] = [];
	if (own.length + fillers < OWN_SLOTS) notes.push(`Only ${own.length} own support cards shortlisted: the deck has fewer than ${OWN_SLOTS}.`);
	if (!borrowed) notes.push('No Borrowed support card shortlisted: the deck is own cards only.');
	if (constrained) {
		const note = mixNote(mix!, [...own, ...(borrowed ? [borrowed] : [])], fillers);
		if (note) notes.push(note);
	}
	return { own, borrowed, ...(fillers ? { friendFillers: fillers } : {}), notes };
}
