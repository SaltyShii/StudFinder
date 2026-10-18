import { useState } from 'preact/hooks';

export type OwnedFilter = 'all' | 'owned' | 'not-owned';
const KEY = 'stud-finder:owned';

function load(): Record<string, boolean> {
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return raw && typeof raw === 'object' ? (raw as Record<string, boolean>) : {};
	} catch {
		return {};
	}
}

/** Manual owned overrides (persisted) plus the filter; shared by every list. */
export function useOwned() {
	const [overrides, setOverrides] = useState(load);
	const [filter, setFilter] = useState<OwnedFilter>('all');
	return {
		filter, setFilter, overrides,
		toggle(id: string, now: boolean) {
			const next = { ...overrides, [id]: !now };
			localStorage.setItem(KEY, JSON.stringify(next));
			setOverrides(next);
		},
		show: (owned: boolean) => filter === 'all' || (filter === 'owned') === owned,
	};
}

export function OwnedFilterSelect({ value, onChange }: { value: OwnedFilter; onChange: (f: OwnedFilter) => void }) {
	return (
		<label>Show <select name="owned-filter" value={value} onChange={(e) => onChange(e.currentTarget.value as OwnedFilter)}>
			<option value="all">All</option><option value="owned">Owned only</option><option value="not-owned">Not owned</option>
		</select></label>
	);
}

export function OwnedMark({ owned, onToggle }: { owned: boolean; onToggle: () => void }) {
	return (
		<>
			{owned && <mark data-testid="owned-badge">Owned</mark>}{' '}
			<label>owned <input type="checkbox" name="owned-toggle" checked={owned} onChange={onToggle} /></label>
		</>
	);
}
