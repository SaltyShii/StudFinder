import { useState } from 'preact/hooks';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { CardPicker } from './CardPicker';
import { gradeLabel } from '../../../packages/scoring/src/ace';
import { FIT_OFF, type UnfitVersion } from './jobs';
import { Modal } from './Modal';

interface Props {
	data: GameData;
	owned: Set<number>;
	/** Owned versions the Ace slot skips for this CM, with the reason. */
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
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];

/** Sidebar summary of the Owned versions; the button opens the picker popup. */
export function OwnedVersions({ data, owned, unfit, forced, onForce, cutoff, onCutoff, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const toggle = (id: number) => onChange(owned.has(id) ? [...owned].filter((i) => i !== id) : [...owned, id]);
	return (
		<section class="panel">
			<h2>Owned versions</h2>
			<p>{owned.size} owned</p>
			<div class="chips">{[...owned].slice(0, PREVIEW).map((id) => <img class="portrait small" alt={data.cards.get(id) ? versionName(data.cards.get(id)!) : ''} src={`${import.meta.env.BASE_URL}img/cards/${id}.png`} />)}</div>
			<label>Unfit below <select name="fit-cutoff" value={cutoff} onChange={(e) => onCutoff(Number(e.currentTarget.value))}>
				{GRADES.map((g) => <option value={g}>{gradeLabel(g)}{g === FIT_OFF ? ' (filter off)' : ''}</option>)}
			</select></label>
			<p class="muted">The Ace slot skips versions whose surface or distance Aptitude is below this on the CM course.</p>
			<button type="button" name="edit-owned" onClick={() => setOpen(true)}>Edit owned versions</button>
			{open && <Modal title="Owned versions" onClose={() => setOpen(false)}><CardPicker data={data} selected={owned} onPick={toggle} count={`${owned.size} selected`} />
				{unfit.length > 0 && <div data-testid="unfit-versions"><h3>Not simulated for this CM</h3><p class="muted">Tick a version to simulate it in the Ace slot anyway.</p><ul>{unfit.map(({ version, reason }) => <li><label><input type="checkbox" name="force-unfit" value={version.cardId} checked={forced.includes(version.cardId)} onChange={() => onForce(forced.includes(version.cardId) ? forced.filter((i) => i !== version.cardId) : [...forced, version.cardId])} /> {data.cards.get(version.cardId) ? versionName(data.cards.get(version.cardId)!) : version.cardId}: {reason}</label></li>)}</ul></div>}
			</Modal>}
		</section>
	);
}
