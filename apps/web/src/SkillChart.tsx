import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import type { TrackOverview as Track } from '../../../packages/scoring/src/trackOverview';
import { isFixedSpot, rowEffect, type EffectKind } from '../../../packages/scoring/src/density';
import { placeChips, type ChipInput, type PlacedChip } from './chips';
import { SKILL_CATEGORIES, skillCategory, type SkillCategory } from '../../../packages/scoring/src/skillCategory';
import { AXIS, distanceAxis, type DistanceAxis } from './trackAxis';
import { EventBands, pct } from './TrackOverview';

const ROW_H = 22;
// A skill whose Activation spots all fall within this share of the course is drawn as one duration block, a wider spread as a density curve.
const BLOCK_SPREAD = 0.12;
const FX_VAR: Record<EffectKind | 'neutral', string> = { accelerating: 'var(--fx-accel)', cruise: 'var(--fx-cruise)', ended: 'var(--fx-ended)', neutral: 'var(--fx-neutral)' };
const WHITE = 1;
const GOLD = 2;

function rarityOf(rarity: number | undefined): 'white' | 'gold' | 'unique' {
	if (rarity === undefined || rarity <= WHITE) return 'white';
	return rarity === GOLD ? 'gold' : 'unique';
}

function isSpeedEffect(c: SkillCategory) {
	return c === 'speed' || c === 'acceleration';
}

/** Name chips for the best skills over the track rows: green where the effect still speeds the Baseline runner up at the skill's median spot, blue where only target speed helps. */
export function skillChips(rows: AceSkillRow[], track: Track, data: GameData): PlacedChip[] {
	const items: ChipInput[] = [...rows].filter((r) => r.spots.length).sort((a, b) => b.lengths.avg - a.lengths.avg).map((r) => {
		const at = r.spotSpread.median;
		const hit = isSpeedEffect(skillCategory(r.skillId)) ? rowEffect(track.curve, r.spots, at, track.distance, at + 1).stretches.find((s) => s.start <= at + 1 && at <= s.end) : undefined;
		return { id: r.skillId, label: data.skills.get(Number(r.skillId))?.name ?? r.skillId, pos: at, kind: hit?.kind === 'accelerating' ? 'accelerating' : hit?.kind === 'cruise' ? 'cruise' : 'neutral' };
	});
	return placeChips(items, track.distance);
}

interface Props {
	rows: AceSkillRow[];
	track: Track;
	data: GameData;
	tab: SkillCategory;
	onTab: (tab: SkillCategory) => void;
	stale?: boolean;
}

/** The skills of one slot (every skill the Ace can end up with, or a Side loop lineage's Must-haves and best simulated skills), as its own panel under the Track overview: rarity dot, name, lengths gained, Proc %, and a bar area on the overview's distance axis (its Activation spots, how far the effect lasts). Tabs split the skills by what they do; rows resting on the default position assumption are greyed and marked `*`. */
export function SkillChart({ rows, track, data, tab, onTab, stale }: Props) {
	if (!rows.length) return null;
	const axis = distanceAxis(track.distance);
	const shown = rows.map((r) => ({ r, category: skillCategory(r.skillId) })).filter((x) => x.category === tab).sort((a, b) => b.r.lengths.avg - a.r.lengths.avg);
	return (
		<div class="chart-scroll" data-testid="chart-scroll">
		<section class="panel skill-panel skill-table" style={stale ? { opacity: 0.5 } : undefined}>
			<div class="skill-tabs" role="tablist" data-testid="skill-tabs">
				{SKILL_CATEGORIES.map((c) => (
					<button role="tab" aria-selected={c.key === tab} class={c.key === tab ? 'active' : undefined} onClick={() => onTab(c.key)}>{c.label}</button>
				))}
			</div>
			<div class="skill-head">
				<span />
				<span>Skill</span>
				<span class="num">Lengths gained</span>
				<span class="num">Proc</span>
				<span class="fire">Activation spots
					<ul class="rarity-legend" data-testid="rarity-legend">
						<li><i class="rarity-dot" data-rarity="white" />white</li>
						<li><i class="rarity-dot" data-rarity="gold" />gold</li>
						<li><i class="rarity-dot" data-rarity="unique" />inherited unique</li>
					</ul>
				</span>
			</div>
			<div class="skill-body">
				<EventBands track={track} axis={axis} />
				<ul class="skill-chart" data-testid="skill-chart">
					{shown.map(({ r, category }) => {
						const skill = data.skills.get(Number(r.skillId));
						const name = skill?.name ?? r.skillId;
						return (
							<li data-testid="ace-skill-row" class={r.assumesPosition ? 'muted' : undefined} data-must-have={r.mustHave || undefined}>
								<i class="rarity-dot" data-rarity={rarityOf(skill?.rarity)} title={r.own ? 'Own skill: the Ace can buy it after its run' : `${(r.inherit * 100).toFixed(0)}% inherited`} />
								<span class="skill-name" title={name}>{name}{r.assumesPosition && ' *'}</span>
								<span class="skill-lengths num">{`${r.lengths.avg < 0 ? '-' : '+'}${Math.abs(r.lengths.avg).toFixed(2)} L`}</span>
								<span class="skill-proc num">{r.proc.toFixed(0)}%</span>
								<div class="bar-area" role="img" aria-label={`Activation spots of ${name}`}>
									{r.spots.length > 0 && <SpotShape row={r} speedEffect={isSpeedEffect(category)} axis={axis} track={track} />}
								</div>
							</li>
						);
					})}
					{!shown.length && <li class="empty muted">No {SKILL_CATEGORIES.find((c) => c.key === tab)!.label.toLowerCase()} skills.</li>}
				</ul>
			</div>
		</section>
		</div>
	);
}

export function SkillFootnote({ rows }: { rows: AceSkillRow[] }) {
	return (
		<p class="muted skill-footnote" data-testid="skill-footnote">
			L = horse lengths gained at the finish · Proc = share of runs in which the skill procced · {rows.some((r) => r.assumesPosition) ? '* also needs a race position (assumed), so the sim cannot judge it fully · ' : ''}highlighted rows are Must-haves · hover a dot for its inherit chance
		</p>
	);
}

/** One skill's Activation spots, drawn by how spread out they are: a pin with a grey tail for one fixed spot, duration blocks coloured by what the effect does for the Baseline runner for a narrow window, or a density curve over a grey reach band for spread-out skills. */
function SpotShape({ row: r, speedEffect, axis, track }: { row: AceSkillRow; speedEffect: boolean; axis: DistanceAxis; track: Track }) {
	const { distance } = track;
	const { min, max, median: mid } = r.spotSpread;
	const { reach, stretches: whole } = rowEffect(track.curve, r.spots, min, distance, mid);
	const lastEnd = Math.max(...r.spots.map((s) => s.end), reach);
	const toFinish = speedEffect ? whole : [];
	const stretches = toFinish.filter((s) => s.kind !== 'ended');
	const title = `Procs ${Math.round(min)}-${Math.round(max)} m, median ${Math.round(mid)} m; effect lasts about ${r.duration.toFixed(1)} s`;
	const left = (m: number) => pct(axis.x(m));
	const box = (a: number, b: number) => ({ left: left(a), width: pct(Math.max(axis.span(a, b), 3)) });
	if (isFixedSpot(r.spotSpread)) {
		const firstKind = speedEffect ? rowEffect(track.curve, r.spots, mid, distance).stretches[0]?.kind : undefined;
		return <div data-testid="spot-pin" title={title}>
			<span class="tail" style={box(mid, lastEnd)} />
			<span class="pin" style={{ left: left(mid), background: FX_VAR[firstKind ?? 'neutral'] }} />
		</div>;
	}
	if (max - min <= distance * BLOCK_SPREAD) {
		return <div data-testid="spot-block" title={title}>
			<span class="tail" style={box(min, lastEnd)} />
			<span class="block" style={box(min, reach)}>
				{(stretches.length ? stretches : [{ start: min, end: reach, kind: 'neutral' as const }]).map((s) => <i style={{ left: `${((s.start - min) / Math.max(reach - min, 1)) * 100}%`, width: `${((s.end - s.start) / Math.max(reach - min, 1)) * 100}%`, background: FX_VAR[s.kind] }} />)}
			</span>
		</div>;
	}
	const { bins, binWidth } = r.density;
	const peak = Math.max(...bins, 1e-9);
	const top = (v: number) => ROW_H - 3 - (v / peak) * (ROW_H - 8);
	const pts = bins.map((v, i) => `${axis.x(i * binWidth + binWidth / 2).toFixed(1)} ${top(v).toFixed(1)}`);
	const areaPath = `M${axis.x(0).toFixed(1)} ${ROW_H - 3}L${pts.join('L')}L${axis.x(distance).toFixed(1)} ${ROW_H - 3}Z`;
	const gid = `fx-${r.skillId}`;
	return <div data-testid="spot-density" title={title}>
		<span class="tail" style={box(min, lastEnd)} />
		<svg viewBox={`0 0 ${AXIS.viewWidth} ${ROW_H}`} preserveAspectRatio="none" aria-hidden="true">
			{speedEffect && <defs>
				<linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={axis.x(0)} x2={axis.x(distance)} y1={0} y2={0}>
					{toFinish.flatMap((s) => [
						<stop offset={s.start / distance} stop-color={FX_VAR[s.kind]} />,
						<stop offset={s.end / distance} stop-color={FX_VAR[s.kind]} />,
					])}
				</linearGradient>
			</defs>}
			<path d={areaPath} fill={speedEffect && stretches.length ? `url(#${gid})` : FX_VAR.neutral} opacity={0.95} />
		</svg>
	</div>;
}
