import type { Cm } from '../../../packages/scoring/src/cm';
import type { Course } from '../../../packages/lineage/src/types';
import { surfaceOf } from '../../../packages/scoring/src/ace';

/** Hakuraku's published Champions Meeting analysis; nothing of the player's is sent, only these fixed paths are read. */
const API = 'https://hakuraku.moe/api/simdata';

const STYLE_NAMES: Record<number, string> = { 1: 'Front Runner', 2: 'Pace Chaser', 3: 'Late Surger', 4: 'End Closer', 5: 'Runaway', 6: 'Debuffer' };
/** Below this share of the field a win rate rests on too few runners to go by. */
const MIN_USAGE = 0.0005;

/** One version in one running style in a CM's data. */
export interface CmUsagePair {
	cardId: number;
	style: number;
	/** Share of the races its team won; a third is average in rooms of three teams. */
	winRate: number;
	/** Its share of the field. */
	usage: number;
}

export interface CmUsage {
	label: string;
	pairs: CmUsagePair[];
}

/** An Owned version as the CM data sees it, in its best running style there. */
export interface ViableSuggestion extends CmUsagePair {
	styleName: string;
	/** Wins more than the field does, in enough of the field to tell. */
	suggested: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
	const res = await fetch(API + path, { signal, credentials: 'omit' });
	if (!res.ok) throw new Error(`The CM data answered ${res.status}.`);
	return res.json();
}

/** Whether a snapshot's title ("CM22 - Tokyo 1,600 m - Dirt") is about this course: CM numbers are all that links the two sources, so a mismatch means the data is about another race. */
export function sameCourse(title: string, course: Pick<Course, 'distance' | 'ground'>): boolean {
	const m = /([\d,]+)\s*m\b.*\b(Turf|Dirt)\b/i.exec(title);
	return !!m && Number(m[1].replaceAll(',', '')) === course.distance && m[2].toLowerCase() === surfaceOf(course.ground);
}

/** The pairs of a snapshot summary; anything malformed is an error rather than a wrong suggestion. */
export function parseSummaryPairs(summary: unknown): CmUsagePair[] {
	const pairs = asRecord(summary)?.pairs;
	if (!Array.isArray(pairs)) throw new Error('The CM data has an unexpected shape.');
	return pairs.map((raw) => {
		const p = asRecord(raw);
		if (!p || !Number.isInteger(p.card) || !Number.isInteger(p.style) || typeof p.team !== 'number' || typeof p.pop !== 'number') throw new Error('The CM data has an unexpected shape.');
		return { cardId: p.card as number, style: p.style as number, winRate: p.team, usage: p.pop };
	});
}

/** The CM's usage and win rates, or null when the data has no snapshot for this CM on this course. */
export async function fetchCmUsage(cm: Pick<Cm, 'id'>, course: Pick<Course, 'distance' | 'ground'>, signal?: AbortSignal): Promise<CmUsage | null> {
	const snapshots = asRecord(await getJson('/manifest', signal))?.snapshots;
	if (!Array.isArray(snapshots)) throw new Error('The CM data has an unexpected shape.');
	const snapshot = snapshots.map(asRecord).find((s) => s?.cmId === `cm${cm.id}`);
	const title = asRecord(snapshot?.meta)?.course;
	if (!snapshot || typeof snapshot.snapshotId !== 'string' || typeof title !== 'string' || !sameCourse(title, course)) return null;
	const pairs = parseSummaryPairs(await getJson(`/snapshots/${encodeURIComponent(snapshot.snapshotId)}/summary`, signal));
	return { label: typeof snapshot.label === 'string' ? snapshot.label : snapshot.snapshotId, pairs };
}

/** The Owned versions in the data, best win rate first, each in its best running style with enough usage (else its most used). A version the field does not run is left out: the data says nothing about it. */
export function suggestViable({ pairs }: CmUsage, owned: Iterable<number>): ViableSuggestion[] {
	const field = pairs.reduce((t, p) => t + p.usage, 0);
	const average = field > 0 ? pairs.reduce((t, p) => t + p.winRate * p.usage, 0) / field : 0;
	const ownedIds = new Set(owned);
	const best = new Map<number, CmUsagePair>();
	const better = (a: CmUsagePair, b: CmUsagePair) => {
		const enough = (p: CmUsagePair) => p.usage >= MIN_USAGE;
		return enough(a) !== enough(b) ? enough(a) : enough(a) ? a.winRate > b.winRate : a.usage > b.usage;
	};
	for (const p of pairs) {
		if (!ownedIds.has(p.cardId)) continue;
		const cur = best.get(p.cardId);
		if (!cur || better(p, cur)) best.set(p.cardId, p);
	}
	return [...best.values()]
		.map((p) => ({ ...p, styleName: STYLE_NAMES[p.style] ?? `Style ${p.style}`, suggested: p.usage >= MIN_USAGE && p.winRate > average }))
		.sort((a, b) => Number(b.suggested) - Number(a.suggested) || b.winRate - a.winRate);
}
