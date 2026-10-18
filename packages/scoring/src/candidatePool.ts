import type { GameData } from '../../lineage/src/gameData';
import { lineageCompat } from '../../lineage/src/compatibility';
import { FactorType, type Veteran } from '../../lineage/src/types';
import type { Outfit } from './recommend';

export interface PoolTarget {
	/** The Ace's card; affinity is measured against it. */
	aceCardId: number;
	/** Factor group of the CM-relevant pink spark. */
	pinkGroupId: number;
}

const DIRT_GROUP = 12;

type Sparks = Pick<Outfit, 'pinkSparks' | 'affinity' | 'whiteSparks' | 'dirtSparks'>;

// Sparks and affinity of one Veteran, as the scored Outfit fields.
function sparksOf(data: GameData, v: Veteran, t: PoolTarget): Sparks {
	const factors = v.factorIds.flatMap((id) => data.factors.get(id) ?? []);
	const target = data.charaIdOfCard(t.aceCardId);
	return {
		pinkSparks: Math.max(0, ...factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === t.pinkGroupId).map((f) => f.stars)),
		affinity: target == null ? 0 : lineageCompat(data, target, v, v).parents[0].affinity,
		whiteSparks: factors.filter((f) => f.type === FactorType.Skill).map((f) => f.name),
		dirtSparks: factors.filter((f) => f.type === FactorType.Aptitude && f.groupId === DIRT_GROUP).reduce((s, f) => s + f.stars, 0),
	};
}

// The generated game data holds Global outfits only, so every card is a candidate.
// Hard-to-train outfits (missing aptitudes) are deliberately not filtered out.
// An owned outfit takes its data from its best Veteran: highest affinity, then rank score.
export function candidatePool(data: GameData, veterans: Veteran[], target?: PoolTarget): Outfit[] {
	const best = new Map<number, { v: Veteran; s?: Sparks }>();
	for (const v of veterans) {
		const s = target && sparksOf(data, v, target);
		const cur = best.get(v.cardId);
		if (!cur || ((s?.affinity ?? 0) - (cur.s?.affinity ?? 0) || v.rankScore - cur.v.rankScore) > 0) best.set(v.cardId, { v, s });
	}
	return [...data.cards.values()].map((c) => ({
		id: String(c.id),
		name: `${c.title} ${c.name}`.trim(),
		owned: best.has(c.id),
		skillIds: (c.skillIds ?? []).map(String),
		...best.get(c.id)?.s,
	}));
}
