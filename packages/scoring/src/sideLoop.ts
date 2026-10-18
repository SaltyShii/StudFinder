import { FactorType } from '@stud-finder/lineage/src/types';
import { chanceAny, procChance } from '@stud-finder/lineage/src/inheritance';
import { supplied, type Outfit, type Pick, type SkillDetail } from './recommend';

// Invented: lengths-equivalent of landing the CM pink spark (aptitude up); tune against real runs.
const PINK_LENGTHS = 1;
// Invented: skills assumed to be 3-star white sparks, as side loop veterans are built for the CM.
const SKILL_STARS = 3;

export function sideLoopPicks(outfits: Outfit[], detailOf: (id: string) => SkillDetail, top: number): Pick[] {
	return outfits
		.map((o): Pick => {
			const aff = o.affinity ?? 0;
			const inspire = (type: FactorType, stars: number) => {
				const p = procChance(type, stars, aff);
				return chanceAny([p, p]);
			};
			const detail = [...new Set(o.skillIds)].filter((id) => !supplied(outfits, o).skills.has(id)).map(detailOf);
			const skillP = inspire(FactorType.Skill, SKILL_STARS);
			const pinkP = o.pinkSparks ? inspire(FactorType.Aptitude, o.pinkSparks) : 0;
			const score = skillP * detail.reduce((s, d) => s + d.value, 0) + pinkP * PINK_LENGTHS;
			const reason = [o.pinkSparks && `CM pink ${o.pinkSparks} stars`, detail.length && `${detail.length} skills at ${(skillP * 100).toFixed(0)}% inherit`].filter(Boolean).join(', ') || 'no CM pink or skills';
			return { outfitId: o.id, owned: o.owned, score, reason, detail };
		})
		.sort((a, b) => b.score - a.score || a.outfitId.localeCompare(b.outfitId))
		.slice(0, top);
}
