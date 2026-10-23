/** What one skill costs to buy, from the game data: the base cost and the skill group it shares with its other versions. The base cost stays undiscounted because the Hint level differs per run; `discounted` applies it when a run buys. */
export interface SkillCost {
	cost: number;
	group: number;
	/** A gold skill: the white version it replaces. Buying the gold skill means buying that white skill first, so the two are one bundle. */
	replacesId?: string;
}

/** The Skill point budget as one Whole-Ace request carries it: the costs of the skills in play and their value (lengths gained) as already simulated. */
export interface AceBudget {
	/** Skill points to spend. */
	budget: number;
	costs: Record<string, SkillCost>;
	values: Record<string, number>;
}

/** Percent off the base cost per Hint level, 0 to 5. */
const HINT_OFF = [0, 10, 20, 30, 35, 40];
export const MAX_HINT_LEVEL = HINT_OFF.length - 1;

/** The cost after a Hint level's discount, in whole SP. */
export function discounted(cost: number, hintLevel: number): number {
	return Math.floor((cost * (100 - HINT_OFF[Math.min(hintLevel, MAX_HINT_LEVEL)])) / 100);
}

/** What the Ace may buy in one group: the skills it gets and what they cost together. */
interface Item {
	skillIds: string[];
	cost: number;
	value: number;
}

/**
 * The skills one Whole-Ace run buys: the set with the most lengths gained within the budget, at most one item per skill group.
 * Items are the white skills (at their discounted cost) and the gold skills as bundles (white + gold, each discounted); the card list's skills plus any hinted skill.
 * A skill with no cost (not for sale) is never an item. Ties keep the earlier item, so the result is a pure function of the arguments.
 */
export function buySet({ budget, costs, values }: AceBudget, buyableSkillIds: string[], { skillIds: hinted, hints }: { skillIds: string[]; hints: Record<string, number> }): string[] {
	const ids = [...new Set([...buyableSkillIds, ...hinted])];
	const costOf = (id: string) => discounted(costs[id].cost, hints[id] ?? 0);
	const groups = new Map<number, Item[]>();
	for (const id of ids) {
		const c = costs[id];
		const value = values[id] ?? 0;
		if (!c || value <= 0) continue;
		const white = c.replacesId ? costs[c.replacesId] : undefined;
		if (c.replacesId && !white) continue;
		const item: Item = c.replacesId
			? { skillIds: [c.replacesId, id], cost: costOf(c.replacesId) + costOf(id), value }
			: { skillIds: [id], cost: costOf(id), value };
		if (item.cost > budget) continue;
		const list = groups.get(c.group) ?? [];
		list.push(item);
		groups.set(c.group, list);
	}
	const chosen = new Set(choose([...groups.values()], Math.floor(budget)));
	// The order of the card list, as the unlimited path races it: the order can move the sim's random draws.
	return [...ids.filter((id) => chosen.has(id)), ...[...chosen].filter((id) => !ids.includes(id))];
}

/** Multiple-choice knapsack: from each group at most one item, the most total value within the budget. */
function choose(groups: Item[][], budget: number): string[] {
	const best = new Float64Array(budget + 1); // best[c]: the most value within c SP over the groups so far
	const took: Int32Array[] = []; // per group, per c: the item taken + 1 (0 for none)
	for (const items of groups) {
		const next = best.slice();
		const pick = new Int32Array(budget + 1);
		items.forEach((item, k) => {
			for (let c = item.cost; c <= budget; c++) {
				const v = best[c - item.cost] + item.value;
				if (v > next[c]) { next[c] = v; pick[c] = k + 1; }
			}
		});
		best.set(next);
		took.push(pick);
	}
	const out: string[] = [];
	let c = budget;
	for (let g = groups.length - 1; g >= 0; g--) {
		const k = took[g][c];
		if (!k) continue;
		out.push(...groups[g][k - 1].skillIds);
		c -= groups[g][k - 1].cost;
	}
	return out;
}
