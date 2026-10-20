import { sideLoopPicks } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillDetail } from './skillDetail';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { buildAce, categoryOf, courseFacts, rankStyles, type CourseFacts, type Style } from './ace';
import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { GRADE_A } from '@stud-finder/lineage/src/inheritance';
import { aceSupply, chanceKey, dirtAChance, greedyRank, mustHaveChance, maxStars, newShare, type Candidate, type CmPreset, type CandidatePick, type CandidateList, type SkillDetail, type TierList } from './shared';

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
	const versions = bestAcePerVersion(owned, horse, courseFacts(cm.courseId), (h) => { const d = detailerOf(h); return (cs) => rankAce(cs, PARENTS, h, d); }, detailerOf, mustHaves);
	const aceSlot = bestAceSlot(versions);
	const coreV = versions.length ? coreVersion(versions) : undefined;
	// The Core loop's dirt A chance uses the core version's affinities, not the Sim runner's.
	// shortcut: a candidate the core version has no entry for (its own veterans are excluded) keeps the Sim runner's affinity; upgrade if that ever matters.
	const coreById = new Map(coreV?.candidates.map((c) => [c.id, c]));
	const coreCandidates = candidateList.candidates.map((c) => coreById.get(c.id) ?? c);
	return { aceSlot, ace: rankAce(candidateList.candidates, TOP, horse, detailOf), core: tierList ? coreLoopPicks(coreCandidates, tierList, TOP, horse.skills, coreV?.aptitudes.dirt) : [], side: sideLoopPicks(candidateList.candidates, detailOf, TOP, horse.skills, mustHaves), skills: [...seen.values()].sort((a, b) => b.value - a.value) };
}

// Every version runs the sim runner's Target stats in its own best style, so only aptitudes and the unique skill differ.
// A parent and its own 2 grandparents are permanently linked, so each candidate is one unit and the slot takes the best PAIR of units (never grandparents alone).
// Dirt plays no part here: pair order is Must-have inheritance chance, then simulated value on the selected track.
// The score is the version's own unique skill value plus its parents' marginal value; a version with no roster candidates still scores by its unique alone.
function bestAcePerVersion(owned: OwnedVersion[], runner: HorseDesc, course: CourseFacts, rankerFor: (h: HorseDesc) => (cs: Candidate[]) => CandidatePick[], detailerOf: (h: HorseDesc) => (id: string) => SkillDetail, mustHaves: string[]): { v: OwnedVersion; pick: AcePick }[] {
	const out: { v: OwnedVersion; pick: AcePick }[] = [];
	for (const v of owned) {
		const units = v.candidates;
		const pairs: Candidate[][] = [];
		for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i], units[j]]);
		if (units.length === 1) pairs.push(units);
		if (!pairs.length) pairs.push([]);
		const style = rankStyles(v.aptitudes, categoryOf(course.distance))[0];
		const { speed, stamina, power, guts, wisdom } = runner;
		const input = { aptitudes: v.aptitudes, style, category: categoryOf(course.distance), surface: course.surface, target: { speed, stamina, power, guts, wisdom } };
		const h = buildAce({ ...input, uniqueSkillId: v.uniqueSkillId });
		// Measured on the runner without it, as every skill's value is.
		const uniqueValue = v.uniqueSkillId && v.uniqueSkillId in skillData ? detailerOf(buildAce(input))(v.uniqueSkillId).value : 0;
		const keys = pairs.map((p) => chanceKey(mustHaveChance(p.flatMap((c) => c.horses), mustHaves)));
		const topKey = Math.max(...keys);
		const rank = rankerFor(h);
		// Simulated value only for the pairs still tied, as it needs a ranker run each.
		const scored = pairs.flatMap((p, i) => keys[i] === topKey ? [{ parents: rank(p) }] : []).map((x) => ({ ...x, score: uniqueValue + x.parents.reduce((s, p) => s + p.score, 0) }));
		const win = scored.reduce((a, b) => (b.score > a.score ? b : a));
		out.push({ v, pick: { cardId: v.cardId, style, score: win.score, mustHaveChance: topKey / 1e9, parents: win.parents } });
	}
	return out;
}

function bestAceSlot(versions: { pick: AcePick }[]): AcePick | null {
	let best: AcePick | null = null;
	for (const { pick } of versions) if (!best || chanceKey(pick.mustHaveChance) > chanceKey(best.mustHaveChance) || (chanceKey(pick.mustHaveChance) === chanceKey(best.mustHaveChance) && pick.score > best.score)) best = pick;
	return best;
}

// The Core loop's own version: Turf A with Dirt A, else Turf A that can reach Dirt A through a lineage (highest dirt aptitude first), else all; simulated value breaks ties.
// Independent of the displayed Ace: dirt only matters to the Core loop.
function coreVersion(versions: { v: OwnedVersion; pick: AcePick }[]): OwnedVersion | undefined {
	const tierOf = ({ v }: { v: OwnedVersion }) => v.aptitudes.turf < GRADE_A ? 2 : v.aptitudes.dirt >= GRADE_A ? 0 : v.candidates.some((c) => dirtAChance(c.horses, v.aptitudes.dirt) > 0) ? 1 : 2;
	const gate = Math.min(...versions.map(tierOf));
	const pool = versions.filter((x) => tierOf(x) === gate);
	return pool.reduce<{ v: OwnedVersion; pick: AcePick } | undefined>((a, b) => (!a || b.v.aptitudes.dirt > a.v.aptitudes.dirt || (b.v.aptitudes.dirt === a.v.aptitudes.dirt && b.pick.score > a.pick.score) ? b : a), undefined)?.v;
}
