import type { GameData } from '../../../packages/lineage/src/gameData';
import { parseExport } from '../../../packages/lineage/src/importer';
import type { ImportResult } from '../../../packages/lineage/src/types';

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

export function clearRoster(storage: Storage): void {
	storage.removeItem(KEY);
	storage.removeItem(CM_KEY);
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
