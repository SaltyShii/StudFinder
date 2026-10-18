import data from './data/cm-presets.json';
import type { CmPreset } from './recommend';

/** Champions Meeting preset, from saltyuma-tools umalator-global (confirmed=false means a predicted date). */
export interface Cm {
	id: number;
	name: string;
	date: string;
	courseId: number;
	confirmed?: boolean;
}
export const CMS = data as unknown as Cm[];

/** Override wins; otherwise the first CM on or after `today`, else the latest known. */
export function pickCm(today: Date, overrideId?: number, cms: Cm[] = CMS): Cm {
	if (overrideId !== undefined) {
		const o = cms.find((c) => c.id === overrideId);
		if (!o) throw new Error(`Unknown CM preset ${overrideId}`);
		return o;
	}
	const day = today.toISOString().slice(0, 10);
	const sorted = [...cms].sort((a, b) => a.date.localeCompare(b.date));
	return sorted.find((c) => c.date >= day) ?? sorted[sorted.length - 1];
}

export function cmPreset(cm: Cm, horse: CmPreset['horse']): CmPreset {
	return { courseId: cm.courseId, horse };
}

const GRADES = 'GFEDCBAS';
export interface StyleCandidate {
	strategy: string;
	distanceAptitude: string;
	strategyAptitude: string;
}
const DISTANCE_WEIGHT = 2; // distance aptitude matters more than style aptitude

/** Best first; ties keep input order. */
export function rankStyles(candidates: StyleCandidate[]): StyleCandidate[] {
	const score = (c: StyleCandidate) => DISTANCE_WEIGHT * GRADES.indexOf(c.distanceAptitude) + GRADES.indexOf(c.strategyAptitude);
	return [...candidates].sort((a, b) => score(b) - score(a));
}
