import { sideLoopPicks } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillDetail } from './skillDetail';
import { FactorType } from '@stud-finder/lineage/src/types';
import { chanceAny, procChance } from '@stud-finder/lineage/src/inheritance';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { buildAce, categoryOf, courseFacts, rankStyles, type CourseFacts, type Style } from './ace';
import { aceSupply, greedyRank, maxStars, newShare, type Candidate, type CmPreset, type CandidatePick, type CandidateList, type LineageHorse, type SkillDetail, type TierList } from './shared';

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
	const detailOf = detailerOf(horse);
	const aceSlot = owned.length ? bestAceSlot(owned, horse, courseFacts(cm.courseId), (h) => { const d = detailerOf(h); return (cs) => rankAce(cs, mustHaves.length ? cs.length : PARENTS, h, d); }, mustHaves) : null;
	return { aceSlot, ace: rankAce(candidateList.candidates, TOP, horse, detailOf), core: tierList ? coreLoopPicks(candidateList.candidates, tierList, TOP, horse.skills) : [], side: sideLoopPicks(candidateList.candidates, detailOf, TOP, horse.skills) };
}

// Every version runs the sim runner's Target stats in its own best style, so only aptitudes and the unique skill differ.
function bestAceSlot(owned: OwnedVersion[], runner: HorseDesc, course: CourseFacts, rankerFor: (h: HorseDesc) => (cs: Candidate[]) => CandidatePick[], mustHaves: string[]): AcePick | null {
	let best: AcePick | null = null;
	for (const v of owned) {
		const style = rankStyles(v.aptitudes, categoryOf(course.distance))[0];
		const { speed, stamina, power, guts, wisdom } = runner;
		const h = buildAce({ aptitudes: v.aptitudes, style, category: categoryOf(course.distance), surface: course.surface, target: { speed, stamina, power, guts, wisdom }, uniqueSkillId: v.uniqueSkillId });
		const byId = new Map(v.candidates.map((c) => [c.id, c]));
		const chanceOf = (ids: string[]) => mustHaveChance(ids.flatMap((id) => byId.get(id)?.horses ?? []), mustHaves);
		// With Must-haves the parents are the likeliest carriers first (stable sort keeps simulated value as the tie-break).
		const ranked = rankerFor(h)(v.candidates);
		if (mustHaves.length) ranked.sort((a, b) => chanceOf([b.candidateId]) - chanceOf([a.candidateId]));
		const parents = ranked.slice(0, PARENTS);
		const score = parents.reduce((s, p) => s + p.score, 0);
		const pick = { cardId: v.cardId, style, score, mustHaveChance: chanceOf(parents.map((p) => p.candidateId)), parents };
		if (!best || pick.mustHaveChance > best.mustHaveChance || (pick.mustHaveChance === best.mustHaveChance && score > best.score)) best = pick;
	}
	return best;
}

function mustHaveChance(horses: LineageHorse[], mustHaves: string[]): number {
	return Math.max(0, ...mustHaves.map((id) => chanceAny(horses.flatMap((h) => h.skills.filter((s) => s.skillId === id).map((s) => procChance(FactorType.Skill, s.stars, h.affinity))))));
}
