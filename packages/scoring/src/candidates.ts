import type { GameData } from '../../lineage/src/gameData';
import { lineageCompat } from '../../lineage/src/compatibility';
import { FactorType, type Veteran } from '../../lineage/src/types';
import { DIRT_GROUP } from './ace';
import type { Candidate, LineageHorse } from './shared';

export interface CandidateTarget {
	/** The Ace's card; affinity is measured against it. */
	aceCardId: number;
	/** Factor group of the CM-relevant pink spark. */
	pinkGroupId: number;
}

function horseOf(data: GameData, factorIds: number[], affinity: number, pinkGroupId: number): LineageHorse {
	const factors = factorIds.flatMap((id) => data.factors.get(id) ?? []);
	return {
		affinity,
		pinkStars: Math.max(0, ...factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === pinkGroupId).map((f) => f.stars)),
		dirtStars: factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === DIRT_GROUP).reduce((s, f) => s + f.stars, 0),
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
	return veterans.filter((v) => v.cardId !== t.aceCardId).map((v) => {
		const compat = target == null ? null : lineageCompat(data, target, v, v).parents[0];
		const card = data.cards.get(v.cardId);
		const version = card ? `${card.title} ${card.name}`.trim() : String(v.cardId);
		const label = v.borrowed ? `borrowed from ${v.borrowed.trainerName ?? v.borrowed.trainerId}` : `Rank score ${v.rankScore}, created ${v.createdAt}`;
		const horses = [horseOf(data, v.factorIds, compat?.affinity ?? 0, t.pinkGroupId)];
		v.parents.forEach((g, i) => { if (g) horses.push(horseOf(data, g.factorIds, compat?.grandparents[i] ?? 0, t.pinkGroupId)); });
		// Borrowed trainedIds are negative, so they never collide with owned ones.
		return { id: String(v.trainedId), name: `${version} (${label})`, horses };
	});
}
