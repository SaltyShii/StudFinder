import { useState } from 'preact/hooks';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { CardPicker } from './CardPicker';
import { Modal } from './Modal';

interface Props {
	data: GameData;
	owned: Set<number>;
	onChange: (ids: number[]) => void;
}

const PREVIEW = 6;

/** Sidebar summary of the Owned versions; the button opens the picker popup. */
export function OwnedVersions({ data, owned, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const toggle = (id: number) => onChange(owned.has(id) ? [...owned].filter((i) => i !== id) : [...owned, id]);
	return (
		<section class="panel">
			<h2>Owned versions</h2>
			<p>{owned.size} owned</p>
			<div class="chips">{[...owned].slice(0, PREVIEW).map((id) => <img class="portrait small" alt={data.cards.get(id) ? versionName(data.cards.get(id)!) : ''} src={`${import.meta.env.BASE_URL}img/cards/${id}.png`} />)}</div>
			<button type="button" name="edit-owned" onClick={() => setOpen(true)}>Edit owned versions</button>
			{open && <Modal title="Owned versions" onClose={() => setOpen(false)}><CardPicker data={data} selected={owned} onPick={toggle} count={`${owned.size} selected`} /></Modal>}
		</section>
	);
}
