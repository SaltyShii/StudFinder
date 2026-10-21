import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import { median } from '../../../packages/scoring/src/pairedRace';
import type { TrackOverview as Track } from '../../../packages/scoring/src/trackOverview';
import { effectStretches, isFixedSpot, type EffectKind } from '../../../packages/scoring/src/density';
import { placeChips } from './chips';
import { SKILL_CATEGORIES, skillCategory, type SkillCategory } from '../../../packages/scoring/src/skillCategory';
import { AXIS, distanceAxis, type DistanceAxis } from './trackAxis';

const ROW_H = 18;
const FX_VAR: Record<EffectKind | 'neutral', string> = { accelerating: 'var(--fx-accel)', cruise: 'var(--fx-cruise)', ended: 'var(--fx-ended)', neutral: 'var(--fx-neutral)' };
const WHITE = 1;
const GOLD = 2;

function rarityOf(rarity: number | undefined): 'white' | 'gold' | 'unique' {
	if (rarity === undefined || rarity <= WHITE) return 'white';
	return rarity === GOLD ? 'gold' : 'unique';
}

/** Every skill the Ace can end up with, as a compact table under the Track overview: rarity dot, name, lengths gained, Proc %, and a bar area on the overview's distance axis (spread of activation spots, how far the effect lasts). Tabs split the skills by what they do; rows resting on the default position assumption are greyed and marked `*`. */
export function SkillChart({ rows, track, data, stale }: { rows: AceSkillRow[]; track: Track; data: GameData; stale?: boolean }) {
	const [tab, setTab] = useState<SkillCategory>('speed');
	if (!rows.length) return null;
	const { distance } = track;
	const axis = distanceAxis(distance);
	const chips = placeChips(
		[...rows].filter((r) => r.spots.length).sort((a, b) => b.lengths.avg - a.lengths.avg).map((r) => ({ id: r.skillId, label: data.skills.get(Number(r.skillId))?.name ?? r.skillId, pos: r.spotSpread.median })),
		distance,
	);
	const shown = rows.filter((r) => skillCategory(r.skillId) === tab).sort((a, b) => b.lengths.avg - a.lengths.avg);
	return (
		<div class="skill-table" style={stale ? { opacity: 0.5 } : undefined}>
			<div class="skill-chips" data-testid="skill-chips" style={{ height: 24 * (1 + Math.max(0, ...chips.map((c) => c.lane))) }}>
				{chips.map((c) => <span class="skill-name-chip" data-testid="skill-chip" style={{ left: `${(axis.x(c.at) / AXIS.viewWidth) * 100}%`, bottom: c.lane * 24 }} title={c.label}>{c.label}</span>)}
			</div>
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
					const speedEffect = isSpeedEffect(skillCategory(r.skillId));
					return (
						<li data-testid="ace-skill-row" class={r.assumesPosition ? 'muted' : undefined} data-must-have={r.mustHave || undefined}>
							<i class="rarity-dot" data-rarity={rarityOf(skill?.rarity)} title={`${(r.inherit * 100).toFixed(0)}% inherited`} />
							<span class="skill-name" title={name}>{name}{r.assumesPosition && ' *'}</span>
							<span class="skill-lengths num">{`${r.lengths.avg < 0 ? '-' : '+'}${Math.abs(r.lengths.avg).toFixed(2)} L`}</span>
							<span class="skill-proc num">{r.proc.toFixed(0)}%</span>
							<svg viewBox={`0 0 ${AXIS.viewWidth} ${ROW_H}`} preserveAspectRatio="none" role="img" aria-label={`Activation spots of ${name}`}>
								{axis.ticks.map((m) => <line x1={axis.x(m)} x2={axis.x(m)} y1={0} y2={ROW_H} class="grid" vector-effect="non-scaling-stroke" />)}
								{r.spots.length > 0 && <SpotShape row={r} speedEffect={speedEffect} axis={axis} track={track} />}
							</svg>
						</li>
					);
				})}
				{!shown.length && <li class="empty muted">No {SKILL_CATEGORIES.find((c) => c.key === tab)!.label.toLowerCase()} skills.</li>}
			</ul>
			{rows.some((r) => r.assumesPosition) && <p class="muted">* assumes the default position, so the sim cannot judge it fully</p>}
			<ul class="fx-legend" data-testid="fx-legend">
				<li><i class="swatch accelerating" />Runner still accelerating: acceleration and speed both help</li>
				<li><i class="swatch cruise" />At cruise speed: only target speed helps</li>
				<li><i class="swatch ended" />Effect has ended</li>
				<li><i class="swatch neutral" />No speed effect</li>
			</ul>
			<p class="muted">Curves show where the skill fires across the simulated runs. Highlighted rows are Must-haves. The dot is white, gold or an inherited unique; hover it for the inherit chance.</p>
		</div>
	);
}

function isSpeedEffect(c: SkillCategory) {
	return c === 'speed' || c === 'acceleration';
}

/** One skill's Activation spots: a density curve filled by what the effect does for the Baseline runner there, or a pin with a grey tail when it fires at one fixed spot. */
function SpotShape({ row: r, speedEffect, axis, track }: { row: AceSkillRow; speedEffect: boolean; axis: DistanceAxis; track: Track }) {
	const { distance } = track;
	const reach = median(r.spots.map((s) => s.end));
	const stretches = speedEffect ? effectStretches(track.curve, r.spotSpread.min, reach, distance) : [];
	const fixed = isFixedSpot(r.spotSpread);
	const title = `Procs ${Math.round(r.spotSpread.min)}-${Math.round(r.spotSpread.max)} m, median ${Math.round(r.spotSpread.median)} m; effect lasts about ${r.duration.toFixed(1)} s`;
	if (fixed) {
		const x = axis.x(r.spotSpread.median);
		const first = stretches[0]?.kind;
		return <g data-testid="spot-pin">
			<title>{title}</title>
			<rect x={x} y={ROW_H / 2 - 1.5} width={Math.max(axis.span(r.spotSpread.median, reach), 1)} height={3} fill={FX_VAR.ended} opacity={0.8} />
			<line x1={x} x2={x} y1={1} y2={ROW_H - 1} stroke={FX_VAR[speedEffect && first ? first : 'neutral']} stroke-width="2.5" vector-effect="non-scaling-stroke" />
			<circle cx={x} cy={3} r={2.5} fill={FX_VAR[speedEffect && first ? first : 'neutral']} />
		</g>;
	}
	const { bins, binWidth } = r.density;
	const peak = Math.max(...bins, 1e-9);
	const top = (v: number) => ROW_H - 1 - (v / peak) * (ROW_H - 4);
	const pts = bins.map((v, i) => `${axis.x(i * binWidth + binWidth / 2).toFixed(1)} ${top(v).toFixed(1)}`);
	const d = `M${axis.x(0).toFixed(1)} ${ROW_H - 1}L${pts.join('L')}L${axis.x(distance).toFixed(1)} ${ROW_H - 1}Z`;
	const gid = `fx-${r.skillId}`;
	return <g data-testid="spot-density">
		<title>{title}</title>
		{speedEffect && <defs>
			<linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={axis.x(0)} x2={axis.x(distance)} y1={0} y2={0}>
				{stretches.flatMap((s) => [
					<stop offset={s.start / distance} stop-color={FX_VAR[s.kind]} />,
					<stop offset={s.end / distance} stop-color={FX_VAR[s.kind]} />,
				])}
			</linearGradient>
		</defs>}
		<path d={d} fill={speedEffect && stretches.length ? `url(#${gid})` : FX_VAR.neutral} opacity={0.9} />
		<line x1={axis.x(r.spotSpread.median)} x2={axis.x(r.spotSpread.median)} y1={1} y2={ROW_H - 1} stroke="currentColor" stroke-width="1" opacity={0.6} vector-effect="non-scaling-stroke" />
	</g>;
}
