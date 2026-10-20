import { TIER_ORDER, TIERS, type Tier } from '../../../packages/lineage/src/tiers';
import type { TierList } from '../../../packages/scoring/src/shared';
import type { TierEdit } from './jobs';

interface Props {
	/** The community sheet for the Core loop style, before any edit. */
	base: TierList;
	edit: TierEdit | undefined;
	onChange: (edit: TierEdit | undefined) => void;
}

/** Move a skill to another tier or disable it; Reset to default drops the edit. */
export function TierEditor({ base, edit, onChange }: Props) {
	const moved = edit?.moved ?? {};
	const disabled = edit?.disabled ?? [];
	const names = Object.keys(base).sort((a, b) => TIER_ORDER[base[a]] - TIER_ORDER[base[b]] || a.localeCompare(b));
	return (
		<section class="panel">
			<h2>Tier list</h2>
			<button name="tier-reset" disabled={!edit} onClick={() => onChange(undefined)}>Reset to default</button>
			<ul class="tier-list">
				{names.map((n) => (
					<li>
						<label><input type="checkbox" name="tier-enabled" value={n} checked={!disabled.includes(n)} onChange={(e) => onChange({ moved, disabled: e.currentTarget.checked ? disabled.filter((d) => d !== n) : [...disabled, n] })} /> {n}</label>
						<select name="tier-of" data-skill={n} value={moved[n] ?? base[n]} onChange={(e) => onChange({ moved: { ...moved, [n]: e.currentTarget.value as Tier }, disabled })}>
							{TIERS.map((t) => <option value={t.tier}>{t.label}</option>)}
						</select>
					</li>
				))}
			</ul>
		</section>
	);
}
