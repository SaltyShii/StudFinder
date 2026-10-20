import data from './data/cm-presets.json';
import type { RaceConditions } from './pairedRace';
import type { CmPreset } from './shared';

/** Champions Meeting preset, from saltyuma-tools umalator-global (confirmed=false means a predicted date). */
export interface Cm extends RaceConditions {
	id: number;
	name: string;
	date: string;
	courseId: number;
	confirmed?: boolean;
}
function parseCms(raw: unknown): Cm[] {
	if (!Array.isArray(raw)) throw new Error('cm-presets.json must be an array');
	return raw.map((c: unknown, i) => {
		const r = c as Partial<Cm> | null;
		if (!r || typeof r.id !== 'number' || typeof r.name !== 'string' || typeof r.date !== 'string' || typeof r.courseId !== 'number') throw new Error(`cm-presets.json entry ${i} is not a valid CM preset`);
		return r as Cm;
	});
}
export const CMS = parseCms(data);

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

export function cmPreset(cm: Cm, runner: CmPreset['runner']): CmPreset {
	return { courseId: cm.courseId, season: cm.season, ground: cm.ground, weather: cm.weather, time: cm.time, runner };
}
