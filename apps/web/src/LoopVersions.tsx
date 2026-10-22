import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import { CardPicker } from './CardPicker';
import { Modal } from './Modal';

interface Props {
	data: GameData;
	/** The Owned versions: the only ones the pick can hold. */
	owned: Set<number>;
	/** The picked Loop versions. */
	picked: Set<number>;
	onChange: (ids: number[]) => void;
}

/** Sidebar summary of the Loop versions the Side loop and Core loop rank; the button opens the picker popup. */
export function LoopVersions({ data, owned, picked, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const toggle = (id: number) => onChange(picked.has(id) ? [...picked].filter((i) => i !== id) : [...picked, id]);
	return (
		<section class="panel">
			<h2>Loop versions</h2>
			<p>{picked.size} of {owned.size} loop versions</p>
			<p class="muted">Side loop and Core loop rank only these. Fewer versions run faster.</p>
			<button type="button" name="edit-loop" onClick={() => setOpen(true)}>Edit loop versions</button>
			{open && <Modal title="Loop versions" onClose={() => setOpen(false)}><CardPicker data={data} only={owned} selected={picked} onPick={toggle} count={`${picked.size} selected`} /></Modal>}
		</section>
	);
}
