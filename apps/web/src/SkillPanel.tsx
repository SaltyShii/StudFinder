import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import type { SkillCategory } from '../../../packages/scoring/src/skillCategory';
import type { TrackOverview as Track } from '../../../packages/scoring/src/trackOverview';
import { SkillChart, SkillFootnote } from './SkillChart';

interface Props {
	rows: AceSkillRow[];
	track: Track;
	data: GameData;
	tab: SkillCategory;
	onTab: (tab: SkillCategory) => void;
	stale?: boolean;
	/** Set for a slot that gets a heading, a test id and an empty state (the Side loop); the Ace's chart has none of them. */
	heading?: { testId: string; title: string; empty: string };
}

/** One slot's skill chart with its footnote; with a `heading` it also carries the title and says so when the slot has no skill to chart. */
export function SkillPanel({ rows, track, data, tab, onTab, stale, heading }: Props) {
	const chart = rows.length ? <>
		<SkillChart rows={rows} track={track} data={data} tab={tab} onTab={onTab} stale={stale} />
		<SkillFootnote rows={rows} />
	</> : heading && <p class="panel empty muted" data-testid={`${heading.testId}-empty`}>{heading.empty}</p>;
	if (!heading) return <>{chart}</>;
	return (
		<div data-testid={heading.testId}>
			<h4 class="chart-title">{heading.title}</h4>
			{chart}
		</div>
	);
}
