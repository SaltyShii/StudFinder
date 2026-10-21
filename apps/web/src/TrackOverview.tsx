import type { ComponentChildren } from 'preact';
import type { TrackOverview as Track } from '../../../packages/scoring/src/trackOverview';
import { AXIS, distanceAxis } from './trackAxis';

const PHASE_LABEL = ['Early-race', 'Mid-race', 'Late-race', 'Last spurt'];
const EVENT_CLASS = { Start: 'start', 'Pace change': 'pace', 'Last-spurt kick': 'kick' } as const;
const CURVE_H = 96;
const HEIGHT_H = 40;

/** Horizontal position on the shared track axis as a percentage of the axis column, so HTML strips, SVG curves and the skill rows below all line up. */
function pct(x: number) {
	return `${(x / AXIS.viewWidth) * 100}%`;
}

/** The selected CM's course on one distance axis, as labelled rows: the Baseline runner's speed, height, slope, track (straights and corners), phase and section. Event bands (Start, Pace change, Last-spurt kick) run behind every row and the skill rows passed as children. */
export function TrackOverview({ track, stale, children }: { track: Track; stale?: boolean; children?: ComponentChildren }) {
	const { distance } = track;
	const axis = distanceAxis(distance);
	const left = (m: number) => pct(axis.x(m));
	const width = (a: number, b: number) => pct(axis.span(a, b));
	const speeds = track.curve.map((p) => p.speed);
	const lo = Math.min(...speeds);
	const hi = Math.max(...speeds);
	const y = (v: number) => CURVE_H - 6 - ((v - lo) / Math.max(hi - lo, 0.01)) * (CURVE_H - 14);
	const path = track.curve.map((p, i) => `${i ? 'L' : 'M'}${axis.x(p.pos).toFixed(1)} ${y(p.speed).toFixed(1)}`).join('');
	const hs = track.heights.map((p) => p.height);
	const hLo = Math.min(...hs);
	const hHi = Math.max(...hs);
	const hy = (v: number) => HEIGHT_H - 4 - ((v - hLo) / Math.max(hHi - hLo, 0.01)) * (HEIGHT_H - 8);
	const heightPath = track.heights.map((p, i) => `${i ? 'L' : 'M'}${axis.x(p.pos).toFixed(1)} ${hy(p.height).toFixed(1)}`).join('');
	const corners = [...track.corners].sort((a, b) => a.start - b.start);
	return (
		<section class="panel track-panel" aria-busy={stale} data-testid="track-overview">
			<h3>Track overview{stale && ' (outdated, recomputing)'}</h3>
			<div class="track-body" style={stale ? { opacity: 0.5 } : undefined}>
				<div class="bands" aria-hidden="true">
					<div class="bands-axis">
						{axis.ticks.map((m) => <i class="tick" style={{ left: left(m) }} />)}
						{track.events.map((e) => e.end > e.start && (
							<div data-testid="event-band" data-event={EVENT_CLASS[e.name]} class={`band ${EVENT_CLASS[e.name]}`} style={{ left: left(e.start), width: width(e.start, e.end) }}>
								<span>{e.name}</span>
							</div>
						))}
					</div>
				</div>
				<div class="track-row" style={{ height: CURVE_H }}>
					<div class="row-label speed-axis"><span>Speed</span><b>{hi.toFixed(1)} m/s</b><b>{lo.toFixed(1)} m/s</b></div>
					<div class="row-axis">
						<svg viewBox={`0 0 ${AXIS.viewWidth} ${CURVE_H}`} preserveAspectRatio="none" role="img" aria-label={`Track overview, ${distance} m`}>
							<line class="grid" x1={0} x2={AXIS.viewWidth} y1={y(hi)} y2={y(hi)} vector-effect="non-scaling-stroke" />
							<line class="grid" x1={0} x2={AXIS.viewWidth} y1={y(lo)} y2={y(lo)} vector-effect="non-scaling-stroke" />
							<path data-testid="speed-curve" class="curve" d={path} fill="none" vector-effect="non-scaling-stroke" />
						</svg>
					</div>
				</div>
				<div class="track-row" style={{ height: HEIGHT_H }}>
					<div class="row-label"><span>Height</span><b>{(hHi - hLo).toFixed(1)} m range</b></div>
					<div class="row-axis">
						<svg viewBox={`0 0 ${AXIS.viewWidth} ${HEIGHT_H}`} preserveAspectRatio="none" role="img" aria-label="Height profile">
							<path data-testid="height-profile" class="area" d={`${heightPath}L${axis.x(distance).toFixed(1)} ${HEIGHT_H}L${axis.x(0).toFixed(1)} ${HEIGHT_H}Z`} />
							<path class="curve height" d={heightPath} fill="none" vector-effect="non-scaling-stroke" />
						</svg>
					</div>
				</div>
				<div class="track-row strip-row">
					<div class="row-label"><span>Slope</span></div>
					<div class="row-axis">
						{track.slopes.map((s) => {
							const text = `${s.slope > 0 ? 'Uphill' : 'Downhill'} ${Math.abs(s.slope)}%`;
							return <div data-testid="slope" class={`strip ${s.slope > 0 ? 'up' : 'down'}`} title={text} style={{ left: left(s.start), width: width(s.start, s.end) }}>{text}</div>;
						})}
					</div>
				</div>
				<div class="track-row strip-row">
					<div class="row-label"><span>Track</span></div>
					<div class="row-axis">
						{track.straights.map((s) => <div data-testid="straight" class="strip straight" style={{ left: left(s.start), width: width(s.start, s.end) }}>Straight</div>)}
						{corners.map((c, i) => <div data-testid="corner" class="strip corner" style={{ left: left(c.start), width: width(c.start, c.end) }}>{`Corner ${i + 1}`}</div>)}
					</div>
				</div>
				<div class="track-row strip-row">
					<div class="row-label"><span>Phase</span></div>
					<div class="row-axis">
						{track.phases.map((p) => <div data-testid="phase" class={`strip phase phase-${p.phase}`} style={{ left: left(p.start), width: width(p.start, p.end) }}>{PHASE_LABEL[p.phase]}</div>)}
					</div>
				</div>
				<div class="track-row strip-row">
					<div class="row-label"><span>Section</span></div>
					<div class="row-axis">
						{track.sections.map((s, i) => <div data-testid="section" class={`strip section${i % 2 ? ' odd' : ''}`} title={`Section ${i + 1}`} style={{ left: left(s.start), width: width(s.start, s.end) }}>{i + 1}</div>)}
					</div>
				</div>
				<div class="track-row ruler">
					<div class="row-label"><span>Metres</span></div>
					<div class="row-axis">{axis.ticks.map((m) => <span class="tick-label" style={{ left: left(m) }}>{m}</span>)}</div>
				</div>
				<div class="track-children">{children}</div>
			</div>
		</section>
	);
}
