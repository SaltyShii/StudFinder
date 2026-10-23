import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { Tier } from '../../../packages/lineage/src/tiers';
import { Modal } from './Modal';

export interface SkillRow {
	id: string;
	name: string;
	tier?: Tier;
	selected: boolean;
	/** Replaces the tier badge, e.g. a tier select. */
	control?: ComponentChildren;
}

interface Props {
	title: string;
	rows: SkillRow[];
	onToggle: (id: string) => void;
	onClose: () => void;
	/** Above the search, e.g. suggestion chips. */
	head?: ComponentChildren;
	/** Accessible name of the search box. */
	searchLabel?: string;
	/** Row cap; the skill list is thousands long, the Support catalogue a few hundred. */
	maxRows?: number;
}

// shortcut: the list is capped so thousands of skills do not all render; search narrows it, raise the cap or virtualise if it hurts.
const MAX_ROWS = 200;

/** Searchable list of skills: leading check, name, tier badge; selected rows are highlighted. */
export function SkillPicker({ title, rows, onToggle, onClose, head, searchLabel = 'Search skills', maxRows = MAX_ROWS }: Props) {
	const [query, setQuery] = useState('');
	const q = query.trim().toLowerCase();
	const shown = rows.filter((r) => r.name.toLowerCase().includes(q)).slice(0, maxRows);
	return (
		<Modal title={title} onClose={onClose}>
			{head}
			<input type="search" name="skill-search" placeholder="Search..." aria-label={searchLabel} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
			<ul class="skill-rows">
				{shown.map((r) => (
					<li class={r.selected ? 'selected' : ''} data-testid="skill-row">
						<button type="button" name="skill" value={r.id} aria-pressed={r.selected} onClick={() => onToggle(r.id)}>
							<span class="check" aria-hidden="true">{r.selected ? '✓' : '+'}</span>{r.name}
						</button>
						{r.control ?? (r.tier && <span class="tier" data-tier={r.tier}>{r.tier}</span>)}
					</li>
				))}
			</ul>
		</Modal>
	);
}
