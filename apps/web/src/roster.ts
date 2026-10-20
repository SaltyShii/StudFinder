import type { GameData } from '../../../packages/lineage/src/gameData';
import { parseExport } from '../../../packages/lineage/src/importer';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { TIER_VALUE } from '../../../packages/lineage/src/tiers';
import { STYLES } from '../../../packages/scoring/src/ace';
import type { TierEdits } from './jobs';

const KEY = 'stud-finder:roster';
// Bump when the stored ImportResult shape changes; older saves are then rejected.
const VERSION = 1;

/** Throws on bad JSON or a malformed export, so the caller keeps the previous Roster. */
export function importRoster(text: string, data: GameData): ImportResult {
	return parseExport(JSON.parse(text), data);
}

export function saveRoster(storage: Storage, roster: ImportResult): void {
	storage.setItem(KEY, JSON.stringify({ version: VERSION, roster }));
}

const CM_KEY = 'stud-finder:cm';

export function saveCm(storage: Storage, id: number): void {
	storage.setItem(CM_KEY, JSON.stringify({ version: VERSION, id }));
}

/** The stored CM override, or null when absent, stale-versioned, malformed or no longer a known preset. */
export function loadCm(storage: Storage, known: number[]): number | null {
	try {
		const raw: unknown = JSON.parse(storage.getItem(CM_KEY) ?? 'null');
		const { version, id } = (raw ?? {}) as { version?: unknown; id?: unknown };
		return version === VERSION && typeof id === 'number' && known.includes(id) ? id : null;
	} catch {
		return null;
	}
}

const BORROW_KEY = 'stud-finder:use-borrowed';

export function saveUseBorrowed(storage: Storage, on: boolean): void {
	storage.setItem(BORROW_KEY, JSON.stringify({ version: VERSION, on }));
}

/** Whether friends' borrowed veterans are scored too; off when absent, stale-versioned or malformed. */
export function loadUseBorrowed(storage: Storage): boolean {
	try {
		const raw: unknown = JSON.parse(storage.getItem(BORROW_KEY) ?? 'null');
		const { version, on } = (raw ?? {}) as { version?: unknown; on?: unknown };
		return version === VERSION && on === true;
	} catch {
		return false;
	}
}

const OWNED_KEY = 'stud-finder:owned-versions';

export function saveOwnedVersions(storage: Storage, ids: number[]): void {
	storage.setItem(OWNED_KEY, JSON.stringify({ version: VERSION, ids }));
}

/** Card ids the player ticked, or null (use the Roster prefill) when absent, stale-versioned or malformed. */
export function loadOwnedVersions(storage: Storage): number[] | null {
	try {
		const raw: unknown = JSON.parse(storage.getItem(OWNED_KEY) ?? 'null');
		const { version, ids } = (raw ?? {}) as { version?: unknown; ids?: unknown };
		return version === VERSION && Array.isArray(ids) && ids.every((i) => typeof i === 'number') ? ids : null;
	} catch {
		return null;
	}
}

const MUST_HAVES_KEY = 'stud-finder:must-haves';

export function saveMustHaves(storage: Storage, ids: string[]): void {
	storage.setItem(MUST_HAVES_KEY, JSON.stringify({ version: VERSION, ids }));
}

/** Must-have skill ids; empty when absent, stale-versioned or malformed. */
export function loadMustHaves(storage: Storage): string[] {
	try {
		const raw: unknown = JSON.parse(storage.getItem(MUST_HAVES_KEY) ?? 'null');
		const { version, ids } = (raw ?? {}) as { version?: unknown; ids?: unknown };
		return version === VERSION && Array.isArray(ids) && ids.every((i) => typeof i === 'string') ? ids : [];
	} catch {
		return [];
	}
}

const TIER_EDITS_KEY = 'stud-finder:tier-edits';

export function saveTierEdits(storage: Storage, edits: TierEdits): void {
	storage.setItem(TIER_EDITS_KEY, JSON.stringify({ version: VERSION, edits }));
}

/** Per-style Tier list edits; empty (the community sheet) when absent, stale-versioned or malformed. */
export function loadTierEdits(storage: Storage): TierEdits {
	try {
		const raw: unknown = JSON.parse(storage.getItem(TIER_EDITS_KEY) ?? 'null');
		const { version, edits } = (raw ?? {}) as { version?: unknown; edits?: unknown };
		if (version !== VERSION || !edits || typeof edits !== 'object') return {};
		if (Array.isArray(edits) || !Object.keys(edits).every((k) => (STYLES as readonly string[]).includes(k))) return {};
		const ok = Object.values(edits).every((e: { moved?: unknown; disabled?: unknown }) =>
			!!e && !!e.moved && typeof e.moved === 'object' && Object.values(e.moved).every((t) => typeof t === 'string' && t in TIER_VALUE)
			&& Array.isArray(e.disabled) && e.disabled.every((n) => typeof n === 'string'));
		return ok ? (edits as TierEdits) : {};
	} catch {
		return {};
	}
}

export function clearRoster(storage: Storage): void {
	storage.removeItem(OWNED_KEY);
	storage.removeItem(KEY);
	storage.removeItem(CM_KEY);
	storage.removeItem(BORROW_KEY);
	storage.removeItem(MUST_HAVES_KEY);
	storage.removeItem(TIER_EDITS_KEY);
	storage.removeItem('stud-finder:owned'); // manual owned toggles of an earlier version, which no longer exist
}

export function loadRoster(storage: Storage): ImportResult | null {
	try {
		const raw: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
		if (!raw || typeof raw !== 'object') return null;
		const { version, roster } = raw as { version?: unknown; roster?: Partial<ImportResult> };
		if (version !== VERSION || !roster || !Array.isArray(roster.veterans) || !Array.isArray(roster.borrowed)) return null;
		const ok = roster.veterans.every((v) => typeof v?.trainedId === 'number' && typeof v?.cardId === 'number');
		return ok ? (roster as ImportResult) : null;
	} catch {
		return null;
	}
}
