import { DEFAULT_ASSUMPTIONS, type DuelingRates, type SimAssumptions } from '../../../packages/scoring/src/assumptions';

type Flag = 'witCheck' | 'rushed' | 'spotStruggle' | 'dueling' | 'laneMovement';

const FLAGS: { key: Flag; label: string }[] = [
	{ key: 'witCheck', label: 'Wit checks for skills' },
	{ key: 'rushed', label: 'Rushed (kakari)' },
	{ key: 'spotStruggle', label: 'Spot struggle' },
	{ key: 'dueling', label: 'Dueling' },
	{ key: 'laneMovement', label: 'Lane movement' },
];

const RATE_LABEL: Record<keyof DuelingRates, string> = { runaway: 'Runaway', frontRunner: 'Front Runner', paceChaser: 'Pace Chaser', lateSurger: 'Late Surger', endCloser: 'End Closer' };

interface Props {
	value: SimAssumptions;
	onChange: (next: SimAssumptions) => void;
}

/** The race conditions every simulated race assumes, switchable one by one. Only options the sim can honour are listed. */
export function AssumptionsPanel({ value, onChange }: Props) {
	const changed = JSON.stringify(value) !== JSON.stringify(DEFAULT_ASSUMPTIONS);
	return (
		<section class="panel sim-assumptions">
			<h2>Sim assumptions</h2>
			<p class="muted">Race conditions every score assumes; defaults follow umalator.</p>
			{FLAGS.map(({ key, label }) => (
				<label><input type="checkbox" name={key} checked={value[key]} onChange={(e) => onChange({ ...value, [key]: e.currentTarget.checked })} /> {label}</label>
			))}
			{value.dueling && (
				<fieldset>
					<legend>Dueling chance (%), unverified estimate: umalator has no such option</legend>
					{(Object.keys(RATE_LABEL) as (keyof DuelingRates)[]).map((k) => (
						<label>{RATE_LABEL[k]} <input type="number" name={`rate-${k}`} min={0} max={100} value={value.duelingRates[k]} onChange={(e) => {
							const n = Number(e.currentTarget.value);
							if (Number.isFinite(n)) onChange({ ...value, duelingRates: { ...value.duelingRates, [k]: Math.min(100, Math.max(0, n)) } });
						}} /></label>
					))}
				</fieldset>
			)}
			<button type="button" name="reset-assumptions" disabled={!changed} onClick={() => onChange(DEFAULT_ASSUMPTIONS)}>Reset to defaults</button>
		</section>
	);
}
