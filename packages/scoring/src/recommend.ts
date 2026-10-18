import type { HorseDesc } from '@stud-finder/sim/src/RaceSolverBuilder';
import skills from '@stud-finder/sim/src/data/skill_data.json';
import { coreLoopPicks, type TierList } from './coreLoop';
import { skillValue, type SkillValue } from './skillValue';

// Minimal Roster until the importer lands; pinkSparks exists only so Ace can ignore it.
export interface Outfit {
	id: string;
	name: string;
	owned: boolean;
	/** Skills this outfit would pass on to the Ace. */
	skillIds: string[];
	pinkSparks?: number;
	/** Core loop inputs; blue sparks are deliberately not modelled. */
	whiteSparks?: string[];
	dirtSparks?: number;
}
export interface Roster {
	outfits: Outfit[];
}
export interface CmPreset {
	courseId: number;
	horse: HorseDesc;
	samples?: number;
	seed?: number;
	tierList?: TierList;
}
export interface SkillDetail extends SkillValue {
	skillId: string;
	/** Value rests on the sim's default position assumption. */
	assumesPosition: boolean;
}
export interface Pick {
	outfitId: string;
	owned: boolean;
	score: number;
	reason: string;
	detail: SkillDetail[];
}
export interface Recommendation {
	ace: Pick[];
	core: Pick[];
}

const POSITION = /order|overtake|behind|infront|blocked/;
const assumesPosition = (id: string) =>
	((skills as unknown as Record<string, { alternatives: { condition: string }[] }>)[id]?.alternatives ?? []).some((a) => POSITION.test(a.condition));

const TOP = 5;

export function recommend(roster: Roster, { samples = 100, seed = 1, tierList, ...cm }: CmPreset): Recommendation {
	const cache = new Map<string, SkillDetail>();
	const detailOf = (skillId: string) => {
		let d = cache.get(skillId);
		if (!d) cache.set(skillId, (d = { skillId, ...skillValue(skillId, { ...cm, samples, seed }), assumesPosition: assumesPosition(skillId) }));
		return d;
	};
	const ace = roster.outfits
		.map((o): Pick => {
			const detail = [...new Set(o.skillIds)].map(detailOf); // duplicates are not credited twice
			const score = detail.reduce((s, d) => s + d.value, 0);
			const best = detail.reduce<SkillDetail | undefined>((b, d) => (!b || d.value > b.value ? d : b), undefined);
			const reason = best ? `${best.proc.toFixed(0)}% proc, ${best.lengths.median.toFixed(2)} median lengths from skill ${best.skillId}` : 'no inheritable skills';
			return { outfitId: o.id, owned: o.owned, score, reason, detail };
		})
		.sort((a, b) => b.score - a.score || a.outfitId.localeCompare(b.outfitId));
	return { ace: ace.slice(0, TOP), core: tierList ? coreLoopPicks(roster.outfits, tierList, TOP) : [] };
}
