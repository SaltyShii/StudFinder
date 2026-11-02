/** What one skill costs to buy, from the game data: the base cost and the skill group it shares with its other versions. The base cost stays undiscounted because the Hint level differs per run; `discounted` applies it when a run buys. */
export interface SkillCost {
	cost: number;
	group: number;
	/** A gold or ◎ skill: the skill it is learned on and replaces, the next one down its group. Buying it means buying that one first, so the chain down the group is one bundle. */
	replacesId?: string;
	/** A gold skill keeps its own hints; the game shares a hint among the white skills of a group. */
	gold?: boolean;
}

/** The Skill point budget as one Whole-Ace request carries it: the costs of the skills in play and their value (lengths gained) as already simulated. */
export interface AceBudget {
	/** Skill points to spend. */
	budget: number;
	costs: Record<string, SkillCost>;
	values: Record<string, number>;
}

/** The skill and what it is learned on, from the top of its group down; empty when a step has no price, so it cannot be bought. */
function chainOf(id: string, costs: Record<string, SkillCost>): string[] {
	const chain: string[] = [];
	for (let at: string | undefined = id; at !== undefined; at = costs[at].replacesId) {
		if (!costs[at]) return [];
		chain.push(at);
	}
	return chain;
}

/** The skills of a set that actually race: one another replaces is gone once that one is learned. `lowerOf` names the skill each upgrade replaces. */
export function withoutReplaced(skillIds: string[], lowerOf: Record<string, string>): string[] {
	const gone = new Set<string>();
	for (const id of skillIds) for (let at = lowerOf[id]; at !== undefined; at = lowerOf[at]) gone.add(at);
	return skillIds.filter((id) => !gone.has(id));
}

/**
 * The budget a Whole-Ace request carries for the skills it may buy: the costs of those with a price (plus the skills a gold or ◎ skill is learned on, which the bundle needs) and their values.
 * Skills the game data gives no cost are left out, so `buySet` never buys them.
 */
export function aceBudget({ budget, costs: priced }: { budget: number; costs: Record<string, SkillCost> }, skillIds: string[], valueOf: (id: string) => number): AceBudget {
	const ids = skillIds.filter((id) => id in priced);
	const costs: Record<string, SkillCost> = {};
	for (const id of ids) {
		const c = priced[id];
		costs[id] = c;
		for (let lower = c.replacesId; lower !== undefined && lower in priced; lower = priced[lower].replacesId) costs[lower] = priced[lower];
	}
	return { budget, costs, values: Object.fromEntries(ids.map((id) => [id, valueOf(id)])) };
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
 * Items are the skills as bundles of everything they are learned on (a ◎ with its ○, a gold with its white versions), each step discounted; the card list's skills plus any hinted skill. A hint on a white skill discounts the white skills of its group alike.
 * A skill with no cost (not for sale) is never an item. Ties keep the earlier item, so the result is a pure function of the arguments.
 */
export function buySet({ budget, costs, values }: AceBudget, buyableSkillIds: string[], { skillIds: hinted, hints }: { skillIds: string[]; hints: Record<string, number> }): string[] {
	const ids = [...new Set([...buyableSkillIds, ...hinted])];
	const whiteHints = new Map<number, number>();
	for (const [id, level] of Object.entries(hints)) if (costs[id] && !costs[id].gold) whiteHints.set(costs[id].group, Math.max(whiteHints.get(costs[id].group) ?? 0, level));
	const costOf = (id: string) => discounted(costs[id].cost, costs[id].gold ? hints[id] ?? 0 : whiteHints.get(costs[id].group) ?? 0);
	const groups = new Map<number, Item[]>();
	for (const id of ids) {
		const c = costs[id];
		const value = values[id] ?? 0;
		if (!c || value <= 0) continue;
		const chain = chainOf(id, costs);
		if (!chain.length) continue;
		const item: Item = { skillIds: chain, cost: chain.reduce((t, at) => t + costOf(at), 0), value };
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
