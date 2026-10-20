import { sideLoopPicks, sideLoopPriority } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillDetail } from './skillDetail';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { buildAce, categoryOf, styleOfStrategy, type Category, courseFacts, rankStyles, type CourseFacts, type Style } from './ace';
import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { GRADE_A } from '@stud-finder/lineage/src/inheritance';
import { aceSupply, chanceKey, dirtAChance, greedyRank, distanceAChance, mustHaveChance, skillChance, maxStars, newShare, type Candidate, type CmPreset, type CandidatePick, type CandidateList, type SkillDetail, type TierList } from './shared';

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
	/** Chance the 2 parents and 4 grandparents lift the distance aptitude to A through pink sparks (1 when it starts at A). */
	distanceAChance: number;
	parents: CandidatePick[];
}

/** A Side loop or Core loop lineage: the version to train with the 2 parents (and their grandparents) to run it with. */
export interface LoopPick {
	cardId: number;
	score: number;
	parents: CandidatePick[];
}

export interface Recommendation {
	aceSlot: AcePick | null;
	ace: CandidatePick[];
	core: CandidatePick[];
	side: CandidatePick[];
	/** Per Owned version, best first: the loops as full lineages. */
	sideSlots: LoopPick[];
	coreSlots: LoopPick[];
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
		const detail = [...stars.keys()].filter((id) => newShare(stars.get(id), supplied.get(id)) > 0).map((id) => ({ ...detailOf(id), inherit: skillChance(c.horses, id) }));
		const marginalValue = (d: SkillDetail) => d.value * newShare(stars.get(d.skillId), supplied.get(d.skillId));
		const score = detail.reduce((s, d) => s + marginalValue(d), 0);
		const reason = detail.length ? `${detail.length} inheritable skills` : 'no inheritable skills';
		return { pick: { candidateId: c.id, score, reason, detail }, supply: stars };
	});
	const detailFor = detailerOf(horse);
	const seen = new Map<string, SkillDetail>();
	const detailOf = (id: string) => { const d = detailFor(id); seen.set(id, d); return d; };
	const versions = bestAcePerVersion(owned, horse, courseFacts(cm.courseId), (h) => { const d = detailerOf(h); return (cs) => rankAce(cs, PARENTS, h, d); }, detailerOf, mustHaves);
	const aceSlot = bestAceSlot(versions, categoryOf(courseFacts(cm.courseId).distance));
	const coreV = versions.length ? coreVersion(versions) : undefined;
	// The Core loop's dirt A chance uses the core version's affinities, not the Sim runner's.
	// shortcut: a candidate the core version has no entry for (its own veterans are excluded) keeps the Sim runner's affinity; upgrade if that ever matters.
	const coreById = new Map(coreV?.candidates.map((c) => [c.id, c]));
	const coreCandidates = candidateList.candidates.map((c) => coreById.get(c.id) ?? c);
	const sum = (ps: CandidatePick[]) => ps.reduce((t, p) => t + p.score, 0);
	const horsesOf = (v: OwnedVersion, ps: CandidatePick[]) => ps.flatMap((p) => v.candidates.find((c) => c.id === p.candidateId)?.horses ?? []);
	// Each loop lineage uses the loop's own greedy ranking over the version's candidates, so the 2 parents complement each other.
	const sideSlots = owned.map((v) => { const parents = sideLoopPicks(v.candidates, detailOf, PARENTS, horse.skills, mustHaves); return { pick: { cardId: v.cardId, score: sum(parents), parents }, key: mustHaves.length ? sideLoopPriority(horsesOf(v, parents), mustHaves) : 0 }; })
		.sort((a, b) => b.key - a.key || b.pick.score - a.pick.score).slice(0, TOP).map((x) => x.pick);
	const coreSlots = tierList ? owned.map((v) => { const parents = coreLoopPicks(v.candidates, tierList, PARENTS, horse.skills, v.aptitudes.dirt); return { pick: { cardId: v.cardId, score: sum(parents), parents }, tier: coreTier(v) }; })
		.sort((a, b) => a.tier - b.tier || b.pick.score - a.pick.score).slice(0, TOP).map((x) => x.pick) : [];
	return { aceSlot, sideSlots, coreSlots, ace: rankAce(candidateList.candidates, TOP, horse, detailOf), core: tierList ? coreLoopPicks(coreCandidates, tierList, TOP, horse.skills, coreV?.aptitudes.dirt) : [], side: sideLoopPicks(candidateList.candidates, detailOf, TOP, horse.skills, mustHaves), skills: [...seen.values()].sort((a, b) => b.value - a.value) };
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
		for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) if (units[i].charaId == null || units[i].charaId !== units[j].charaId) pairs.push([units[i], units[j]]);
		if (units.length === 1) pairs.push(units);
		if (!pairs.length) pairs.push([]);
		const category = categoryOf(course.distance);
		// Style aptitude is not worth pink sparks, so the selected style only counts where the version already has A in it.
		const chosen = styleOfStrategy(runner.strategy);
		const style = chosen && v.aptitudes[chosen] >= GRADE_A ? chosen : rankStyles(v.aptitudes, category)[0];
		const { speed, stamina, power, guts, wisdom } = runner;
		const input = { aptitudes: v.aptitudes, style, category: categoryOf(course.distance), surface: course.surface, target: { speed, stamina, power, guts, wisdom } };
		const h = buildAce({ ...input, uniqueSkillId: v.uniqueSkillId });
		// Measured on the runner without it, as every skill's value is.
		const uniqueValue = v.uniqueSkillId && v.uniqueSkillId in skillData ? detailerOf(buildAce(input))(v.uniqueSkillId).value : 0;
		// Distance below A is raised by pink sparks: those pairs come first, then Must-have inheritance.
		const base = v.aptitudes[category];
		const pinkKeys = pairs.map((p) => base >= GRADE_A ? 0 : chanceKey(distanceAChance(p.flatMap((c) => c.horses), base)));
		const topPink = Math.max(...pinkKeys);
		pairs.splice(0, pairs.length, ...pairs.filter((_, i) => pinkKeys[i] === topPink));
		const keys = pairs.map((p) => chanceKey(mustHaveChance(p.flatMap((c) => c.horses), mustHaves)));
		const topKey = Math.max(...keys);
		const rank = rankerFor(h);
		// Simulated value only for the pairs still tied, as it needs a ranker run each.
		const scored = pairs.flatMap((p, i) => keys[i] === topKey ? [{ parents: rank(p) }] : []).map((x) => ({ ...x, score: uniqueValue + x.parents.reduce((s, p) => s + p.score, 0) }));
		const win = scored.reduce((a, b) => (b.score > a.score ? b : a));
		out.push({ v, pick: { cardId: v.cardId, style, score: win.score, mustHaveChance: topKey / 1e9, distanceAChance: base >= GRADE_A ? 1 : topPink / 1e9, parents: win.parents } });
	}
	return out;
}

// Distance A first (or reachable through pink sparks, likelier first), then Must-have chance, then simulated value; an F-sprint uma with no way up never wins.
function bestAceSlot(versions: { v: OwnedVersion; pick: AcePick }[], category: Category): AcePick | null {
	const tierOf = ({ v, pick }: { v: OwnedVersion; pick: AcePick }) => v.aptitudes[category] >= GRADE_A ? 0 : pick.distanceAChance > 0 ? 1 : 2;
	const gate = Math.min(...versions.map(tierOf));
	let best: AcePick | null = null;
	for (const x of versions) {
		if (tierOf(x) !== gate) continue;
		const { pick } = x;
		const better = !best || chanceKey(pick.distanceAChance) !== chanceKey(best.distanceAChance) ? !best || chanceKey(pick.distanceAChance) > chanceKey(best.distanceAChance)
			: chanceKey(pick.mustHaveChance) !== chanceKey(best.mustHaveChance) ? chanceKey(pick.mustHaveChance) > chanceKey(best.mustHaveChance) : pick.score > best.score;
		if (better) best = pick;
	}
	return best;
}

function coreTier(v: OwnedVersion): number {
	return v.aptitudes.turf < GRADE_A ? 2 : v.aptitudes.dirt >= GRADE_A ? 0 : v.candidates.some((c) => dirtAChance(c.horses, v.aptitudes.dirt) > 0) ? 1 : 2;
}

// The Core loop's own version: Turf A with Dirt A, else Turf A that can reach Dirt A through a lineage (highest dirt aptitude first), else all; simulated value breaks ties.
// Independent of the displayed Ace: dirt only matters to the Core loop.
function coreVersion(versions: { v: OwnedVersion; pick: AcePick }[]): OwnedVersion | undefined {
	const tierOf = ({ v }: { v: OwnedVersion }) => coreTier(v);
	const gate = Math.min(...versions.map(tierOf));
	const pool = versions.filter((x) => tierOf(x) === gate);
	return pool.reduce<{ v: OwnedVersion; pick: AcePick } | undefined>((a, b) => (!a || b.v.aptitudes.dirt > a.v.aptitudes.dirt || (b.v.aptitudes.dirt === a.v.aptitudes.dirt && b.pick.score > a.pick.score) ? b : a), undefined)?.v;
}
