import { useState } from 'preact/hooks';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';

interface Props {
	data: GameData;
	selected: Set<number>;
	onPick: (id: number) => void;
	/** Shown beside the search, e.g. how many are selected. */
	count?: string;
	/** Limits the grid to these versions; every version when absent. */
	only?: Set<number>;
	/** A number to show on each portrait; the grid then lists the highest first. */
	badgeOf?: (id: number) => number;
}

/** Searchable card-image grid of every uma version (or just `only`); click a portrait to pick it. */
export function CardPicker({ data, selected, onPick, count, only, badgeOf }: Props) {
	const [query, setQuery] = useState('');
	const q = query.trim().toLowerCase();
	const cards = [...data.cards.values()].filter((c) => (!only || only.has(c.id)) && versionName(c).toLowerCase().includes(q));
	const badges = new Map(badgeOf ? cards.map((c) => [c.id, badgeOf(c.id)]) : []);
	// Array.prototype.sort is stable, so equal badges keep the catalogue order.
	if (badgeOf) cards.sort((a, b) => badges.get(b.id)! - badges.get(a.id)!);
	return (
		<>
			<div class="picker-bar">
				<input type="search" name="card-search" placeholder="Search..." aria-label="Search versions" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
				{count && <span class="muted">{count}</span>}
			</div>
			<div class="owned-grid">
				{cards.map((c) => (
					<button type="button" name="card" value={c.id} title={versionName(c)} aria-pressed={selected.has(c.id)} onClick={() => onPick(c.id)}>
						<img class="portrait" loading="lazy" alt={versionName(c)} src={`${import.meta.env.BASE_URL}img/cards/${c.id}.png`} />
						{badgeOf && <span class="card-badge">{badges.get(c.id)}</span>}
					</button>
				))}
			</div>
		</>
	);
}
