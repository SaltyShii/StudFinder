import { trackOverview, type TrackOverview } from './trackOverview';
import { sideLoopPicks, sideLoopPriority } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { gainOverId, skillDetail, unsimulated } from './skillDetail';
import type { Scenario } from './pairedRace';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import { skillsAceCanMeet } from './learnable';
import { buildAce, categoryOf, styleOfStrategy, type Category, courseFacts, rankStyles, type CourseFacts, type Style } from './ace';
import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { GRADE_A } from '@stud-finder/lineage/src/inheritance';
import { aceSupply, aptitudeOutcomes, surfaceStarsOf, dirtAChance, greedyRank, mustHaveChance, skillChance, maxStars, newShare, type Candidate, type LineageHorse, type CmPreset, type CandidatePick, type CandidateList, type SkillDetail, type TierList } from './shared';

export type { Candidate, CmPreset, LineageHorse, CandidatePick, CandidateList, SkillDetail, SkillSpark, TierList } from './shared';

/** A version the player can train as the Ace; candidates are measured against it (affinity, own-version exclusion). */
export interface OwnedVersion {
	cardId: number;
	aptitudes: Aptitudes;
	uniqueSkillId?: string;
	/** The skills on the Ace card's own list it can buy with skill points (see buyableSkillIds); those whose conditions it cannot meet are dropped, the rest are its own skills unless a parent can pass them on. */
	learnableSkillIds?: string[];
	candidates: Candidate[];
}
/** An Ace hero: a version in the style it runs in, with 2 parents (their own parents are its 4 grandparents). */
export interface AcePick {
	cardId: number;
	style: Style;
	/** The style differs from the selected one: the version has no A in it, so it runs in its best-ranked style instead. */
	fallback: boolean;
	score: number;
	/** Expected lengths gained by this Ace with these parents: the unique skill, the parents' inheritable skills (weighted by inherit chance) and what pink sparks raise (distance and surface), each over the aptitudes the pair can reach weighted by its chance of them. Equals `score`. */
	expectedLengths: number;
	/** Per parent, its horses: itself, then its own 2 parents (the Ace's grandparents), with their sparks. */
	horses: LineageHorse[][];
	/** Best chance, over the Must-have skills, that the 2 parents and 4 grandparents pass one on (0 without Must-haves). */
	mustHaveChance: number;
	/** Chance the 2 parents and 4 grandparents lift the distance aptitude to A through pink sparks (1 when it starts at A). */
	distanceAChance: number;
	parents: CandidatePick[];
	/** The combined chart: the Ace's own skills plus everything either parent lineage can pass on, best avg lengths first. Built for the first Ace slot only; empty for the others. */
	skills: AceSkillRow[];
}

/** One skill the Ace can end up with. */
export interface AceSkillRow extends SkillDetail {
	/** Chance at least one of the 2 lineages passes it on: 1 - (1 - a)(1 - b); 1 for the Ace's own skill. */
	inherit: number;
	/** The Ace's own skill (its unique or a Buyable skill): certain, so no inherit chance applies. */
	own: boolean;
	mustHave: boolean;
}

/** A Side loop or Core loop lineage: the version to train with the 2 parents (and their grandparents) to run it with. */
export interface LoopPick {
	cardId: number;
	score: number;
	parents: CandidatePick[];
}

/** A Side loop lineage with the skills its chart shows: its Must-haves and its best simulated skills. */
export interface SideLoopPick extends LoopPick {
	skills: AceSkillRow[];
}

export interface Recommendation {
	/** Up to ACE_SLOTS Ace heroes, best first (the Ace order); empty without fit Owned versions. */
	aceSlots: AcePick[];
	ace: CandidatePick[];
	core: CandidatePick[];
	side: CandidatePick[];
	/** Per Owned version, best first: the loops as full lineages. */
	sideSlots: SideLoopPick[];
	coreSlots: LoopPick[];
	/** Every skill simulated for the Sim runner on this track (those the candidates carry), best value first. */
	skills: SkillDetail[];
	/** The selected course and the Baseline runner's speed curve on it, for the Ace slot. */
	track: TrackOverview;
}

const TOP = 5;
export const ACE_SLOTS = 10;
// Besides its Must-haves, a Side loop chart shows this many of the lineage's best simulated skills.
const SIDE_CHART_BEST = 8;
const PARENTS = 2;

/** Reported per simulated skill: screening runs first (total unknown), then the finalists are re-simulated at full samples. */
export interface RecommendProgress {
	phase: 'screen' | 'refine';
	done: number;
	/** Known for `refine` only. */
	total?: number;
}

// Skills are first simulated at this many samples to rank cheaply; only the ones a pick shows are re-simulated at full samples.
const SCREEN_SAMPLES = 20;

/** One skill to simulate at full samples for one runner. */
export interface SimRequest {
	horse: HorseDesc;
	id: string;
	samples: number;
}

/** Skills to simulate, each for one runner. They are independent, so a caller may simulate them in any order, in parallel. */
export interface SimBatch {
	/** What every request shares: the course, conditions and seed. */
	scenario: Omit<Scenario, 'horse' | 'samples'>;
	requests: SimRequest[];
	/** Tell how many requests are done so far. */
	progress(done: number): void;
}

export function simulateSkill({ horse, id, samples }: SimRequest, scenario: SimBatch['scenario']): SkillDetail {
	return skillDetail(id, { ...scenario, horse, samples });
}

/** Simulates a batch right here, one skill after the other. */
function simulateBatch(batch: SimBatch): SkillDetail[] {
	return batch.requests.map((r, i) => { const d = simulateSkill(r, batch.scenario); batch.progress(i + 1); return d; });
}

export function recommend(...args: Parameters<typeof recommendSteps>): Recommendation {
	const steps = recommendSteps(...args);
	let details: SkillDetail[] = []; // the first next() ignores its argument
	for (;;) {
		const step = steps.next(details);
		if (step.done) return step.value;
		details = simulateBatch(step.value as SimBatch); // narrowing by `done` needs strictNullChecks, which this package lacks
	}
}

/** `recommend` with its simulations handed to `runBatch`, so a pool can run them in parallel. Same result. */
export async function recommendAsync(runBatch: (batch: SimBatch) => Promise<SkillDetail[]>, ...args: Parameters<typeof recommendSteps>): Promise<Recommendation> {
	const steps = recommendSteps(...args);
	let details: SkillDetail[] = [];
	for (;;) {
		const step = steps.next(details);
		if (step.done) return step.value;
		details = await runBatch(step.value as SimBatch);
	}
}

function* recommendSteps(candidateList: CandidateList, { samples = 100, seed = 1, runner: horse, ...cm }: CmPreset, tierList?: TierList, owned: OwnedVersion[] = [], mustHaves: string[] = [], onProgress?: (p: RecommendProgress) => void, loopVersions: OwnedVersion[] = owned): Generator<SimBatch, Recommendation, SkillDetail[]> {
	// One cache per distinct runner, so Owned versions that run identically share simulations.
	const sims = new Map<string, { horse: HorseDesc; cache: Map<string, SkillDetail> }>();
	let simulated = 0;
	const standIns = new Map<string, SkillDetail>();
	// Skills a pass asked for that no simulation has answered yet: runner key -> skill id -> samples wanted.
	const missing = new Map<string, Map<string, number>>();
	// `full` skips screening for values that feed a score directly (a version's own unique skill).
	const detailerOf = (h: HorseDesc, full = false) => {
		const key = JSON.stringify(h);
		let sim = sims.get(key);
		if (!sim) sims.set(key, (sim = { horse: h, cache: new Map() }));
		const { cache } = sim;
		return (skillId: string) => {
			const d = cache.get(skillId);
			if (d && !(full && d.screened)) return d;
			// Not simulated yet: note it and answer with a stand-in. The pass is run again once the batch is in, so no stand-in reaches a result.
			const wanted = missing.get(key) ?? new Map<string, number>();
			wanted.set(skillId, Math.max(wanted.get(skillId) ?? 0, full ? samples : Math.min(samples, SCREEN_SAMPLES)));
			missing.set(key, wanted);
			let standIn = standIns.get(skillId);
			if (!standIn) standIns.set(skillId, (standIn = unsimulated(skillId, cm.courseId)));
			return standIn;
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
	// Details the Ace ranking scored with at aptitudes other than the Ace's own, for the picks that won: they are re-simulated at full samples like every shown skill.
	let extras: SkillDetail[] = [];
	const track = trackOverview({ ...cm, horse, seed });
	const pass = (): Recommendation => {
		const detailFor = detailerOf(horse);
		const seen = new Map<string, SkillDetail>();
		const detailOf = (id: string) => { const d = detailFor(id); seen.set(id, d); return d; };
			extras = [];
			const versions = bestAcePerVersion(owned, horse, courseFacts(cm.courseId), detailerOf, mustHaves, () => missing.size > 0, extras);
		const ranked = rankAceSlots(versions, categoryOf(courseFacts(cm.courseId).distance)).slice(0, ACE_SLOTS);
		// The chart simulates the whole buyable pool, so only the first Ace's rows are built.
		const aceSlots = ranked.map((x, i) => ({ ...x.pick, skills: i === 0 ? x.rows() : [] }));
		const coreV = coreVersion(loopVersions);
		// The Core loop's dirt A chance uses the core version's affinities, not the Sim runner's.
		// shortcut: a candidate the core version has no entry for (its own veterans are excluded) keeps the Sim runner's affinity; upgrade if that ever matters.
		const coreById = new Map(coreV?.candidates.map((c) => [c.id, c]));
		const coreCandidates = candidateList.candidates.map((c) => coreById.get(c.id) ?? c);
		const sum = (ps: CandidatePick[]) => ps.reduce((t, p) => t + p.score, 0);
		const horsesOf = (v: OwnedVersion, ps: CandidatePick[]) => ps.flatMap((p) => v.candidates.find((c) => c.id === p.candidateId)?.horses ?? []);
		// Each loop lineage uses the loop's own greedy ranking over the version's candidates, so the 2 parents complement each other.
		const sideSlots = loopVersions.map((v) => { const parents = sideLoopPicks(v.candidates, detailOf, PARENTS, horse.skills, mustHaves); return { pick: { cardId: v.cardId, score: sum(parents), parents, skills: sideRows(horsesOf(v, parents), detailOf, horse.skills ?? [], mustHaves) }, key: mustHaves.length ? sideLoopPriority(horsesOf(v, parents), mustHaves) : 0 }; })
			.sort((a, b) => b.key - a.key || b.pick.score - a.pick.score).slice(0, TOP).map((x) => x.pick);
		const coreSlots = tierList ? loopVersions.map((v) => { const parents = coreLoopPicks(v.candidates, tierList, PARENTS, horse.skills, v.aptitudes.dirt); return { pick: { cardId: v.cardId, score: sum(parents), parents }, tier: coreTier(v) }; })
			.sort((a, b) => a.tier - b.tier || b.pick.score - a.pick.score).slice(0, TOP).map((x) => x.pick) : [];
		return { aceSlots, sideSlots, coreSlots, ace: rankAce(candidateList.candidates, TOP, horse, detailOf), core: tierList ? coreLoopPicks(coreCandidates, tierList, TOP, horse.skills, coreV?.aptitudes.dirt) : [], side: sideLoopPicks(candidateList.candidates, detailOf, TOP, horse.skills, mustHaves), skills: [...seen.values()].sort((a, b) => b.value - a.value), track };
	};
	// Runs the ranking until it asks for nothing new, simulating what each run asked for as one batch.
	function* settle(): Generator<SimBatch, Recommendation, SkillDetail[]> {
		for (;;) {
			missing.clear();
			const rec = pass();
			if (!missing.size) return rec;
			const asks = [...missing].flatMap(([key, wanted]) => [...wanted].map(([id, n]) => ({ key, id, n })));
			const details = yield { scenario: { ...cm, seed }, requests: asks.map(({ key, id, n }) => ({ horse: sims.get(key)!.horse, id, samples: n })), progress: (done) => onProgress?.({ phase: 'screen', done: simulated + done }) };
			asks.forEach(({ key, id, n }, i) => sims.get(key)!.cache.set(id, { ...details[i], screened: n < samples, src: key }));
			simulated += asks.length;
		}
	}
	// Rank on screened values, then re-simulate the skills the picks show at full samples and rank again from the cache, until every shown skill is full.
	let rec = yield* settle();
	for (;;) {
		const todo = new Map<string, { key: string; id: string }>();
		for (const d of [...shownDetails(rec), ...extras]) if (d.screened && d.src) todo.set(`${d.src}|${d.skillId}`, { key: d.src, id: d.skillId });
		if (!todo.size) return rec;
		const entries = [...todo.values()];
		const details = yield { scenario: { ...cm, seed }, requests: entries.map(({ key, id }) => ({ horse: sims.get(key)!.horse, id, samples })), progress: (done) => onProgress?.({ phase: 'refine', done: simulated + done, total: entries.length }) };
		entries.forEach(({ key, id }, i) => sims.get(key)!.cache.set(id, { ...details[i], screened: false, src: key }));
		simulated += entries.length;
		rec = yield* settle();
	}
}

/** Every skill detail a pick of the recommendation shows. */
function shownDetails(r: Recommendation): SkillDetail[] {
	const picks = [...r.aceSlots.flatMap((a) => a.parents), ...r.ace, ...r.side, ...r.core, ...r.sideSlots.flatMap((l) => l.parents), ...r.coreSlots.flatMap((l) => l.parents)];
	return [...picks.flatMap((p) => p.detail), ...(r.aceSlots[0]?.skills ?? []), ...r.sideSlots.flatMap((l) => l.skills)];
}

/** A version's best Ace pick; its chart rows are built on demand (the learnable pool is simulated skill by skill). */
interface AceCandidate { v: OwnedVersion; pick: AcePick; rows: () => AceSkillRow[]; /** Some pair of parents can lift the distance aptitude to A (or it starts there). */ reachable: boolean }

/** The Ace at one pair of distance and surface grades. */
interface Cell { key: string; chance: number; /** With the unique skill. */ h: HorseDesc; /** Without it: the baseline skills are measured on. */ bare: HorseDesc }

// Every version runs the sim runner's Target stats in its own best style, so only aptitudes and the unique skill differ.
// A parent and its own 2 grandparents are permanently linked, so each candidate is one unit and the slot takes the best PAIR of units (never grandparents alone).
// A pair scores expected lengths: the Ace is simulated at every distance and surface grade the pair's pink sparks can reach, weighted by the chance of that grade;
// at each it counts the lengths the higher aptitude gains, the unique skill and the parents' inheritable skills (weighted by inherit chance). Style pink sparks and Must-haves play no part.
// A version with no roster candidates still scores by its unique alone.
function bestAcePerVersion(owned: OwnedVersion[], runner: HorseDesc, course: CourseFacts, detailerOf: (h: HorseDesc, full?: boolean) => (id: string) => SkillDetail, mustHaves: string[], partial: () => boolean, extras: SkillDetail[]): AceCandidate[] {
	const out: AceCandidate[] = [];
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
		const input = { aptitudes: v.aptitudes, style, category, surface: course.surface, target: { speed, stamina, power, guts, wisdom } };
		const h = buildAce({ ...input, uniqueSkillId: v.uniqueSkillId });
		const bareBase = buildAce(input);
		const uniqueId = v.uniqueSkillId && v.uniqueSkillId in skillData ? v.uniqueSkillId : undefined;
		const base = v.aptitudes[category];
		const distOutcomes = (hs: LineageHorse[]) => aptitudeOutcomes(base, hs, (x) => x.pinkStars);
		const cellRunners = new Map<string, Cell>();
		const cellAt = (d: number, s: number, chance: number): Cell => {
			const key = `${d}/${s}`;
			let c = cellRunners.get(key);
			if (!c) {
				const aptitudes = { ...v.aptitudes, [category]: d, [course.surface]: s };
				cellRunners.set(key, (c = { key, chance, h: buildAce({ ...input, aptitudes, uniqueSkillId: v.uniqueSkillId }), bare: buildAce({ ...input, aptitudes }) }));
			}
			return { ...c, chance };
		};
		const cellMemo = new Map<Candidate[], Cell[]>();
		const cellsOf = (p: Candidate[]): Cell[] => {
			let cells = cellMemo.get(p);
			if (!cells) {
				const hs = p.flatMap((c) => c.horses);
				const ds = distOutcomes(hs);
				const ss = aptitudeOutcomes(v.aptitudes[course.surface], hs, (x) => surfaceStarsOf(x, course.surface));
				cellMemo.set(p, (cells = ds.flatMap((d) => ss.map((s) => cellAt(d.grade, s.grade, d.chance * s.chance)))));
			}
			return cells;
		};
		const baseKey = `${base}/${v.aptitudes[course.surface]}`;
		const gainVsBase = (c: Cell) => (c.key === baseKey ? 0 : detailerOf(c.bare, true)(gainOverId(bareBase)).value);
		const uniqueAt = (c: Cell) => (uniqueId ? detailerOf(c.bare, true)(uniqueId).value : 0);
		// Lengths the pair gains besides its parents' skills: higher aptitudes and the unique skill, by chance of each grade.
		const extraOf = (p: Candidate[]) => cellsOf(p).reduce((t, c) => t + c.chance * (gainVsBase(c) + uniqueAt(c)), 0);
		const supplied0 = aceSupply(h.skills);
		// A candidate's skill counts its marginal stars over what the other parent supplies, weighted by the chance this parent passes it on.
		const rank = (cs: Candidate[]) => {
			const cells = cellsOf(cs);
			const mode = cells.reduce((a, b) => (b.chance > a.chance ? b : a), cells[0]);
			return greedyRank(cs, PARENTS, supplied0, (c, supplied) => {
				const stars = maxStars(c.horses.flatMap((x) => x.skills));
				const ids = [...stars.keys()].filter((id) => newShare(stars.get(id), supplied.get(id)) > 0);
				const detail = ids.map((id) => ({ ...detailerOf(mode.h)(id), inherit: skillChance(c.horses, id) }));
				const score = ids.reduce((t, id) => t + skillChance(c.horses, id) * newShare(stars.get(id), supplied.get(id)) * cells.reduce((u, cell) => u + cell.chance * detailerOf(cell.h)(id).value, 0), 0);
				const reason = detail.length ? `${detail.length} inheritable skills` : 'no inheritable skills';
				return { pick: { candidateId: c.id, score, reason, detail }, supply: stars };
			});
		};
		// The most a candidate can add, whatever the other parent supplies and whichever grades are reached: only skills that add value count.
		const grid = [...new Map(pairs.flatMap(cellsOf).map((c) => [c.key, c])).values()];
		const bound = (c: Candidate) => {
			const stars = maxStars(c.horses.flatMap((x) => x.skills));
			let total = 0;
			for (const id of stars.keys()) {
				const share = newShare(stars.get(id), supplied0.get(id));
				if (share > 0) total += share * skillChance(c.horses, id) * Math.max(0, ...grid.map((cell) => detailerOf(cell.h)(id).value));
			}
			return total;
		};
		const win = bestPair(pairs, rank, bound, extraOf, partial);
		const winCells = cellsOf(win.pair);
		const winHorses = win.pair.flatMap((c) => c.horses);
		// The scores read these at every reached grade, so they are refined like the details a pick shows.
		for (const cell of winCells) for (const p of win.pair) for (const id of maxStars(p.horses.flatMap((x) => x.skills)).keys()) extras.push(detailerOf(cell.h)(id));
		const reachable = pairs.some((p) => distOutcomes(p.flatMap((c) => c.horses)).some((o) => o.grade >= GRADE_A));
		const distanceAChance = distOutcomes(winHorses).filter((o) => o.grade >= GRADE_A).reduce((t, o) => t + o.chance, 0);
		const parentsOf = win.pair.map((c) => ({ id: c.id, horses: c.horses }));
		out.push({ v, reachable, pick: { cardId: v.cardId, style, fallback: !!chosen && style !== chosen, score: win.score, expectedLengths: win.score, horses: win.pair.map((c) => c.horses), mustHaveChance: mustHaveChance(winHorses, mustHaves), distanceAChance, parents: win.parents, skills: [] }, rows: () => aceRows(uniqueId ? detailerOf(bareBase, true)(uniqueId) : undefined, parentsOf, detailerOf(h), h.skills, mustHaves, skillsAceCanMeet(v.learnableSkillIds ?? [], { style, category, surface: course.surface })) });
	}
	return out;
}

/**
 * The pair with the best score (`extraOf` its own lengths, plus its parents' ranked scores); the earliest of equal ones.
 * A pair scores at most its extra plus the sum of its two units' bounds, so pairs are tried best bound first and the rest are skipped once the bound falls below the best found:
 * the same winner as ranking every pair, without ranking them all.
 * While a pass still waits for simulations its values are stand-ins and its result is thrown away, so it only needs to ask for the skills.
 */
export function bestPair(pairs: Candidate[][], rank: (cs: Candidate[]) => CandidatePick[], boundOf: (c: Candidate) => number, extraOf: number | ((pair: Candidate[]) => number), partial: () => boolean): { parents: CandidatePick[]; score: number; pair: Candidate[] } {
	const bounds = new Map<Candidate, number>();
	const bound = (c: Candidate) => { let v = bounds.get(c); if (v === undefined) bounds.set(c, (v = boundOf(c))); return v; };
	const extras = pairs.map((p) => (typeof extraOf === 'function' ? extraOf(p) : extraOf));
	const scoreOf = (i: number) => { const parents = rank(pairs[i]); return { parents, pair: pairs[i], score: extras[i] + parents.reduce((s, x) => s + x.score, 0) }; };
	const pairBound = pairs.map((p, i) => extras[i] + p.reduce((s, c) => s + bound(c), 0));
	if (partial()) return scoreOf(0);
	const order = pairs.map((_, i) => i).sort((a, b) => pairBound[b] - pairBound[a] || a - b);
	let win: { parents: CandidatePick[]; score: number; pair: Candidate[] } | undefined;
	let winAt = Infinity;
	for (const i of order) {
		// Slack for the float noise of adding the same numbers in another order.
		if (win && pairBound[i] + 1e-9 * (Math.abs(win.score) + 1) < win.score) break;
		const x = scoreOf(i);
		if (!win || x.score > win.score || (x.score === win.score && i < winAt)) { win = x; winAt = i; }
	}
	return win;
}

// The Ace's own skills, learnable skills and everything either parent lineage can pass on.
function aceRows(unique: SkillDetail | undefined, parents: { id: string; horses: LineageHorse[] }[], detailOf: (id: string) => SkillDetail, own: string[], mustHaves: string[], learnableSkillIds: string[]): AceSkillRow[] {
	const rows: AceSkillRow[] = unique ? [rowOf(unique, 1, mustHaves, true)] : [];
	const ids = new Set(parents.flatMap((p) => p.horses.flatMap((h) => h.skills.map((s) => s.skillId))));
	// A buyable skill is certain, so it is an own row, unless a parent lineage can pass it on: that one shows its inherit chance (the skill points it may save), not a claim that it is bought. The unique skill is not shown twice.
	for (const id of new Set(learnableSkillIds)) if (id !== unique?.skillId && !ids.has(id) && id in skillData) rows.push(rowOf(detailOf(id), 1, mustHaves, true));
	for (const id of ids) {
		if (own.includes(id) || id === unique?.skillId) continue;
		// Which lineage supplies it does not matter: a parent and its 2 grandparents are one unit.
		const inherit = 1 - parents.reduce((q, p) => q * (1 - skillChance(p.horses, id)), 1);
		rows.push(rowOf(detailOf(id), inherit, mustHaves));
	}
	return chartRows(rows);
}

function rowOf(detail: SkillDetail, inherit: number, mustHaves: string[], own = false): AceSkillRow {
	return { ...detail, inherit, own, mustHave: mustHaves.includes(detail.skillId) };
}

// Hidden when it never procs or gains nothing, unless its value rests on the default position assumption: those stay, to be greyed and marked.
function chartRows(rows: AceSkillRow[]): AceSkillRow[] {
	return rows.filter((r) => r.assumesPosition || (r.proc > 0 && r.lengths.median > 0)).sort((a, b) => b.lengths.avg - a.lengths.avg || b.value - a.value);
}

// A Side loop lineage's chart: every Must-have it carries plus its best simulated skills. The Ace's own skills are left out (nothing to inherit).
// Reads the ranking's result only; it never changes which lineage or parents win.
function sideRows(horses: LineageHorse[], detailOf: (id: string) => SkillDetail, own: string[], mustHaves: string[]): AceSkillRow[] {
	const ids = [...new Set(horses.flatMap((h) => h.skills.map((s) => s.skillId)))].filter((id) => !own.includes(id) && id in skillData);
	const rows = chartRows(ids.map((id) => rowOf(detailOf(id), skillChance(horses, id), mustHaves)));
	const best = rows.filter((r) => !r.mustHave).sort((a, b) => b.value - a.value).slice(0, SIDE_CHART_BEST);
	return rows.filter((r) => r.mustHave || best.includes(r));
}

// Up to the 10 best, from the best tier present only: distance A, else reachable through pink sparks, else neither (an F-sprint uma with no way up never ranks while a better tier exists).
// Within the tier: most expected lengths gained first; Must-haves and the chance of distance A do not order them.
function rankAceSlots(versions: AceCandidate[], category: Category): AceCandidate[] {
	const tierOf = ({ v, reachable }: AceCandidate) => v.aptitudes[category] >= GRADE_A ? 0 : reachable ? 1 : 2;
	const gate = Math.min(...versions.map(tierOf));
	// Array.prototype.sort is stable, so equal ones keep the Owned order.
	return versions.filter((x) => tierOf(x) === gate).sort((a, b) => b.pick.score - a.pick.score);
}

function coreTier(v: OwnedVersion): number {
	return v.aptitudes.turf < GRADE_A ? 2 : v.aptitudes.dirt >= GRADE_A ? 0 : v.candidates.some((c) => dirtAChance(c.horses, v.aptitudes.dirt) > 0) ? 1 : 2;
}

// The Core loop's own version, taken from the Loop versions: Turf A with Dirt A, else Turf A that can reach Dirt A through a lineage (highest dirt aptitude first), else all; the earliest breaks ties (it used to be the higher Ace score, but the Core loop no longer depends on the Ace slot).
// Independent of the Ace and its Owned versions: dirt only matters to the Core loop. No Loop versions means no core version.
function coreVersion(versions: OwnedVersion[]): OwnedVersion | undefined {
	const gate = Math.min(...versions.map(coreTier));
	const pool = versions.filter((v) => coreTier(v) === gate);
	return pool.reduce<OwnedVersion | undefined>((a, b) => (!a || b.aptitudes.dirt > a.aptitudes.dirt ? b : a), undefined);
}
