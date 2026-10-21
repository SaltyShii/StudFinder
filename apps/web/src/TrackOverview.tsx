import type { TrackOverview as Track } from '../../../packages/scoring/src/trackOverview';
import { CHIP_CHARS, type PlacedChip } from './chips';
import { AXIS, coverSpans, cornerNumber, distanceAxis, rulerStep, rulerTicks, type DistanceAxis } from './trackAxis';

const PHASE_LABEL = ['Early-race', 'Mid-race', 'Late-race', 'Last spurt'];
const EVENT_CLASS = { Start: 'start', 'Pace change': 'pace', 'Last-spurt kick': 'kick' } as const;
const CURVE_H = 150;
const HEIGHT_H = 56;
const CHIP_LANE_PX = 21;
const SPEED_STEP = 2;
const SPEED_RANGE = 8;

/** Horizontal position on the shared track axis as a percentage of the axis column, so HTML strips, SVG curves and the skill rows below all line up. */
export function pct(x: number) {
	return `${(x / AXIS.viewWidth) * 100}%`;
}

const metres = (m: number) => `${Math.round(m).toLocaleString('en-US')}m`;

/** Translucent bands for the race's gear changes (Start, Pace change, Last-spurt kick). They fill their positioned parent, in the same axis column as every strip, so they run down through all rows; `labels` adds the pill names on top. */
export function EventBands({ track, axis, labels }: { track: Track; axis: DistanceAxis; labels?: boolean }) {
	return (
		<div class="bands" aria-hidden="true">
			<div class="bands-axis">
				{track.events.map((e) => e.end > e.start && (
					<div data-testid="event-band" data-event={EVENT_CLASS[e.name]} class={`band ${EVENT_CLASS[e.name]}`} style={{ left: pct(axis.x(e.start)), width: pct(axis.span(e.start, e.end)) }}>
						{labels && <span>{e.name}</span>}
					</div>
				))}
			</div>
		</div>
	);
}

/** Course facts for the left column: where the last spurt starts and how long the final straight is. */
function lastSpurtFrom(track: Track) {
	const kick = track.events.find((e) => e.name === 'Last-spurt kick');
	return kick && kick.start < track.distance ? kick.start : track.phases[3].start;
}
function finalStraight(track: Track) {
	const last = [...track.straights].sort((a, b) => a.end - b.end).pop();
	return last && last.end >= track.distance - 1 ? last.end - last.start : 0;
}

const LEGEND = [
	['line', 'speed'],
	['accelerating', 'still speeding up'],
	['landing', 'acceleration lands'],
	['cruise', 'only speed helps'],
	['ended', 'no effect'],
] as const;

/** The selected CM's course on one distance axis, as labelled rows: the Baseline runner's speed, height, slope, track (straights and corners), phase and section, then a metres ruler. Event bands run behind the rows; skill name chips sit on the phase and section rows. */
export function TrackOverview({ track, title, leftHanded, chips, stale }: { track: Track; title: string; leftHanded: boolean; chips: PlacedChip[]; stale?: boolean }) {
	const { distance } = track;
	const axis = distanceAxis(distance);
	const left = (m: number) => pct(axis.x(m));
	const width = (a: number, b: number) => pct(axis.span(a, b));
	const speeds = track.curve.map((p) => p.speed);
	const hi = Math.max(...speeds);
	// The start dash begins far below cruise speed; the axis shows the top of the range so the interesting part is not flattened.
	const lo = Math.max(Math.min(...speeds), hi - SPEED_RANGE);
	const y = (v: number) => CURVE_H - 8 - ((Math.max(v, lo) - lo) / Math.max(hi - lo, 0.01)) * (CURVE_H - 40);
	const path = track.curve.map((p, i) => `${i ? 'L' : 'M'}${axis.x(p.pos).toFixed(1)} ${y(p.speed).toFixed(1)}`).join('');
	const speedTicks: number[] = [];
	for (let v = Math.ceil(lo / SPEED_STEP) * SPEED_STEP; v <= hi; v += SPEED_STEP) speedTicks.push(v);
	const hs = track.heights.map((p) => p.height);
	const hLo = Math.min(...hs);
	const hHi = Math.max(...hs);
	const hy = (v: number) => HEIGHT_H - 14 - ((v - hLo) / Math.max(hHi - hLo, 0.01)) * (HEIGHT_H - 28);
	const heightPath = track.heights.map((p, i) => `${i ? 'L' : 'M'}${axis.x(p.pos).toFixed(1)} ${hy(p.height).toFixed(1)}`).join('');
	const corners = [...track.corners].sort((a, b) => a.start - b.start);
	const cornerAt = new Map(corners.map((c, i) => [c.start, cornerNumber(i, corners.length)]));
	const tiled = coverSpans([...track.straights.map((s) => ({ ...s, corner: false })), ...corners.map((c) => ({ ...c, corner: true }))], distance);
	const step = rulerStep(distance);
	const finalLen = finalStraight(track);
	return (
		<section class="panel track-panel" aria-busy={stale} data-testid="track-overview">
			<h3 class="course-title" data-testid="course-title">{title}{stale && ' (outdated, recomputing)'}</h3>
			<div class="track-body" style={stale ? { opacity: 0.5 } : undefined}>
				<div class="track-rows">
					<EventBands track={track} axis={axis} labels />
					<div class="track-row" style={{ height: CURVE_H }}>
						<div class="row-label speed-axis">
							<div class="spurt-info">
								<b>Last spurt from {metres(lastSpurtFrom(track))}</b>
								{finalLen > 0 && <b>Final straight {metres(finalLen)}</b>}
							</div>
							<ul class="fx-legend" data-testid="fx-legend">
								{LEGEND.map(([k, text]) => <li><i class={`swatch ${k}`} />{text}</li>)}
							</ul>
							<span class="unit">m/s</span>
							{speedTicks.map((v) => <b class="y-tick" style={{ top: `${(y(v) / CURVE_H) * 100}%` }}>{v}</b>)}
						</div>
						<div class="row-axis">
							<svg viewBox={`0 0 ${AXIS.viewWidth} ${CURVE_H}`} preserveAspectRatio="none" role="img" aria-label={`Track overview, ${distance} m`}>
								{speedTicks.map((v) => <line class="grid" x1={0} x2={AXIS.viewWidth} y1={y(v)} y2={y(v)} vector-effect="non-scaling-stroke" />)}
								<path data-testid="speed-curve" class="curve" d={path} fill="none" vector-effect="non-scaling-stroke" />
							</svg>
						</div>
					</div>
					<div class="track-row" style={{ height: HEIGHT_H }}>
						<div class="row-label"><span>height</span></div>
						<div class="row-axis">
							<svg viewBox={`0 0 ${AXIS.viewWidth} ${HEIGHT_H}`} preserveAspectRatio="none" role="img" aria-label="Height profile">
								<path data-testid="height-profile" class="area" d={`${heightPath}L${axis.x(distance).toFixed(1)} ${HEIGHT_H}L${axis.x(0).toFixed(1)} ${HEIGHT_H}Z`} />
								<rect class="area-base" x={axis.x(0)} y={HEIGHT_H - 9} width={AXIS.width} height={9} />
							</svg>
							{track.slopes.map((s) => <span class="slope-pct" style={{ left: left((s.start + s.end) / 2) }}>{Math.abs(s.slope)}%</span>)}
						</div>
					</div>
					<div class="track-row strip-row">
						<div class="row-label"><span>slope</span></div>
						<div class="row-axis">
							{coverSpans(track.slopes, distance).map((c) => {
								const text = c.item ? (c.item.slope > 0 ? 'Uphill ↗' : 'Downhill ↘') : '';
								return (
									<div data-testid={c.item ? 'slope' : undefined} class={`strip ${c.item ? (c.item.slope > 0 ? 'up' : 'down') : 'flat'}`} title={c.item ? `${text} ${Math.abs(c.item.slope)}%` : undefined} style={{ left: left(c.start), width: width(c.start, c.end) }}>
										{text}{c.end < distance && <em>{metres(c.end)}</em>}
									</div>
								);
							})}
						</div>
					</div>
					<div class="track-row strip-row">
						<div class="row-label"><span>track</span></div>
						<div class="row-axis">
							{tiled.map((c) => (
								<div data-testid={c.item ? (c.item.corner ? 'corner' : 'straight') : undefined} class={`strip ${c.item?.corner ? 'corner' : 'straight'}`} style={{ left: left(c.start), width: width(c.start, c.end) }}>
									{c.item?.corner ? `Corner ${leftHanded ? '↺' : '↻'}${cornerAt.get(c.start)}` : 'Straight →'}{c.end < distance && <em>{metres(c.end)}</em>}
								</div>
							))}
						</div>
					</div>
					<div class="track-row strip-row">
						<div class="row-label"><span>phase</span></div>
						<div class="row-axis">
							{track.phases.map((p) => <div data-testid="phase" class={`strip phase phase-${p.phase}`} style={{ left: left(p.start), width: width(p.start, p.end) }}>{PHASE_LABEL[p.phase]}{p.end < distance && <em>{metres(p.end)}</em>}</div>)}
						</div>
					</div>
					<div class="track-row strip-row section-row">
						<div class="row-label"><span>section</span></div>
						<div class="row-axis">
							{track.sections.map((s, i) => <div data-testid="section" class="strip section" title={`Section ${i + 1}`} style={{ left: left(s.start), width: width(s.start, s.end) }}>{i + 1}</div>)}
							<div class="chip-layer" data-testid="skill-chips">
								{chips.map((c) => (
									<span class={`skill-name-chip ${c.kind}`} data-testid="skill-chip" style={{ left: left(c.at), bottom: 3 + c.lane * CHIP_LANE_PX }} title={c.label}>{c.label.length > CHIP_CHARS ? `${c.label.slice(0, CHIP_CHARS - 1)}…` : c.label}</span>
								))}
							</div>
						</div>
					</div>
				</div>
				<div class="track-row ruler">
					<div class="row-label"><span>metres</span></div>
					<div class="row-axis">
						{Array.from({ length: Math.floor(distance / (step / 5)) + 1 }, (_, i) => i * (step / 5)).map((m) => <i class={m % step ? 'minor' : 'major'} style={{ left: left(m) }} />)}
						{rulerTicks(distance).map((m) => <span class="tick-label" style={{ left: left(m) }}>{m.toLocaleString('en-US')}</span>)}
					</div>
				</div>
			</div>
		</section>
	);
}
