import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import { TIER_ORDER, type Tier } from '../../../packages/lineage/src/tiers';
import type { TierList } from '../../../packages/scoring/src/shared';
import { SkillPicker } from './SkillPicker';

interface Props {
	data: GameData;
	/** Skill ids. */
	mustHaves: string[];
	/** Skill ids of the track's top simulated skills, best first. */
	suggestions: string[];
	/** For the tier badges. */
	tiers: TierList;
	onChange: (ids: string[]) => void;
}

/** The shared Must-have skills: chips in the sidebar, a picker popup to add or remove. */
export function MustHaves({ data, mustHaves, suggestions, tiers, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const nameOf = (id: string) => data.skills.get(Number(id))?.name ?? id;
	const toggle = (id: string) => onChange(mustHaves.includes(id) ? mustHaves.filter((m) => m !== id) : [...mustHaves, id]);
	const rows = [...data.skills.values()].map((s) => ({ id: String(s.id), name: s.name, tier: tiers[s.name] as Tier | undefined, selected: mustHaves.includes(String(s.id)) }));
	// Selected first, then by tier (untiered last), then name; tiered skills lead so the picker's row cap never hides them.
	const rank = (t?: Tier) => (t ? TIER_ORDER[t] : Infinity);
	rows.sort((a, b) => Number(b.selected) - Number(a.selected) || rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name));
	return (
		<section class="panel">
			<h2>Must-have skills</h2>
			<ul class="chips">{mustHaves.map((id) => <li class="chip" data-testid="must-have">{nameOf(id)} <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => toggle(id)}>×</button></li>)}</ul>
			<button type="button" name="edit-must-haves" onClick={() => setOpen(true)}>Edit must-haves</button>
			{open && (
				<SkillPicker title="MUST-HAVE SKILLS" rows={rows} onToggle={toggle} onClose={() => setOpen(false)}
					head={<div class="chips">{suggestions.filter((id) => !mustHaves.includes(id)).map((id) => <button type="button" data-testid="must-have-suggestion" onClick={() => toggle(id)}>+ {nameOf(id)}</button>)}</div>} />
			)}
		</section>
	);
}
