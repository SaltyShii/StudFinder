import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import { STYLE_LABEL, gradeLetter } from '../../../packages/scoring/src/ace';
import type { AceVeteranScore } from '../../../packages/scoring/src/veterans';
import { SkillDetails, UmaCard } from './UmaCard';

const TOP = 5;

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
		<section class="panel" aria-busy={stale}>
			<h3>Your veterans{stale && ' (outdated, recomputing)'}</h3>
			<p>Ace veterans ranked by lengths gained for this CM. The ranking is relative only: lengths are not a win chance.</p>
			{stale && <p>Scoring{progress && ` ${progress[0]}/${progress[1]}`}... <button name="cancel-veterans" onClick={onCancel}>Cancel</button></p>}
			<ol class="cards" style={stale ? { opacity: 0.5 } : undefined}>
				{shown?.map((v) => (
					<UmaCard
						testId="veteran-card"
						cardId={v.cardId}
						name={data.cards.get(v.cardId)?.name ?? String(v.cardId)}
						best={v.gap === 0}
						headline={<><span class="big">{v.lengthsGained.toFixed(2)}</span> lengths, {v.gap === 0 ? 'best' : `${v.gap.toFixed(2)} behind best`}</>}
						chips={[STYLE_LABEL[v.style], `surface ${gradeLetter(v.aptitude.surface)}`, `distance ${gradeLetter(v.aptitude.distance)}`]}
						meta={`Rank score ${v.rankScore}, created ${v.createdAt}`}
						caveats={[...(v.assumesPosition ? ['assumes default position'] : []), ...(v.skillsNotSimulated > 0 ? [`${v.skillsNotSimulated} skills not simulated`] : [])]}
					>
						<SkillDetails detail={v.detail} data={data} note="Each value is that skill alone; they do not add up to the headline." />
					</UmaCard>
				))}
			</ol>
			{scores && scores.length > TOP && <button name="toggle-all-veterans" onClick={() => setAll(!all)}>{all ? 'Show top 5' : `Show all ${scores.length}`}</button>}
		</section>
	);
}
