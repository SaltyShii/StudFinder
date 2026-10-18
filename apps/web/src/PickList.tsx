import type { GameData } from '../../../packages/lineage/src/gameData';
import type { Candidate, Pick } from '../../../packages/scoring/src/recommend';

interface Props {
	title: string;
	testId: string;
	picks: Pick[] | undefined;
	candidates: Map<string, Candidate>;
	/** Picks belong to a previous job that is being replaced. */
	stale: boolean;
	data: GameData;
}

export function PickList({ title, testId, picks, candidates, stale, data }: Props) {
	return (
		<section class="panel" aria-busy={stale}>
			<h3>{title}{stale && ' (outdated, recomputing)'}</h3>
			<ol style={stale ? { opacity: 0.5 } : undefined}>
				{picks?.map((p) => (
					<li data-testid={testId}>
						<strong>{candidates.get(p.candidateId)?.name ?? p.candidateId}</strong> {p.score.toFixed(2)} <em>{p.reason}</em>
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
