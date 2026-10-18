import type { GameData } from '../../lineage/src/gameData';
import type { Veteran } from '../../lineage/src/types';
import type { Outfit } from './recommend';

// The generated game data holds Global outfits only, so every card is a candidate.
// Hard-to-train outfits (missing aptitudes) are deliberately not filtered out.
export function candidatePool(data: GameData, veterans: Veteran[]): Outfit[] {
	const owned = new Set(veterans.map((v) => v.cardId));
	return [...data.cards.values()].map((c) => ({
		id: String(c.id),
		name: `${c.title} ${c.name}`.trim(),
		owned: owned.has(c.id),
		skillIds: (c.skillIds ?? []).map(String),
	}));
}
