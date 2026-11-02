import { useState } from 'preact/hooks';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { CardPicker } from './CardPicker';
import { fetchCmUsage, suggestViable, type CmUsage, type ViableSuggestion } from './cmData';
import { FIT_OFF, GRADE_NUMBERS, gradeLabel } from '../../../packages/scoring/src/ace';
import type { NotSimulatedVersion } from './jobs';
import { Modal } from './Modal';

interface Props {
	data: GameData;
	owned: Set<number>;
	/** Card ids marked Viable for the selected CM; the Ace slot simulates only these when any Owned version is marked. */
	viable: number[];
	onViable: (ids: number[]) => void;
	/** Owned versions the Ace slot does not simulate for this CM, with the reason. */
	notSimulated: NotSimulatedVersion[];
	/** Card ids force-enabled for the Ace despite being unfit. */
	forced: number[];
	onForce: (ids: number[]) => void;
	/** The grade (1-8) below which a version is unfit. */
	cutoff: number;
	onCutoff: (grade: number) => void;
	onChange: (ids: number[]) => void;
	/** The selected CM and its course, to look up its usage and win rates; absent until the course is known. */
	cm?: Parameters<typeof fetchCmUsage>[0];
	course?: Parameters<typeof fetchCmUsage>[1];
	loadUsage?: typeof fetchCmUsage;
}

type Suggestions = { state: 'loading' } | { state: 'none' } | { state: 'failed'; message: string } | { state: 'ready'; usage: CmUsage; rows: ViableSuggestion[] };

const PREVIEW = 6;

function toggleIn(list: number[], id: number): number[] {
	return list.includes(id) ? list.filter((i) => i !== id) : [...list, id];
}

/** Sidebar summary of the Owned versions; the button opens the picker popup. */
export function OwnedVersions({ data, owned, viable, onViable, notSimulated, forced, onForce, cutoff, onCutoff, onChange, cm, course, loadUsage = fetchCmUsage }: Props) {
	const [open, setOpen] = useState(false);
	const [suggestions, setSuggestions] = useState<(Suggestions & { cm: unknown }) | null>(null);
	// Suggestions belong to the CM they were asked for, and the data is only ever read on this click.
	const shown = suggestions?.cm === cm ? suggestions : null;
	const suggest = () => {
		if (!cm || !course) return;
		setSuggestions({ state: 'loading', cm });
		loadUsage(cm, course).then(
			(usage) => setSuggestions(usage ? { state: 'ready', usage, rows: suggestViable(usage, owned), cm } : { state: 'none', cm }),
			(e) => setSuggestions({ state: 'failed', message: e instanceof Error ? e.message : String(e), cm }),
		);
	};
	const nameOf = (id: number) => { const card = data.cards.get(id); return card ? versionName(card) : ''; };
	const toggleForced = (id: number) => onForce(toggleIn(forced, id));
	const toggle = (id: number) => onChange(toggleIn([...owned], id));
	const toggleViable = (id: number) => onViable(toggleIn(viable, id));
	const viableCount = viable.filter((id) => owned.has(id)).length;
	return (
		<section class="panel">
			<h2>Owned versions</h2>
			<p>{owned.size} owned{viableCount > 0 && `, ${viableCount} Viable for this CM`}</p>
			<div class="chips">{[...owned].slice(0, PREVIEW).map((id) => <img class="portrait small" alt={nameOf(id)} src={`${import.meta.env.BASE_URL}img/cards/${id}.png`} />)}</div>
			<label>Unfit below <select name="fit-cutoff" value={cutoff} onChange={(e) => onCutoff(Number(e.currentTarget.value))}>
				{GRADE_NUMBERS.map((g) => <option value={g}>{gradeLabel(g)}{g === FIT_OFF ? ' (filter off)' : ''}</option>)}
			</select></label>
			<p class="muted">The Ace slot does not simulate versions whose surface or distance Aptitude is below this on the CM course.</p>
			<button type="button" name="edit-owned" onClick={() => setOpen(true)}>Edit owned versions</button>
			{open && <Modal title="Owned versions" onClose={() => setOpen(false)}><CardPicker data={data} selected={owned} onPick={toggle} count={`${owned.size} selected`} />
				{owned.size > 0 && <div data-testid="viable-versions"><h3>Viable for this CM</h3><p class="muted">With any marked, the Ace slot simulates only the marked versions and lists the rest below; with none, every owned version.</p>
					<button type="button" name="suggest-viable" disabled={!cm || !course || shown?.state === 'loading'} onClick={suggest}>{shown?.state === 'loading' ? 'Reading the CM data...' : 'Suggest from CM data'}</button>
					{shown?.state === 'none' && <p class="muted" data-testid="viable-none">The CM data has nothing on this CM yet.</p>}
					{shown?.state === 'failed' && <p role="alert">Could not read the CM data: {shown.message}</p>}
					{shown?.state === 'ready' && <div data-testid="viable-suggestions">
						<p class="muted">How your versions do in <a class="external-link" href="https://hakuraku.moe/" target="_blank" rel="noopener">Hakuraku</a>'s {shown.usage.label}, on the builds players ran. Suggested: wins more than the field. A third is average; versions the field does not run are not listed.</p>
						{shown.rows.length ? <><table class="data-table"><thead><tr><th>Version</th><th>Style</th><th class="num">Team wins</th><th class="num">Field</th></tr></thead><tbody>
							{shown.rows.map((r) => <tr data-suggested={r.suggested || undefined}><td>{nameOf(r.cardId) || r.cardId}</td><td>{r.styleName}</td><td class="num">{(r.winRate * 100).toFixed(1)}%</td><td class="num">{(r.usage * 100).toFixed(1)}%</td></tr>)}
						</tbody></table>
						<button type="button" name="mark-suggested" disabled={!shown.rows.some((r) => r.suggested)} onClick={() => onViable(shown.rows.filter((r) => r.suggested).map((r) => r.cardId))}>Mark the suggested ones Viable</button></> : <p class="muted">The field runs none of your versions.</p>}
					</div>}
					<ul>{[...owned].map((id) => <li><label><input type="checkbox" name="viable" value={id} checked={viable.includes(id)} onChange={() => toggleViable(id)} /> {nameOf(id) || id}</label></li>)}</ul></div>}
				{notSimulated.length > 0 && <div data-testid="unfit-versions"><h3>Not simulated for this CM</h3><p class="muted">Tick a version to simulate it in the Ace slot anyway.</p><ul>{notSimulated.map(({ version, reason }) => <li><label><input type="checkbox" name="force-unfit" value={version.cardId} checked={forced.includes(version.cardId)} onChange={() => toggleForced(version.cardId)} /> {nameOf(version.cardId) || version.cardId}: {reason}</label></li>)}</ul></div>}
			</Modal>}
		</section>
	);
}
