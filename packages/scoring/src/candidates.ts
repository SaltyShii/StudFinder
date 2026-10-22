import { versionName, type GameData } from '../../lineage/src/gameData';
import { lineageCompat } from '../../lineage/src/compatibility';
import { FactorType, type Veteran } from '../../lineage/src/types';
import { categoryOf, type Category } from './ace';
import type { Candidate, LineageHorse } from './shared';

/** Factor groups of the distance pink sparks (see lineage APTITUDE_BY_GROUP). */
const PINK_GROUP: Record<Category, number> = { short: 31, mile: 32, middle: 33, long: 34 };
/** Factor group of the dirt aptitude spark. */
const DIRT_GROUP = 12;
/** Factor group of the turf aptitude spark. */
const TURF_GROUP = 11;

/** Factor group of the CM-relevant pink spark: the distance aptitude of the course. */
export function pinkGroupOf(distance: number): number {
	return PINK_GROUP[categoryOf(distance)];
}

export interface CandidateTarget {
	/** The Ace's card; affinity is measured against it. */
	aceCardId: number;
	/** Factor group of the CM-relevant pink spark. */
	pinkGroupId: number;
}

function horseOf(data: GameData, cardId: number, factorIds: number[], affinity: number, pinkGroupId: number): LineageHorse {
	const factors = factorIds.flatMap((id) => data.factors.get(id) ?? []);
	return {
		cardId,
		affinity,
		pinkStars: Math.max(0, ...factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === pinkGroupId).map((f) => f.stars)),
		dirtStars: factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === DIRT_GROUP).reduce((s, f) => s + f.stars, 0),
		turfStars: factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === TURF_GROUP).reduce((s, f) => s + f.stars, 0),
		skills: factors.filter((f) => f.type === FactorType.Skill && f.skillId != null).map((f) => ({ skillId: String(f.skillId), name: f.name, stars: f.stars })),
	};
}

// Every veteran except runs of the Ace's own version is a candidate parent; nothing that is not a veteran exists to be scored.
// Each brings itself and its two parents, which become the Ace's grandparents, so all three inspire with their own affinity.
// Borrowed veterans (friends' rentals) are candidates like any other when the caller passes them in; the 5 borrows a day are not modelled,
// since each candidate is scored on its own and a run takes at most one borrow.
// Green (unique) sparks are not scored: they only grant a white skill on the parent and are not inherited further.
export function candidatesOf(data: GameData, veterans: Veteran[], t: CandidateTarget): Candidate[] {
	const target = data.charaIdOfCard(t.aceCardId);
	return veterans.filter((v) => v.cardId !== t.aceCardId && (target == null || data.charaIdOfCard(v.cardId) !== target)).map((v) => {
		const compat = target == null ? null : lineageCompat(data, target, v, v).parents[0];
		const card = data.cards.get(v.cardId);
		const version = card ? versionName(card) : String(v.cardId);
		const label = v.borrowed ? `borrowed from ${v.borrowed.trainerName ?? v.borrowed.trainerId}` : `Rank score ${v.rankScore}, created ${v.createdAt}`;
		const horses = [horseOf(data, v.cardId, v.factorIds, compat?.affinity ?? 0, t.pinkGroupId)];
		v.parents.forEach((g, i) => { if (g) horses.push(horseOf(data, g.cardId, g.factorIds, compat?.grandparents[i] ?? 0, t.pinkGroupId)); });
		// Borrowed trainedIds are negative, so they never collide with owned ones.
		return { id: String(v.trainedId), name: `${version} (${label})`, horses, charaId: data.charaIdOfCard(v.cardId) ?? undefined };
	});
}
