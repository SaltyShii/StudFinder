import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';

interface Props {
	data: GameData;
	/** Skill ids. */
	mustHaves: string[];
	/** Skill ids of the track's top simulated skills, best first. */
	suggestions: string[];
	onChange: (ids: string[]) => void;
}

const SHOWN = 8;

/** The shared Must-have skills list: search any skill, or add a suggested one in a click. */
export function MustHaves({ data, mustHaves, suggestions, onChange }: Props) {
	const [query, setQuery] = useState('');
	const nameOf = (id: string) => data.skills.get(Number(id))?.name ?? id;
	const add = (id: string) => { setQuery(''); if (!mustHaves.includes(id)) onChange([...mustHaves, id]); };
	const q = query.trim().toLowerCase();
	const results = q ? [...data.skills.values()].filter((s) => !mustHaves.includes(String(s.id)) && s.name.toLowerCase().includes(q)).slice(0, SHOWN) : [];
	return (
		<section class="panel">
			<h2>Must-have skills</h2>
			<ul>{mustHaves.map((id) => <li data-testid="must-have">{nameOf(id)} <button onClick={() => onChange(mustHaves.filter((m) => m !== id))}>remove</button></li>)}</ul>
			<input type="search" name="must-have-search" placeholder="Search a skill" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
			<div>{results.map((s) => <button data-testid="must-have-result" onClick={() => add(String(s.id))}>{s.name}</button>)}</div>
			<div>{suggestions.filter((id) => !mustHaves.includes(id)).map((id) => <button data-testid="must-have-suggestion" onClick={() => add(id)}>{nameOf(id)}</button>)}</div>
		</section>
	);
}
