import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { SupportCardData } from '../../../packages/lineage/src/types';
import { SkillPicker } from './SkillPicker';
import type { TypeMix } from '../../../packages/scoring/src/support';
import { addCard, DECK_SLOTS, MAX_LIMIT_BREAK, removeCard, setLimitBreak, setTypeCount, SUPPORT_TYPES, typeMixTotal, type ShortlistEntry, type SupportSettings as Settings } from './supportSettings';

interface Props {
	data: GameData;
	value: Settings;
	onChange: (next: Settings) => void;
	/** The Champions Meeting the Type mix is for. */
	cm: { id: number; name: string };
	/** The mix in effect for it: the player's, else the distance default. */
	typeMix: TypeMix;
}

interface ListProps {
	title: string;
	/** Used in test ids and control names. */
	slug: 'own' | 'borrowed';
	hint: string;
	data: GameData;
	list: ShortlistEntry[];
	onChange: (list: ShortlistEntry[]) => void;
}

const LEVELS = Array.from({ length: MAX_LIMIT_BREAK + 1 }, (_, i) => i);

function label(card: SupportCardData) {
	return `${card.name} ${card.title}`.trim();
}

/** One shortlist: chips with a limit break select each, and a picker over the full catalogue. */
function Shortlist({ title, slug, hint, data, list, onChange }: ListProps) {
	const [open, setOpen] = useState(false);
	const picked = new Set(list.map((e) => e.id));
	const toggle = (id: string) => onChange(picked.has(Number(id)) ? removeCard(list, Number(id)) : addCard(list, Number(id)));
	// Chosen cards first, then by name; the type and rarity in the name make them searchable ("speed", "ssr").
	const rows = [...data.supportCards.values()]
		.map((c) => ({ id: String(c.id), name: `${label(c)} (${c.type}, ${RARITY[c.rarity] ?? c.rarity})`, selected: picked.has(c.id) }))
		.sort((a, b) => Number(b.selected) - Number(a.selected) || a.name.localeCompare(b.name));
	return (
		<div data-testid={`support-${slug}`}>
			<h3>{title}</h3>
			<p class="muted">{hint}</p>
			<ul class="support-list">{list.map((e) => {
				const card = data.supportCards.get(e.id);
				const name = card ? label(card) : `Support card ${e.id}`;
				return (
					<li data-testid="support-card">
						<span>{name}{card && <span class="muted"> ({card.type})</span>}</span>
						<label>Limit break <select name={`${slug}-limit-break`} aria-label={`Limit break of ${name}`} value={e.limitBreak} onChange={(ev) => onChange(setLimitBreak(list, e.id, Number(ev.currentTarget.value)))}>
							{LEVELS.map((l) => <option value={l}>{l === MAX_LIMIT_BREAK ? `${l} (max)` : l}</option>)}
						</select></label>
						<button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(removeCard(list, e.id))}>×</button>
					</li>
				);
			})}</ul>
			<button type="button" name={`edit-support-${slug}`} onClick={() => setOpen(true)}>{list.length ? 'Edit cards' : 'Add cards'}</button>
			{open && <SkillPicker title={title.toUpperCase()} rows={rows} onToggle={toggle} onClose={() => setOpen(false)} searchLabel="Search support cards" maxRows={data.supportCards.size} />}
		</div>
	);
}

const RARITY: Record<number, string> = { 1: 'R', 2: 'SR', 3: 'SSR' };

/** The Support cards the player would consider running (own) and the Borrowed support cards they would consider, each at a limit break level. Only the Ace slot reads them. */
export function SupportSettings({ data, value, onChange, cm, typeMix }: Props) {
	if (!data.supportCards.size) return null;
	return (
		<section class="panel" data-testid="support-settings">
			<h2>Support cards</h2>
			<Shortlist title="Own support cards" slug="own" hint="Support cards you would consider running. The Ace slot picks the best Support deck from them; with none, nothing changes." data={data} list={value.own} onChange={(own) => onChange({ ...value, own })} />
			<Shortlist title="Borrowed support cards" slug="borrowed" hint="The support cards you would consider borrowing from a friend; the Support deck takes one." data={data} list={value.borrowed} onChange={(borrowed) => onChange({ ...value, borrowed })} />
			<fieldset data-testid="type-mix">
				<legend>Type mix for {cm.name}</legend>
				<p class="muted">Support cards per type over the 6 Support deck slots, the Borrowed support card included. Friend slots are hintless fillers. Empty is no constraint.</p>
				{SUPPORT_TYPES.map((t) => (
					<label>{t} <input type="number" name={`mix-${t}`} min={0} max={DECK_SLOTS} step={1} value={typeMix[t] ?? 0} onInput={(e) => {
						const n = Number(e.currentTarget.value);
						if (Number.isFinite(n)) onChange({ ...value, typeMixes: { ...value.typeMixes, [String(cm.id)]: setTypeCount(typeMix, t, n) } });
					}} /></label>
				))}
				<span data-testid="type-mix-total" class={typeMixTotal(typeMix) > DECK_SLOTS ? 'error' : 'muted'}> {typeMixTotal(typeMix)} / {DECK_SLOTS}</span>
				{typeMixTotal(typeMix) > 0 && typeMixTotal(typeMix) < DECK_SLOTS && <span class="muted"> (the other slots take the best remaining support cards)</span>}
			</fieldset>
		</section>
	);
}
