import type { TrackOverview as Track } from '../../../packages/scoring/src/trackOverview';
import { AXIS, distanceAxis } from './trackAxis';

const PHASE_LABEL = ['Early-race', 'Mid-race', 'Late-race', 'Last spurt'];
const CURVE_H = 90;
const STRIP = 16;
const TOP = CURVE_H + 6;

/** The selected CM's course on a distance axis: the Baseline runner's speed curve above strips for sections, phases, straights and corners, and slopes. */
export function TrackOverview({ track, stale }: { track: Track; stale?: boolean }) {
	const { distance } = track;
	const axis = distanceAxis(distance);
	const speeds = track.curve.map((p) => p.speed);
	const lo = Math.min(...speeds);
	const hi = Math.max(...speeds);
	const y = (v: number) => CURVE_H - ((v - lo) / Math.max(hi - lo, 0.01)) * (CURVE_H - 8);
	const path = track.curve.map((p, i) => `${i ? 'L' : 'M'}${axis.x(p.pos).toFixed(1)} ${y(p.speed).toFixed(1)}`).join('');
	const row = (i: number) => TOP + i * (STRIP + 4);
	const height = row(4);
	return (
		<section class="panel" aria-busy={stale} data-testid="track-overview">
			<h3>Track overview{stale && ' (outdated, recomputing)'}</h3>
			<svg viewBox={`0 0 ${AXIS.viewWidth} ${height + 14}`} role="img" aria-label={`Track overview, ${distance} m`} style={stale ? { opacity: 0.5 } : undefined}>
				{axis.ticks.map((m) => <g><line x1={axis.x(m)} x2={axis.x(m)} y1={0} y2={height} stroke="currentColor" opacity={0.15} /><text x={axis.x(m)} y={height + 11} font-size="10" text-anchor="middle" fill="currentColor">{m}</text></g>)}
				<path data-testid="speed-curve" d={path} fill="none" stroke="currentColor" stroke-width="2" />
				{track.sections.map((s, i) => <rect data-testid="section" x={axis.x(s.start)} y={row(0)} width={axis.span(s.start, s.end)} height={STRIP} fill="currentColor" opacity={i % 2 ? 0.12 : 0.22}><title>{`Section ${i + 1}`}</title></rect>)}
				{track.phases.map((p) => <g data-testid="phase"><rect x={axis.x(p.start)} y={row(1)} width={axis.span(p.start, p.end)} height={STRIP} fill="currentColor" opacity={0.1 + p.phase * 0.08} /><text x={axis.x(p.start) + 4} y={row(1) + 12} font-size="10" fill="currentColor">{PHASE_LABEL[p.phase]}</text></g>)}
				{track.straights.map((s) => <rect data-testid="straight" x={axis.x(s.start)} y={row(2)} width={axis.span(s.start, s.end)} height={STRIP} fill="#2a9d8f" opacity={0.7}><title>Straight</title></rect>)}
				{track.corners.map((c) => <rect data-testid="corner" x={axis.x(c.start)} y={row(2)} width={axis.span(c.start, c.end)} height={STRIP} fill="#e9a23b" opacity={0.7}><title>Corner</title></rect>)}
				{track.slopes.map((s) => <rect data-testid="slope" x={axis.x(s.start)} y={row(3)} width={axis.span(s.start, s.end)} height={STRIP} fill={s.slope > 0 ? '#d1495b' : '#3d8bd1'} opacity={0.7}><title>{`${s.slope > 0 ? 'Uphill' : 'Downhill'} ${Math.abs(s.slope)}%`}</title></rect>)}
			</svg>
			<p class="muted">Speed of a neutral Baseline runner without skills. Strips: sections, phases, straights (green) and corners (orange), slopes (red uphill, blue downhill).</p>
		</section>
	);
}
