import { useState } from 'preact/hooks';
import { TIER_ORDER, TIERS, type Tier } from '../../../packages/lineage/src/tiers';
import type { TierList } from '../../../packages/scoring/src/shared';
import type { TierEdit } from './jobs';
import { SkillPicker } from './SkillPicker';

interface Props {
	/** The community sheet for the Core loop style, before any edit. */
	base: TierList;
	edit: TierEdit | undefined;
	onChange: (edit: TierEdit | undefined) => void;
}

/** Popup to move a skill to another tier or disable it; Reset to default drops the edit. */
export function TierEditor({ base, edit, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const moved = edit?.moved ?? {};
	const disabled = edit?.disabled ?? [];
	const names = Object.keys(base).sort((a, b) => TIER_ORDER[base[a]] - TIER_ORDER[base[b]] || a.localeCompare(b));
	const rows = names.map((n) => ({
		id: n, name: n, selected: !disabled.includes(n),
		control: (
			<select name="tier-of" data-skill={n} aria-label={`Tier of ${n}`} value={moved[n] ?? base[n]} onChange={(e) => onChange({ moved: { ...moved, [n]: e.currentTarget.value as Tier }, disabled })}>
				{TIERS.map((t) => <option value={t.tier}>{t.tier}</option>)}
			</select>
		),
	}));
	return (
		<section class="panel">
			<h2>Tier list</h2>
			<button type="button" name="edit-tiers" onClick={() => setOpen(true)}>Edit Tier list</button>
			{open && (
				<SkillPicker title="TIER LIST" rows={rows} onClose={() => setOpen(false)}
					onToggle={(n) => onChange({ moved, disabled: disabled.includes(n) ? disabled.filter((d) => d !== n) : [...disabled, n] })}
					head={<button type="button" name="tier-reset" disabled={!edit} onClick={() => onChange(undefined)}>Reset to default</button>} />
			)}
		</section>
	);
}
