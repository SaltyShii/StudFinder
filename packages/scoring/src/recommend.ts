import skills from '@stud-finder/sim/src/data/skill_data.json';
import { sideLoopPicks } from './sideLoop';
import { coreLoopPicks } from './coreLoop';
import { skillValue } from './skillValue';
import { rank, type CmPreset, type Pick, type Roster, type SkillDetail, type TierList } from './shared';

export type { Candidate, CmPreset, LineageHorse, Pick, Roster, SkillDetail, SkillSpark, TierList } from './shared';

export interface Recommendation {
	ace: Pick[];
	core: Pick[];
	side: Pick[];
}

const POSITION = /order|overtake|behind|infront|blocked/;
const TOP = 5;

// The vendored JSON is untyped at runtime, so narrow it instead of casting.
export function assumesPosition(id: string): boolean {
	const skill: unknown = (skills as Record<string, unknown>)[id];
	if (skill === undefined) return false;
	const alts = typeof skill === 'object' && skill !== null ? (skill as { alternatives?: unknown }).alternatives : undefined;
	if (!Array.isArray(alts)) throw new Error(`Skill ${id} has no alternatives array in skill_data.json`);
	return alts.some((a: unknown) => typeof a === 'object' && a !== null && POSITION.test(String((a as { condition?: unknown }).condition)));
}

export function recommend(roster: Roster, { samples = 100, seed = 1, ace: horse, ...cm }: CmPreset, tierList?: TierList): Recommendation {
	const cache = new Map<string, SkillDetail>();
	const detailOf = (skillId: string) => {
		let d = cache.get(skillId);
		if (!d) cache.set(skillId, (d = { skillId, ...skillValue(skillId, { ...cm, horse, samples, seed }), assumesPosition: assumesPosition(skillId) }));
		return d;
	};
	// Ignores spark chance on purpose: it counts every distinct skill the veteran and its parents carry.
	const aces = roster.candidates
		.map((c): Pick => {
			const ids = [...new Set(c.horses.flatMap((h) => h.skills.map((s) => s.skillId)))].filter((id) => !horse.skills?.includes(id));
			const detail = ids.map(detailOf);
			const score = detail.reduce((s, d) => s + d.value, 0);
			const best = detail.reduce<SkillDetail | undefined>((b, d) => (!b || d.value > b.value ? d : b), undefined);
			const reason = best ? `${best.proc.toFixed(0)}% proc, ${best.lengths.median.toFixed(2)} median lengths from skill ${best.skillId}` : 'no inheritable skills';
			return { candidateId: c.id, score, reason, detail };
		});
	return { ace: rank(aces, TOP), core: tierList ? coreLoopPicks(roster.candidates, tierList, TOP) : [], side: sideLoopPicks(roster.candidates, detailOf, TOP, horse.skills) };
}
