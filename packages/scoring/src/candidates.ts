import { versionName, type GameData } from '../../lineage/src/gameData';
import { lineageCompat } from '../../lineage/src/compatibility';
import { APTITUDE_BY_GROUP } from '../../lineage/src/sparks';
import { FactorType, type Factor, type Veteran } from '../../lineage/src/types';
import { categoryOf, type Category, type Style } from './ace';
import type { Candidate, LineageHorse, UniqueSpark } from './shared';

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

// A card's green factor group is the card id, and the factor's skill is the white variant of its unique skill.
// Read from the game data rather than the veteran's sparks, so the parent always carries it; the veteran's own green spark only sets the stars a grandparent's chance rolls on.
const GREEN = new WeakMap<GameData, Map<number, Factor[]>>();
function greenFactorsOf(data: GameData): Map<number, Factor[]> {
	let m = GREEN.get(data);
	if (!m) {
		GREEN.set(data, (m = new Map()));
		for (const f of data.factors.values()) if (f.type === FactorType.Unique && f.skillId != null) m.set(f.groupId, [...(m.get(f.groupId) ?? []), f]);
	}
	return m;
}

function uniqueOf(data: GameData, cardId: number, factors: { type: FactorType; groupId: number; stars: number }[], certain: boolean, aceChara: number | null): UniqueSpark | undefined {
	if (aceChara != null && data.charaIdOfCard(cardId) === aceChara) return undefined;
	const green = greenFactorsOf(data).get(cardId);
	if (!green) return undefined;
	const own = Math.max(0, ...factors.filter((f) => f.type === FactorType.Unique && f.groupId === cardId).map((f) => f.stars));
	const f = green.find((x) => x.stars === own) ?? green[0];
	return { skillId: String(f.skillId), name: f.name, stars: f.stars, certain };
}

// Group ids of the running style pink sparks, from lineage's aptitude groups.
const STYLES: readonly string[] = ['nige', 'senko', 'sashi', 'oikomi'];
const STYLE_GROUPS = Object.entries(APTITUDE_BY_GROUP).filter(([, key]) => STYLES.includes(key)) as [string, Style][];

function horseOf(data: GameData, cardId: number, factorIds: number[], affinity: number, pinkGroupId: number, isParent: boolean, aceChara: number | null): LineageHorse {
	const factors = factorIds.flatMap((id) => data.factors.get(id) ?? []);
	const unique = uniqueOf(data, cardId, factors, isParent, aceChara);
	const aptitude = factors.filter((f) => f.type === FactorType.Aptitude);
	const stars = (groupId: number) => aptitude.filter((f) => f.groupId === groupId).map((f) => f.stars);
	const styleStars: Partial<Record<Style, number>> = {};
	for (const [g, style] of STYLE_GROUPS) if (Number(g) !== pinkGroupId && stars(Number(g)).length) styleStars[style] = Math.max(...stars(Number(g)));
	let pinkStars = Math.max(0, ...stars(pinkGroupId));
	let dirtStars = stars(DIRT_GROUP).reduce((s, n) => s + n, 0);
	let turfStars = stars(TURF_GROUP).reduce((s, n) => s + n, 0);
	// A horse has one pink spark, so only its strongest counts (ties: distance, then surface, then style).
	const bestStyle = Math.max(0, ...Object.values(styleStars));
	const best = Math.max(pinkStars, dirtStars, turfStars, bestStyle);
	const keepDistance = pinkStars === best;
	const keepDirt = !keepDistance && dirtStars === best;
	const keepTurf = !keepDistance && !keepDirt && turfStars === best;
	const keepStyle = !keepDistance && !keepDirt && !keepTurf;
	if (!keepDistance) pinkStars = 0;
	if (!keepDirt) dirtStars = 0;
	if (!keepTurf) turfStars = 0;
	return {
		...(unique ? { unique } : {}),
		cardId,
		affinity,
		pinkStars,
		dirtStars,
		turfStars,
		...(keepStyle && bestStyle > 0 ? { styleStars } : {}),
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
		const horses = [horseOf(data, v.cardId, v.factorIds, compat?.affinity ?? 0, t.pinkGroupId, true, target)];
		v.parents.forEach((g, i) => { if (g) horses.push(horseOf(data, g.cardId, g.factorIds, compat?.grandparents[i] ?? 0, t.pinkGroupId, false, target)); });
		// Borrowed trainedIds are negative, so they never collide with owned ones.
		return { id: String(v.trainedId), name: `${version} (${label})`, horses, charaId: data.charaIdOfCard(v.cardId) ?? undefined };
	});
}
