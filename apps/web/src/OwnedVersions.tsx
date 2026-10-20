import { versionName, type GameData } from '../../../packages/lineage/src/gameData';

interface Props {
	data: GameData;
	owned: Set<number>;
	onChange: (ids: number[]) => void;
}

/** Card-image grid of every uma version; ticked ones are Owned versions. */
export function OwnedVersions({ data, owned, onChange }: Props) {
	const toggle = (id: number, on: boolean) => onChange(on ? [...owned, id] : [...owned].filter((i) => i !== id));
	return (
		<section class="panel">
			<h2>Owned versions</h2>
			<div class="owned-grid">
				{[...data.cards.values()].map((c) => (
					<label title={versionName(c)}>
						<img class="portrait" loading="lazy" alt={versionName(c)} src={`${import.meta.env.BASE_URL}img/cards/${c.id}.png`} />
						<input type="checkbox" name="owned-version" value={c.id} checked={owned.has(c.id)} onChange={(e) => toggle(c.id, e.currentTarget.checked)} />
					</label>
				))}
			</div>
		</section>
	);
}
