import { useState } from 'preact/hooks';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { CardPicker } from './CardPicker';
import { Modal } from './Modal';

interface Props {
	data: GameData;
	/** Null is the Generic runner. */
	cardId: number | null;
	onPick: (id: number | null) => void;
}

/** The baseline everything is compared against: Generic (all A) unless a real version is picked. */
export function SimRunner({ data, cardId, onPick }: Props) {
	const [open, setOpen] = useState(false);
	const card = cardId == null ? undefined : data.cards.get(cardId);
	const pick = (id: number | null) => { onPick(id); setOpen(false); };
	return (
		<div class="sim-runner">
			<span class="muted">Sim runner</span>
			{card && <img class="portrait small" alt="" src={`${import.meta.env.BASE_URL}img/cards/${card.id}.png`} />}
			<strong>{card ? versionName(card) : 'Generic (all A)'}</strong>
			<button type="button" name="choose-sim-runner" onClick={() => setOpen(true)}>Change</button>
			{open && (
				<Modal title="Sim runner" onClose={() => setOpen(false)}>
					<button type="button" name="generic-runner" class="generic" aria-pressed={!card} onClick={() => pick(null)}>Generic (all A)</button>
					<CardPicker data={data} selected={new Set(card ? [card.id] : [])} onPick={pick} />
				</Modal>
			)}
		</div>
	);
}
