import { sideLoopPicks } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillDetail } from './skillDetail';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { buildAce, categoryOf, courseFacts, rankStyles, type CourseFacts, type Style } from './ace';
import { aceSupply, chanceKey, dirtAChance, greedyRank, isFullDirt, mustHaveChance, maxStars, newShare, type Candidate, type CmPreset, type CandidatePick, type CandidateList, type SkillDetail, type TierList } from './shared';

export type { Candidate, CmPreset, LineageHorse, CandidatePick, CandidateList, SkillDetail, SkillSpark, TierList } from './shared';

/** A version the player can train as the Ace; candidates are measured against it (affinity, own-version exclusion). */
export interface OwnedVersion {
	cardId: number;
	aptitudes: Aptitudes;
	uniqueSkillId?: string;
	candidates: Candidate[];
}
/** The best Ace: a version in its best style, with 2 parents (their own parents are its 4 grandparents). */
export interface AcePick {
	cardId: number;
	style: Style;
	score: number;
	/** Best chance, over the Must-have skills, that the 2 parents and 4 grandparents pass one on (0 without Must-haves). */
	mustHaveChance: number;
	parents: CandidatePick[];
}

export interface Recommendation {
	aceSlot: AcePick | null;
	ace: CandidatePick[];
	core: CandidatePick[];
	side: CandidatePick[];
	/** Every skill simulated for the Sim runner on this track (those the candidates carry), best value first. */
	skills: SkillDetail[];
}

const TOP = 5;
const PARENTS = 2;

export function recommend(candidateList: CandidateList, { samples = 100, seed = 1, runner: horse, ...cm }: CmPreset, tierList?: TierList, owned: OwnedVersion[] = [], mustHaves: string[] = []): Recommendation {
	const detailerOf = (h: HorseDesc) => {
		const cache = new Map<string, SkillDetail>();
		return (skillId: string) => {
			let d = cache.get(skillId);
			if (!d) cache.set(skillId, (d = skillDetail(skillId, { ...cm, horse: h, samples, seed })));
			return d;
		};
	};
	// Ignores spark chance on purpose: it counts every distinct skill the veteran and its parents carry, marginal over what better picks supply.
	const rankAce = (candidates: Candidate[], top: number, h: HorseDesc, detailOf: (id: string) => SkillDetail) => greedyRank(candidates, top, aceSupply(h.skills), (c, supplied) => {
		const stars = maxStars(c.horses.flatMap((x) => x.skills));
		const detail = [...stars.keys()].filter((id) => newShare(stars.get(id), supplied.get(id)) > 0).map(detailOf);
		const marginalValue = (d: SkillDetail) => d.value * newShare(stars.get(d.skillId), supplied.get(d.skillId));
		const score = detail.reduce((s, d) => s + marginalValue(d), 0);
		const best = detail.reduce<SkillDetail | undefined>((b, d) => (!b || marginalValue(d) > marginalValue(b) ? d : b), undefined);
		const reason = best ? `${best.proc.toFixed(0)}% proc, ${best.lengths.median.toFixed(2)} median lengths from skill ${best.skillId}` : 'no inheritable skills';
		return { pick: { candidateId: c.id, score, reason, detail }, supply: stars };
	});
	const detailFor = detailerOf(horse);
	const seen = new Map<string, SkillDetail>();
	const detailOf = (id: string) => { const d = detailFor(id); seen.set(id, d); return d; };
	const aceSlot = owned.length ? bestAceSlot(owned, horse, courseFacts(cm.courseId), (h) => { const d = detailerOf(h); return (cs) => rankAce(cs, PARENTS, h, d); }, mustHaves) : null;
	return { aceSlot, ace: rankAce(candidateList.candidates, TOP, horse, detailOf), core: tierList ? coreLoopPicks(candidateList.candidates, tierList, TOP, horse.skills) : [], side: sideLoopPicks(candidateList.candidates, detailOf, TOP, horse.skills, mustHaves), skills: [...seen.values()].sort((a, b) => b.value - a.value) };
}

// Every version runs the sim runner's Target stats in its own best style, so only aptitudes and the unique skill differ.
// A parent and its own 2 grandparents are permanently linked, so each candidate is one unit and the slot takes the best PAIR of units (never grandparents alone).
// Pair order: Must-have inheritance chance, then chance of reaching dirt A, then simulated value. Full-dirt units first; partial-dirt only when fewer than 2 exist.
function bestAceSlot(owned: OwnedVersion[], runner: HorseDesc, course: CourseFacts, rankerFor: (h: HorseDesc) => (cs: Candidate[]) => CandidatePick[], mustHaves: string[]): AcePick | null {
	let best: AcePick | null = null;
	for (const v of owned) {
		const style = rankStyles(v.aptitudes, categoryOf(course.distance))[0];
		const { speed, stamina, power, guts, wisdom } = runner;
		const h = buildAce({ aptitudes: v.aptitudes, style, category: categoryOf(course.distance), surface: course.surface, target: { speed, stamina, power, guts, wisdom }, uniqueSkillId: v.uniqueSkillId });
		const full = v.candidates.filter(isFullDirt);
		const units = full.length >= PARENTS ? full : v.candidates.filter((c) => c.horses.some((x) => x.dirtStars > 0)).length >= PARENTS ? v.candidates.filter((c) => c.horses.some((x) => x.dirtStars > 0)) : v.candidates;
		const pairs: Candidate[][] = [];
		for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i], units[j]]);
		if (units.length === 1) pairs.push(units);
		if (!pairs.length) continue;
		const keyOf = (p: Candidate[]) => { const hs = p.flatMap((c) => c.horses); return [chanceKey(mustHaveChance(hs, mustHaves)), chanceKey(dirtAChance(hs, v.aptitudes.dirt))]; };
		const keys = pairs.map(keyOf);
		const top = [0, 1].reduce((alive, k) => { const m = Math.max(...alive.map((i) => keys[i][k])); return alive.filter((i) => keys[i][k] === m); }, pairs.map((_, i) => i));
		const rank = rankerFor(h);
		// Simulated value only for the pairs still tied, as it needs a ranker run each.
		const scored = top.map((i) => { const parents = rank(pairs[i]); return { i, parents, score: parents.reduce((s, p) => s + p.score, 0) }; });
		const win = scored.reduce((a, b) => (b.score > a.score ? b : a));
		const mustHave = keys[win.i][0] / 1e9;
		if (!best || chanceKey(mustHave) > chanceKey(best.mustHaveChance) || (chanceKey(mustHave) === chanceKey(best.mustHaveChance) && win.score > best.score)) best = { cardId: v.cardId, style, score: win.score, mustHaveChance: mustHave, parents: win.parents };
	}
	return best;
}
