import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Outfit, Pick } from '../../../packages/scoring/src/recommend';
import { OwnedMark } from './Owned';

interface Props {
	title: string;
	testId: string;
	picks: Pick[] | undefined;
	outfits: Map<string, Outfit>;
	/** Picks belong to a previous job that is being replaced. */
	stale: boolean;
	data: GameData;
	show: (owned: boolean) => boolean;
	onToggle: (outfitId: string, owned: boolean) => void;
}

export function PickList({ title, testId, picks, outfits, stale, data, show, onToggle }: Props) {
	return (
		<section aria-busy={stale}>
			<h3>{title}{stale && ' (outdated, recomputing)'}</h3>
			<ol style={stale ? { opacity: 0.5 } : undefined}>
				{picks?.filter((p) => show(outfits.get(p.outfitId)?.owned ?? false)).map((p) => {
					const o = outfits.get(p.outfitId);
					const owned = o?.owned ?? false;
					return (
						<li data-testid={testId}>
							<strong>{o?.name ?? p.outfitId}</strong> <OwnedMark owned={owned} onToggle={() => onToggle(p.outfitId, owned)} /> {p.score.toFixed(2)} <em>{p.reason}</em>
							{p.detail.length > 0 && (
								<details>
									<summary>Skills</summary>
									<ul>{p.detail.map((d) => (
										<li>{data.skills.get(Number(d.skillId))?.name ?? d.skillId}: {d.proc.toFixed(0)}% proc, {d.lengths.median.toFixed(2)} median lengths, value {d.value.toFixed(2)}{d.assumesPosition && ' (assumes default position)'}</li>
									))}</ul>
								</details>
							)}
						</li>
					);
				})}
			</ol>
		</section>
	);
}
