import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import { STYLE_LABEL } from '../../../packages/scoring/src/ace';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';

const TOP = 5;
const grade = (n: number) => 'GFEDCBAS'[n - 1] ?? 'G'; // aptitude 1 = G ... 8 = S

interface Props {
	scores: AceVeteranScore[] | null;
	progress: [number, number] | null;
	stale: boolean;
	data: GameData;
	onCancel: () => void;
}

export function VeteranList({ scores, progress, stale, data, onCancel }: Props) {
	const [all, setAll] = useState(false);
	const shown = scores && !all ? scores.slice(0, TOP) : scores;
	return (
		<section aria-busy={stale}>
			<h3>Your veterans{stale && ' (outdated, recomputing)'}</h3>
			<p>Ace veterans ranked by lengths gained for this CM. The ranking is relative only: lengths are not a win chance.</p>
			{stale && <p>Scoring{progress && ` ${progress[0]}/${progress[1]}`}... <button name="cancel-veterans" onClick={onCancel}>Cancel</button></p>}
			<ol style={stale ? { opacity: 0.5 } : undefined}>
				{shown?.map((v) => (
					<li data-testid="veteran-card">
						<strong>{data.cards.get(v.cardId)?.name ?? v.cardId}</strong> (Rank score {v.rankScore}, created {v.createdAt}) ({STYLE_LABEL[v.style]}): {v.lengthsGained.toFixed(2)} lengths, {v.gap === 0 ? 'best' : `${v.gap.toFixed(2)} behind best`}
						{v.assumesPosition && ' (assumes default position)'}
						<br />Aptitude: surface {grade(v.aptitude.surface)}, distance {grade(v.aptitude.distance)}
						{v.skillsNotSimulated > 0 && <><br />{v.skillsNotSimulated} skills not simulated</>}
						{v.detail.length > 0 && (
							<details>
								<summary>Skills</summary>
								<p>Each value is that skill alone; they do not add up to the headline.</p>
								<ul>{v.detail.map((d) => (
									<li>{data.skills.get(Number(d.skillId))?.name ?? d.skillId}: {d.proc.toFixed(0)}% proc, {d.lengths.median.toFixed(2)} median lengths, value {d.value.toFixed(2)}{d.assumesPosition && ' (assumes default position)'}</li>
								))}</ul>
							</details>
						)}
					</li>
				))}
			</ol>
			{scores && scores.length > TOP && <button name="toggle-all-veterans" onClick={() => setAll(!all)}>{all ? 'Show top 5' : `Show all ${scores.length}`}</button>}
		</section>
	);
}
