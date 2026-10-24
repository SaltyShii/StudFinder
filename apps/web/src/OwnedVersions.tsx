import { useState } from 'preact/hooks';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { CardPicker } from './CardPicker';
import { FIT_OFF, GRADE_NUMBERS, gradeLabel } from '../../../packages/scoring/src/ace';
import type { UnfitVersion } from './jobs';
import { Modal } from './Modal';

interface Props {
	data: GameData;
	owned: Set<number>;
	/** Card ids marked Viable for the selected CM; the Ace slot simulates only these when any Owned version is marked. */
	viable: number[];
	onViable: (ids: number[]) => void;
	/** Owned versions the Ace slot does not simulate for this CM, with the reason. */
	unfit: UnfitVersion[];
	/** Card ids force-enabled for the Ace despite being unfit. */
	forced: number[];
	onForce: (ids: number[]) => void;
	/** The grade (1-8) below which a version is unfit. */
	cutoff: number;
	onCutoff: (grade: number) => void;
	onChange: (ids: number[]) => void;
}

const PREVIEW = 6;

function toggleIn(list: number[], id: number): number[] {
	return list.includes(id) ? list.filter((i) => i !== id) : [...list, id];
}

/** Sidebar summary of the Owned versions; the button opens the picker popup. */
export function OwnedVersions({ data, owned, viable, onViable, unfit, forced, onForce, cutoff, onCutoff, onChange }: Props) {
	const [open, setOpen] = useState(false);
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
				{owned.size > 0 && <div data-testid="viable-versions"><h3>Viable for this CM</h3><p class="muted">With any marked, the Ace slot simulates only the marked versions and lists the rest below; with none, every owned version.</p><ul>{[...owned].map((id) => <li><label><input type="checkbox" name="viable" value={id} checked={viable.includes(id)} onChange={() => toggleViable(id)} /> {nameOf(id) || id}</label></li>)}</ul></div>}
				{unfit.length > 0 && <div data-testid="unfit-versions"><h3>Not simulated for this CM</h3><p class="muted">Tick a version to simulate it in the Ace slot anyway.</p><ul>{unfit.map(({ version, reason }) => <li><label><input type="checkbox" name="force-unfit" value={version.cardId} checked={forced.includes(version.cardId)} onChange={() => toggleForced(version.cardId)} /> {nameOf(version.cardId) || version.cardId}: {reason}</label></li>)}</ul></div>}
			</Modal>}
		</section>
	);
}
