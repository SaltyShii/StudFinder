import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import { median } from '../../../packages/scoring/src/pairedRace';
import { SKILL_CATEGORIES, skillCategory, type SkillCategory } from '../../../packages/scoring/src/skillCategory';
import { AXIS, distanceAxis } from './trackAxis';

const ROW_H = 18;
const WHITE = 1;
const GOLD = 2;

function rarityOf(rarity: number | undefined): 'white' | 'gold' | 'unique' {
	if (rarity === undefined || rarity <= WHITE) return 'white';
	return rarity === GOLD ? 'gold' : 'unique';
}

/** Every skill the Ace can end up with, as a compact table under the Track overview: rarity dot, name, lengths gained, Proc %, and a bar area on the overview's distance axis (spread of activation spots, how far the effect lasts). Tabs split the skills by what they do; rows resting on the default position assumption are greyed and marked `*`. */
export function SkillChart({ rows, distance, data, stale }: { rows: AceSkillRow[]; distance: number; data: GameData; stale?: boolean }) {
	const [tab, setTab] = useState<SkillCategory>('speed');
	if (!rows.length) return null;
	const axis = distanceAxis(distance);
	const shown = rows.filter((r) => skillCategory(r.skillId) === tab).sort((a, b) => b.lengths.avg - a.lengths.avg);
	return (
		<div class="skill-table" style={stale ? { opacity: 0.5 } : undefined}>
			<div class="skill-tabs" role="tablist" data-testid="skill-tabs">
				{SKILL_CATEGORIES.map((c) => (
					<button role="tab" aria-selected={c.key === tab} class={c.key === tab ? 'active' : undefined} onClick={() => setTab(c.key)}>{c.label}</button>
				))}
			</div>
			<div class="skill-head">
				<span />
				<span>Skill</span>
				<span class="num">Lengths gained</span>
				<span class="num">Proc</span>
				<span />
			</div>
			<ul class="skill-chart" data-testid="skill-chart">
				{shown.map((r) => {
					const skill = data.skills.get(Number(r.skillId));
					const name = skill?.name ?? r.skillId;
					const reach = r.spots.length ? median(r.spots.map((s) => s.end)) : r.spotSpread.median;
					return (
						<li data-testid="ace-skill-row" class={r.assumesPosition ? 'muted' : undefined} data-must-have={r.mustHave || undefined}>
							<i class="rarity-dot" data-rarity={rarityOf(skill?.rarity)} title={`${(r.inherit * 100).toFixed(0)}% inherited`} />
							<span class="skill-name" title={name}>{name}{r.assumesPosition && ' *'}</span>
							<span class="skill-lengths num">{`${r.lengths.avg < 0 ? '-' : '+'}${Math.abs(r.lengths.avg).toFixed(2)} L`}</span>
							<span class="skill-proc num">{r.proc.toFixed(0)}%</span>
							<svg viewBox={`0 0 ${AXIS.viewWidth} ${ROW_H}`} preserveAspectRatio="none" role="img" aria-label={`Activation spots of ${name}`}>
								{axis.ticks.map((m) => <line x1={axis.x(m)} x2={axis.x(m)} y1={0} y2={ROW_H} class="grid" vector-effect="non-scaling-stroke" />)}
								{r.spots.length > 0 && <>
									<rect data-testid="spot-duration" x={axis.x(r.spotSpread.median)} y={ROW_H / 2 - 1.5} width={Math.max(axis.span(r.spotSpread.median, reach), 1)} height={3} fill="var(--downhill)" opacity={0.8}><title>{`Effect lasts about ${r.duration.toFixed(1)} s`}</title></rect>
									<rect data-testid="spot-spread" x={axis.x(r.spotSpread.min)} y={ROW_H / 2 - 5} width={Math.max(axis.span(r.spotSpread.min, r.spotSpread.max), 2)} height={10} fill="var(--accent)" opacity={0.55}><title>{`Procs ${Math.round(r.spotSpread.min)}-${Math.round(r.spotSpread.max)} m, median ${Math.round(r.spotSpread.median)} m`}</title></rect>
									<line x1={axis.x(r.spotSpread.median)} x2={axis.x(r.spotSpread.median)} y1={1} y2={ROW_H - 1} stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />
								</>}
							</svg>
						</li>
					);
				})}
				{!shown.length && <li class="empty muted">No {SKILL_CATEGORIES.find((c) => c.key === tab)!.label.toLowerCase()} skills.</li>}
			</ul>
			{rows.some((r) => r.assumesPosition) && <p class="muted">* assumes the default position, so the sim cannot judge it fully</p>}
			<p class="muted">Green: the activation spots across the simulated runs (line: median). Blue: how far the effect carries from there. Highlighted rows are Must-haves. The dot is white, gold or an inherited unique; hover it for the inherit chance.</p>
		</div>
	);
}
