import type { GameData } from '../../../packages/lineage/src/gameData';
import type { LoopPick, OwnedVersion } from '../../../packages/scoring/src/recommend';
import { nameOf, ParentCards } from './AceHero';
import { UmaCard } from './UmaCard';

interface Props {
	title: string;
	testId: string;
	picks: LoopPick[] | undefined;
	ownedVersions: OwnedVersion[];
	/** Trained id to card id, for the parents' portraits. */
	cardIds: Map<string, number>;
	stale: boolean;
	data: GameData;
}

/** A loop as full lineages: the version to train with the 2 parents to run it with, best version first. */
export function LoopSlots({ title, testId, picks, ownedVersions, cardIds, stale, data }: Props) {
	return (
		<section class="panel" aria-busy={stale}>
			<h3>{title}{stale && ' (outdated, recomputing)'}</h3>
			<div style={stale ? { opacity: 0.5 } : undefined}>
				{picks?.map((pick) => {
					const byId = new Map(ownedVersions.find((v) => v.cardId === pick.cardId)?.candidates.map((c) => [c.id, c]));
					return (
						<ol class="cards">
							<UmaCard testId={`${testId}-pick`} cardId={pick.cardId} name={nameOf(data, pick.cardId)} headline={pick.score.toFixed(2)} />
							<ParentCards parents={pick.parents} byId={byId} cardIds={cardIds} data={data} testId={testId} />
						</ol>
					);
				})}
			</div>
		</section>
	);
}
