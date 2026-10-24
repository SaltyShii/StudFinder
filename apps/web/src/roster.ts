import type { GameData } from '../../../packages/lineage/src/gameData';
import { parseExport } from '../../../packages/lineage/src/importer';
import type { ImportResult } from '../../../packages/lineage/src/types';
import type { TypeMix } from '../../../packages/scoring/src/support';
import { TIER_VALUE } from '../../../packages/lineage/src/tiers';
import { GRADE_NUMBERS, STYLES } from '../../../packages/scoring/src/ace';
import { DEFAULT_ASSUMPTIONS, DEFAULT_DUELING_RATES, type DuelingRates, type SimAssumptions } from '../../../packages/scoring/src/assumptions';
import type { TierEdits } from './jobs';
import { EMPTY_SUPPORT, isLimitBreak, isTypeMix, type ShortlistEntry, type SupportSettings } from './supportSettings';

const KEY = 'stud-finder:roster';
const CM_KEY = 'stud-finder:cm';
const BORROW_KEY = 'stud-finder:use-borrowed';
const OWNED_KEY = 'stud-finder:owned-versions';
const LOOP_KEY = 'stud-finder:loop-versions';
const FIT_CUTOFF_KEY = 'stud-finder:fit-cutoff';
const FORCED_KEY = 'stud-finder:forced-versions';
const VIABLE_KEY = 'stud-finder:viable-versions';
const MUST_HAVES_KEY = 'stud-finder:must-haves';
const TIER_EDITS_KEY = 'stud-finder:tier-edits';
const ASSUMPTIONS_KEY = 'stud-finder:sim-assumptions';
const SKILL_POINT_BUDGET_KEY = 'stud-finder:skill-point-budget';
// Bump when a stored shape changes; older saves are then rejected.
const VERSION = 1;

/** Every key clearRoster wipes; add new keys here only. The last is an earlier version's manual owned toggles, which no longer exist. */
const ALL_KEYS = [KEY, CM_KEY, BORROW_KEY, OWNED_KEY, LOOP_KEY, FIT_CUTOFF_KEY, FORCED_KEY, VIABLE_KEY, MUST_HAVES_KEY, TIER_EDITS_KEY, 'stud-finder:owned'];

function saveVersioned(storage: Storage, key: string, field: string, value: unknown): void {
	storage.setItem(key, JSON.stringify({ version: VERSION, [field]: value }));
}

/** The validated `field`, or null when absent, stale-versioned, malformed or rejected by `validate` (which returns null to reject). */
function loadVersioned<T>(storage: Storage, key: string, field: string, validate: (value: unknown) => T | null): T | null {
	try {
		const raw: unknown = JSON.parse(storage.getItem(key) ?? 'null');
		if (!raw || typeof raw !== 'object') return null;
		const body = raw as Record<string, unknown>;
		return body.version === VERSION ? validate(body[field]) : null;
	} catch {
		return null;
	}
}

/** Throws on bad JSON or a malformed export, so the caller keeps the previous Roster. */
export function importRoster(text: string, data: GameData): ImportResult {
	return parseExport(JSON.parse(text), data);
}

export function saveRoster(storage: Storage, roster: ImportResult): void {
	saveVersioned(storage, KEY, 'roster', roster);
}

export function loadRoster(storage: Storage): ImportResult | null {
	return loadVersioned(storage, KEY, 'roster', (v) => {
		const roster = v as Partial<ImportResult> | null;
		if (!roster || !Array.isArray(roster.veterans) || !Array.isArray(roster.borrowed)) return null;
		return roster.veterans.every((x) => typeof x?.trainedId === 'number' && typeof x?.cardId === 'number') ? (roster as ImportResult) : null;
	});
}

export function saveCm(storage: Storage, id: number): void {
	saveVersioned(storage, CM_KEY, 'id', id);
}

/** The stored CM override, or null when absent, stale-versioned, malformed or no longer a known preset. */
export function loadCm(storage: Storage, known: number[]): number | null {
	return loadVersioned(storage, CM_KEY, 'id', (v) => (typeof v === 'number' && known.includes(v) ? v : null));
}

export function saveUseBorrowed(storage: Storage, on: boolean): void {
	saveVersioned(storage, BORROW_KEY, 'on', on);
}

/** Whether friends' borrowed veterans are scored too; off when absent, stale-versioned or malformed. */
export function loadUseBorrowed(storage: Storage): boolean {
	return loadVersioned(storage, BORROW_KEY, 'on', (v) => (v === true ? true : null)) ?? false;
}

function numberArray(v: unknown): number[] | null {
	return Array.isArray(v) && v.every((i) => typeof i === 'number') ? (v as number[]) : null;
}

export function saveOwnedVersions(storage: Storage, ids: number[]): void {
	saveVersioned(storage, OWNED_KEY, 'ids', ids);
}

/** Card ids the player ticked, or null (use the Roster prefill) when absent, stale-versioned or malformed. */
export function loadOwnedVersions(storage: Storage): number[] | null {
	return loadVersioned(storage, OWNED_KEY, 'ids', numberArray);
}

export function saveLoopVersions(storage: Storage, ids: number[]): void {
	saveVersioned(storage, LOOP_KEY, 'ids', ids);
}

/** Card ids the player narrowed the Loop versions to, or null (every Owned version) when absent, stale-versioned or malformed. */
export function loadLoopVersions(storage: Storage): number[] | null {
	return loadVersioned(storage, LOOP_KEY, 'ids', numberArray);
}

export function saveFitCutoff(storage: Storage, grade: number): void {
	saveVersioned(storage, FIT_CUTOFF_KEY, 'grade', grade);
}

/** The Unfit version cutoff grade (1-8), or null (the default) when absent, stale-versioned or malformed. */
export function loadFitCutoff(storage: Storage): number | null {
	return loadVersioned(storage, FIT_CUTOFF_KEY, 'grade', (v) => (typeof v === 'number' && Number.isInteger(v) && GRADE_NUMBERS.includes(v) ? v : null));
}

export function saveForcedVersions(storage: Storage, ids: number[]): void {
	saveVersioned(storage, FORCED_KEY, 'ids', ids);
}

/** Card ids of Unfit versions the player force-enabled for the Ace; empty when absent, stale-versioned or malformed. */
export function loadForcedVersions(storage: Storage): number[] {
	return loadVersioned(storage, FORCED_KEY, 'ids', numberArray) ?? [];
}

export function saveMustHaves(storage: Storage, ids: string[]): void {
	saveVersioned(storage, MUST_HAVES_KEY, 'ids', ids);
}

/** Must-have skill ids; empty when absent, stale-versioned or malformed. */
export function loadMustHaves(storage: Storage): string[] {
	return loadVersioned(storage, MUST_HAVES_KEY, 'ids', (v) => (Array.isArray(v) && v.every((i) => typeof i === 'string') ? (v as string[]) : null)) ?? [];
}

export function saveTierEdits(storage: Storage, edits: TierEdits): void {
	saveVersioned(storage, TIER_EDITS_KEY, 'edits', edits);
}

/** Per-style Tier list edits; empty (the community sheet) when absent, stale-versioned or malformed. */
export function loadTierEdits(storage: Storage): TierEdits {
	return loadVersioned(storage, TIER_EDITS_KEY, 'edits', (edits) => {
		if (!edits || typeof edits !== 'object' || Array.isArray(edits)) return null;
		if (!Object.keys(edits).every((k) => (STYLES as readonly string[]).includes(k))) return null;
		const ok = Object.values(edits).every((e: { moved?: unknown; disabled?: unknown }) =>
			!!e && !!e.moved && typeof e.moved === 'object' && Object.values(e.moved).every((t) => typeof t === 'string' && t in TIER_VALUE)
			&& Array.isArray(e.disabled) && e.disabled.every((n) => typeof n === 'string'));
		return ok ? (edits as TierEdits) : null;
	}) ?? {};
}

export function saveAssumptions(storage: Storage, a: SimAssumptions): void {
	saveVersioned(storage, ASSUMPTIONS_KEY, 'assumptions', a);
}

const RATE_STYLES = Object.keys(DEFAULT_DUELING_RATES) as (keyof DuelingRates)[];
const FLAGS = (Object.keys(DEFAULT_ASSUMPTIONS) as (keyof SimAssumptions)[]).filter((k): k is Exclude<keyof SimAssumptions, 'duelingRates'> => typeof DEFAULT_ASSUMPTIONS[k] === 'boolean');

/** The stored Sim assumptions; umalator's defaults when absent, stale-versioned or malformed. Not wiped by Clear data: they are settings, not Roster data. */
export function loadAssumptions(storage: Storage): SimAssumptions {
	return loadVersioned(storage, ASSUMPTIONS_KEY, 'assumptions', (v) => {
		const a = v as Partial<SimAssumptions> | null;
		if (!a || typeof a !== 'object' || !FLAGS.every((k) => typeof a[k] === 'boolean')) return null;
		const rates = a.duelingRates as Partial<DuelingRates> | undefined;
		if (!rates || !RATE_STYLES.every((k) => typeof rates[k] === 'number' && rates[k]! >= 0 && rates[k]! <= 100)) return null;
		const out: SimAssumptions = { ...DEFAULT_ASSUMPTIONS, duelingRates: { ...DEFAULT_DUELING_RATES } };
		for (const k of FLAGS) out[k] = a[k] as boolean;
		for (const k of RATE_STYLES) out.duelingRates[k] = rates[k] as number;
		return out;
	}) ?? DEFAULT_ASSUMPTIONS;
}

export const DEFAULT_SKILL_POINT_BUDGET = 2700;

/** null is unlimited (a cleared field). Stored apart from the other settings: a saved Skill point budget never existed before, so an older save simply has none and gets the default. */
export function saveSkillPointBudget(storage: Storage, budget: number | null): void {
	saveVersioned(storage, SKILL_POINT_BUDGET_KEY, 'budget', budget);
}

/** The stored Skill point budget (null for unlimited); 2700 when absent, stale-versioned or malformed. */
export function loadSkillPointBudget(storage: Storage): number | null {
	try {
		const body = JSON.parse(storage.getItem(SKILL_POINT_BUDGET_KEY) ?? 'null');
		if (body?.version !== VERSION) return DEFAULT_SKILL_POINT_BUDGET;
		if (body.budget === null) return null;
		return typeof body.budget === 'number' && Number.isInteger(body.budget) && body.budget >= 0 ? body.budget : DEFAULT_SKILL_POINT_BUDGET;
	} catch {
		return DEFAULT_SKILL_POINT_BUDGET;
	}
}

const SUPPORT_OWN_KEY = 'stud-finder:support-own';
const SUPPORT_BORROWED_KEY = 'stud-finder:support-borrowed';
const SUPPORT_TRAININGS_KEY = 'stud-finder:support-trainings-per-card';
const SUPPORT_TYPE_MIX_KEY = 'stud-finder:support-type-mix';

/** Each field (shortlists, trainings per card, Type mixes) has its own key and nothing here bumps VERSION: a save from before Support cards simply has none. Not wiped by Clear data: they are settings, not Roster data. */
export function saveSupportSettings(storage: Storage, settings: SupportSettings): void {
	saveVersioned(storage, SUPPORT_OWN_KEY, 'list', settings.own);
	saveVersioned(storage, SUPPORT_BORROWED_KEY, 'list', settings.borrowed);
	saveVersioned(storage, SUPPORT_TRAININGS_KEY, 'count', settings.trainingsPerCard);
	saveVersioned(storage, SUPPORT_TYPE_MIX_KEY, 'mixes', settings.typeMixes);
}

function loadShortlist(storage: Storage, key: string): ShortlistEntry[] {
	return loadVersioned(storage, key, 'list', (v) => (Array.isArray(v) && v.every((e) => Number.isInteger(e?.id) && isLimitBreak(e?.limitBreak)) ? v.map((e): ShortlistEntry => ({ id: e.id, limitBreak: e.limitBreak })) : null)) ?? [];
}

/** The stored shortlists; a list that is absent, stale-versioned or malformed loads as empty. */
export function loadSupportSettings(storage: Storage): SupportSettings {
	const count = loadVersioned(storage, SUPPORT_TRAININGS_KEY, 'count', (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null));
	const mixes = loadVersioned(storage, SUPPORT_TYPE_MIX_KEY, 'mixes', (v) => (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isTypeMix) ? (v as Record<string, TypeMix>) : null));
	return { own: loadShortlist(storage, SUPPORT_OWN_KEY), borrowed: loadShortlist(storage, SUPPORT_BORROWED_KEY), trainingsPerCard: count ?? EMPTY_SUPPORT.trainingsPerCard, typeMixes: mixes ?? {} };
}

/** Viable picks, a map from CM id to card ids, under their own key; nothing here bumps VERSION, a save from before has none. */
export function saveViableVersions(storage: Storage, picks: Record<number, number[]>): void {
	saveVersioned(storage, VIABLE_KEY, 'picks', picks);
}

/** The stored Viable picks; absent, stale-versioned or malformed data loads as empty. */
export function loadViableVersions(storage: Storage): Record<number, number[]> {
	return loadVersioned(storage, VIABLE_KEY, 'picks', (v) => {
		if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
		const ok = Object.entries(v).every(([cm, ids]) => Number.isInteger(Number(cm)) && Array.isArray(ids) && ids.every((i) => Number.isInteger(i)));
		return ok ? (v as Record<number, number[]>) : null;
	}) ?? {};
}

export function clearRoster(storage: Storage): void {
	ALL_KEYS.forEach((k) => storage.removeItem(k));
}
