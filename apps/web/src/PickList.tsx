import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Pick } from '../../../packages/scoring/src/recommend';
import { OwnedMark, type useOwned } from './Owned';

interface Props {
	title: string;
	testId: string;
	picks: Pick[] | undefined;
	name: (outfitId: string) => string;
	data: GameData;
	own: ReturnType<typeof useOwned>;
	isOwned: (outfitId: string) => boolean;
}

export function PickList({ title, testId, picks, name, data, own, isOwned }: Props) {
	return (
		<section>
			<h3>{title}</h3>
			<ol>
				{picks?.filter((p) => own.show(isOwned(p.outfitId))).map((p) => (
					<li data-testid={testId}>
						<strong>{name(p.outfitId)}</strong> <OwnedMark owned={isOwned(p.outfitId)} onToggle={() => own.toggle(p.outfitId, isOwned(p.outfitId))} /> {p.score.toFixed(2)} <em>{p.reason}</em>
						{p.detail.length > 0 && (
							<details>
								<summary>Skills</summary>
								<ul>{p.detail.map((d) => (
									<li>{data.skills.get(Number(d.skillId))?.name ?? d.skillId}: {d.proc.toFixed(0)}% proc, {d.lengths.median.toFixed(2)} median lengths, value {d.value.toFixed(2)}{d.assumesPosition && ' (assumes default position)'}</li>
								))}</ul>
							</details>
						)}
					</li>
				))}
			</ol>
		</section>
	);
}
