import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Candidate, CandidatePick } from '../../../packages/scoring/src/recommend';
import { SkillDetails, UmaCard } from './UmaCard';

interface Props {
	title: string;
	testId: string;
	picks: CandidatePick[] | undefined;
	candidates: Map<string, Candidate>;
	/** Candidate id (trained id) to card id, for the portrait. */
	cardIds: Map<string, number>;
	/** Picks belong to a previous job that is being replaced. */
	stale: boolean;
	data: GameData;
}

export function PickList({ title, testId, picks, candidates, cardIds, stale, data }: Props) {
	return (
		<section class="panel" aria-busy={stale}>
			<h3>{title}{stale && ' (outdated, recomputing)'}</h3>
			<ol class="cards" style={stale ? { opacity: 0.5 } : undefined}>
				{picks?.map((p) => (
					<UmaCard testId={testId} cardId={cardIds.get(p.candidateId)} name={candidates.get(p.candidateId)?.name ?? p.candidateId} headline={p.score.toFixed(2)} meta={p.reason}>
						<SkillDetails detail={p.detail} data={data} open />
					</UmaCard>
				))}
			</ol>
		</section>
	);
}
