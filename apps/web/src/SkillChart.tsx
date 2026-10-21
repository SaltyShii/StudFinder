import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import { median } from '../../../packages/scoring/src/pairedRace';
import { AXIS, distanceAxis } from './trackAxis';

const ROW_H = 22;

/** Every skill the Ace can end up with, on the Track overview's distance axis: the spread of activation spots, a bar for how far the effect lasts, and the numbers. Rows resting on the default position assumption are greyed and marked `*`. */
export function SkillChart({ rows, distance, data, parentNames, stale }: { rows: AceSkillRow[]; distance: number; data: GameData; parentNames: Map<string, string>; stale?: boolean }) {
	if (!rows.length) return null;
	const axis = distanceAxis(distance);
	return (
		<div style={stale ? { opacity: 0.5 } : undefined}>
			<ul class="skill-chart" data-testid="skill-chart">{rows.map((r) => {
				const name = data.skills.get(Number(r.skillId))?.name ?? r.skillId;
				const reach = r.spots.length ? median(r.spots.map((s) => s.end)) : r.spotSpread.median;
				return (
					<li data-testid="ace-skill-row" class={r.assumesPosition ? 'muted' : undefined} data-must-have={r.mustHave || undefined}>
						<span class="skill-name" title={name}>
							{name}{r.assumesPosition && ' *'}
							{r.parentId != null && <small class="muted"> from {parentNames.get(r.parentId) ?? r.parentId}</small>}
						</span>
						<svg viewBox={`0 0 ${AXIS.viewWidth} ${ROW_H}`} role="img" aria-label={`Activation spots of ${name}`}>
							{axis.ticks.map((m) => <line x1={axis.x(m)} x2={axis.x(m)} y1={0} y2={ROW_H} stroke="currentColor" opacity={0.12} />)}
							{r.spots.length > 0 && <>
								<rect data-testid="spot-duration" x={axis.x(r.spotSpread.median)} y={ROW_H / 2 - 2} width={Math.max(axis.span(r.spotSpread.median, reach), 1)} height={4} fill="#3d8bd1" opacity={0.7}><title>{`Effect lasts about ${r.duration.toFixed(1)} s`}</title></rect>
								<rect data-testid="spot-spread" x={axis.x(r.spotSpread.min)} y={ROW_H / 2 - 7} width={Math.max(axis.span(r.spotSpread.min, r.spotSpread.max), 2)} height={14} fill="#e9a23b" opacity={0.55}><title>{`Procs ${Math.round(r.spotSpread.min)}-${Math.round(r.spotSpread.max)} m, median ${Math.round(r.spotSpread.median)} m`}</title></rect>
								<line x1={axis.x(r.spotSpread.median)} x2={axis.x(r.spotSpread.median)} y1={2} y2={ROW_H - 2} stroke="currentColor" stroke-width="2" />
							</>}
						</svg>
						<span class="skill-nums">{r.lengths.avg.toFixed(2)} lengths gained (avg), {r.proc.toFixed(0)}% proc, {(r.inherit * 100).toFixed(0)}% inherited</span>
					</li>
				);
			})}</ul>
			{rows.some((r) => r.assumesPosition) && <p class="muted">* assumes the default position, so the sim cannot judge it fully</p>}
			<p class="muted">Orange: the activation spots across the simulated runs (line: median). Blue: how far the effect carries from there. Highlighted rows are Must-haves.</p>
		</div>
	);
}
