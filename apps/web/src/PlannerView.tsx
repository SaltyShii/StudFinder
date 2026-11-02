import { useEffect, useMemo, useState } from 'preact/hooks';
import { RANK_SYMBOL } from '../../../packages/lineage/src/compatibility';
import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { FactorType, type Factor, type ImportResult, type Veteran } from '../../../packages/lineage/src/types';
import { affinityIfPlaced, combinedSparks, decodeTree, encodeTree, excludedCharas, skillSparkChances, sparkSources, treeAffinity, type InheritSlot, type TreeHorse, type TreeSlot, type WhatIfTree } from '../../../packages/scoring/src/whatIf';
import { CardPicker } from './CardPicker';
import { Modal } from './Modal';
import { loadPlannerSaves, loadPlannerTree, savePlannerSaves, savePlannerTree, type PlannerSave } from './roster';
import { SkillPicker, type SkillRow } from './SkillPicker';

const SHARE_PREFIX = '#plan=';
const SLOT_LABEL: Record<TreeSlot, string> = { target: 'Target', p1: 'Parent 1', p2: 'Parent 2', p1g1: 'Grandparent 1', p1g2: 'Grandparent 2', p2g1: 'Grandparent 3', p2g2: 'Grandparent 4' };
const SOURCE_LABEL: Record<InheritSlot, string> = { p1: 'P1', p2: 'P2', p1g1: 'GP1', p1g2: 'GP2', p2g1: 'GP3', p2g2: 'GP4' };
const SPARK_KINDS: { label: string; types: FactorType[] }[] = [
	{ label: 'Blue', types: [FactorType.Stat] },
	{ label: 'Pink', types: [FactorType.Aptitude] },
	{ label: 'Green', types: [FactorType.Unique] },
	{ label: 'White', types: [FactorType.Skill, FactorType.Scenario] },
	{ label: 'Race', types: [FactorType.Race] },
];
const CHIP_KIND: Partial<Record<FactorType, string>> = { [FactorType.Stat]: 'blue', [FactorType.Aptitude]: 'pink', [FactorType.Unique]: 'green' };
function percent(p: number) {
	return `${(p * 100).toFixed(p >= 0.1 ? 0 : 1)}%`;
}

interface Props {
	data: GameData;
	roster: ImportResult | null;
}

function horseOf(member: { cardId: number; factorIds: number[]; winSaddleIds: number[] }): TreeHorse {
	return { cardId: member.cardId, factorIds: member.factorIds, winSaddleIds: member.winSaddleIds };
}

/** A veteran in a place: as a parent it brings its own recorded parents, as it does in the game. */
function placeVeteran(tree: WhatIfTree, slot: TreeSlot, veteran: Veteran): WhatIfTree {
	const next: WhatIfTree = { ...tree, [slot]: horseOf(veteran) };
	if (slot === 'p1' || slot === 'p2') {
		const [a, b] = veteran.parents;
		const g1 = `${slot}g1` as const;
		const g2 = `${slot}g2` as const;
		if (a) next[g1] = horseOf(a); else delete next[g1];
		if (b) next[g2] = horseOf(b); else delete next[g2];
	}
	return next;
}

/** The picker of one place: any version with the affinity it would give, or a veteran from the roster. */
function ChooseHorse({ data, roster, tree, slot, onPlace, onClose }: Props & { tree: WhatIfTree; slot: TreeSlot; onPlace: (tree: WhatIfTree) => void; onClose: () => void }) {
	const excluded = excludedCharas(data, tree, slot);
	const allowed = (cardId: number) => { const c = data.charaIdOfCard(cardId); return c == null || !excluded.has(c); };
	const only = useMemo(() => new Set([...data.cards.keys()].filter(allowed)), [tree, slot]);
	const veterans = slot === 'target' || !roster ? [] : [...roster.veterans, ...roster.borrowed].filter((v) => allowed(v.cardId));
	return (
		<Modal title={SLOT_LABEL[slot]} onClose={onClose}>
			{veterans.length > 0 && <details data-testid="planner-veterans" open>
				<summary>Your veterans ({veterans.length})</summary>
				<ul class="veteran-picks">{veterans.map((v) => (
					<li><button type="button" name="pick-veteran" value={v.trainedId} onClick={() => onPlace(placeVeteran(tree, slot, v))}>
						<img class="portrait small" alt="" src={`${import.meta.env.BASE_URL}img/cards/${v.cardId}.png`} />
						<span>{data.cardLabel(v.cardId)}</span>
						<span class="muted">{v.borrowed ? `borrowed from ${v.borrowed.trainerName ?? v.borrowed.trainerId}` : `Rating ${v.rankScore.toLocaleString('en-US')}`}</span>
					</button></li>
				))}</ul>
			</details>}
			<CardPicker data={data} selected={new Set(tree[slot] ? [tree[slot]!.cardId] : [])} only={only} badgeOf={(id) => affinityIfPlaced(data, tree, slot, id)} onPick={(cardId) => onPlace({ ...tree, [slot]: { cardId, factorIds: [], winSaddleIds: [] } })} />
		</Modal>
	);
}

/** The sparks a horse is planned or known to have: one star count per spark, by colour. */
function EditSparks({ data, horse, title, onChange, onClose }: { data: GameData; horse: TreeHorse; title: string; onChange: (factorIds: number[]) => void; onClose: () => void }) {
	const [kind, setKind] = useState(0);
	const groups = useMemo(() => {
		const out = new Map<number, Factor[]>();
		for (const f of data.factors.values()) out.set(f.groupId, [...(out.get(f.groupId) ?? []), f]);
		return out;
	}, [data]);
	const chosen = new Map(horse.factorIds.flatMap((id) => { const f = data.factors.get(id); return f ? [[f.groupId, f] as const] : []; }));
	const setStars = (groupId: number, factor: Factor | undefined) => {
		const rest = horse.factorIds.filter((id) => data.factors.get(id)?.groupId !== groupId);
		onChange(factor ? [...rest, factor.id] : rest);
	};
	const rows: SkillRow[] = [...groups].filter(([, fs]) => SPARK_KINDS[kind].types.includes(fs[0].type)).map(([groupId, fs]) => {
		const sorted = [...fs].sort((a, b) => a.stars - b.stars);
		const current = chosen.get(groupId);
		return {
			id: String(groupId),
			name: fs[0].name,
			selected: !!current,
			control: current && <select name="spark-stars" aria-label={`Stars of ${fs[0].name}`} value={current.id} onChange={(e) => setStars(groupId, data.factors.get(Number(e.currentTarget.value)))}>
				{sorted.map((f) => <option value={f.id}>{'★'.repeat(f.stars)}</option>)}
			</select>,
		};
	}).sort((a, b) => Number(b.selected) - Number(a.selected) || a.name.localeCompare(b.name));
	const toggle = (id: string) => {
		const groupId = Number(id);
		setStars(groupId, chosen.has(groupId) ? undefined : [...groups.get(groupId)!].sort((a, b) => a.stars - b.stars)[0]);
	};
	const head = <div class="segmented" role="group" aria-label="Spark colour">{SPARK_KINDS.map((k, i) => <button type="button" name="spark-kind" aria-pressed={i === kind} onClick={() => setKind(i)}>{k.label}</button>)}</div>;
	return <SkillPicker title={title} rows={rows} onToggle={toggle} onClose={onClose} head={head} searchLabel="Search sparks" />;
}

/** The G1 wins behind a horse's race bonuses. */
function EditWins({ data, horse, title, onChange, onClose }: { data: GameData; horse: TreeHorse; title: string; onChange: (ids: number[]) => void; onClose: () => void }) {
	const g1s = [...data.saddles.values()].filter((s) => s.type === 3);
	const seen = new Set<string>();
	const rows: SkillRow[] = g1s.map((s) => {
		// A special career version of a race has its own id and does not count as the normal one.
		const special = seen.has(s.name);
		seen.add(s.name);
		return { id: String(s.id), name: special ? `${s.name} (career version)` : s.name, selected: horse.winSaddleIds.includes(s.id) };
	});
	const toggle = (id: string) => onChange(horse.winSaddleIds.includes(Number(id)) ? horse.winSaddleIds.filter((w) => w !== Number(id)) : [...horse.winSaddleIds, Number(id)]);
	return <SkillPicker title={title} rows={rows} onToggle={toggle} onClose={onClose} searchLabel="Search G1 races" />;
}

function Node({ data, tree, slot, affinity, onChoose, onSparks, onWins, onClear }: { data: GameData; tree: WhatIfTree; slot: TreeSlot; affinity?: number; onChoose: () => void; onSparks: () => void; onWins: () => void; onClear: () => void }) {
	const horse = tree[slot];
	const card = horse && data.cards.get(horse.cardId);
	const inherits = slot !== 'target';
	const wins = horse?.winSaddleIds.filter((id) => data.saddles.get(id)?.type === 3).length ?? 0;
	return (
		<div class="plan-node" data-testid={`plan-${slot}`} data-empty={!horse || undefined}>
			<div class="plan-node-head">
				{card ? <img class="portrait" alt="" src={`${import.meta.env.BASE_URL}img/cards/${card.id}.png`} /> : <div class="portrait placeholder" />}
				<div class="plan-node-title">
					<span class="eyebrow">{SLOT_LABEL[slot]}</span>
					<strong>{card ? versionName(card) : 'Empty'}</strong>
					{horse && inherits && affinity != null && <span class="affinity" data-testid={`plan-affinity-${slot}`} title="Affinity its sparks roll with">♥ {affinity}</span>}
				</div>
			</div>
			{horse && inherits && horse.factorIds.length > 0 && <div class="chips">{horse.factorIds.map((id) => { const f = data.factors.get(id); return f && <span class={`chip chip-${CHIP_KIND[f.type] ?? 'white'}`}>{f.name} {'★'.repeat(f.stars)}</span>; })}</div>}
			<div class="plan-node-actions">
				<button type="button" name="plan-choose" onClick={onChoose}>{horse ? 'Change' : 'Choose'}</button>
				{horse && inherits && <button type="button" name="plan-sparks" onClick={onSparks}>Sparks</button>}
				{horse && inherits && <button type="button" name="plan-wins" onClick={onWins}>G1 wins{wins > 0 && ` (${wins})`}</button>}
				{horse && <button type="button" name="plan-clear" class="quiet" aria-label={`Clear ${SLOT_LABEL[slot]}`} onClick={onClear}>×</button>}
			</div>
		</div>
	);
}

/** What the tree's sparks can do: each spark by horse, each spark over the tree, and the new white sparks the trainee could generate. */
function SparkOdds({ data, tree, affinity }: { data: GameData; tree: WhatIfTree; affinity: ReturnType<typeof treeAffinity> }) {
	const [tab, setTab] = useState<'combined' | 'sources' | 'skills'>('combined');
	const [perRun, setPerRun] = useState(true);
	const sources = sparkSources(data, tree, affinity);
	const combined = combinedSparks(data, sources);
	const skills = skillSparkChances(data, tree);
	return (
		<section class="panel" data-testid="plan-odds">
			<div class="panel-head">
				<h2>Spark proc odds</h2>
				<label class="inline"><input type="checkbox" name="plan-per-run" checked={perRun} onChange={(e) => setPerRun(e.currentTarget.checked)} /> Over a whole career (2 inspirations)</label>
			</div>
			<div class="segmented" role="group" aria-label="Odds view">
				<button type="button" name="plan-tab-combined" aria-pressed={tab === 'combined'} onClick={() => setTab('combined')}>Combined</button>
				<button type="button" name="plan-tab-sources" aria-pressed={tab === 'sources'} onClick={() => setTab('sources')}>Per source</button>
				<button type="button" name="plan-tab-skills" aria-pressed={tab === 'skills'} onClick={() => setTab('skills')}>New white sparks</button>
			</div>
			{tab === 'combined' && (combined.length ? <table class="data-table" data-testid="plan-combined"><thead><tr><th>Spark</th><th>From</th><th class="num">At least 1</th><th class="num">At least 2</th><th class="num">Mean procs</th></tr></thead><tbody>
				{combined.map((c) => <tr><td>{c.name}</td><td class="muted">{c.sources.map((s) => `${SOURCE_LABEL[s.slot]} ${'★'.repeat(s.stars)}`).join(', ')}</td><td class="num">{percent(c.atLeastOne)}</td><td class="num">{percent(c.atLeastTwo)}</td><td class="num">{c.expected.toFixed(2)}</td></tr>)}
			</tbody></table> : <p class="muted">Add sparks to a parent or grandparent to see their odds.</p>)}
			{tab === 'sources' && (sources.length ? <table class="data-table" data-testid="plan-sources"><thead><tr><th>Spark</th><th>From</th><th class="num">Affinity</th><th class="num">Chance</th></tr></thead><tbody>
				{sources.map((s) => <tr><td>{s.name} {'★'.repeat(s.stars)}</td><td class="muted">{SOURCE_LABEL[s.slot]}</td><td class="num">{s.affinity}</td><td class="num">{percent(perRun ? s.perRun : s.perInspiration)}</td></tr>)}
			</tbody></table> : <p class="muted">Add sparks to a parent or grandparent to see their odds.</p>)}
			{tab === 'skills' && (skills.length ? <><table class="data-table" data-testid="plan-skills"><thead><tr><th>Skill</th><th class="num">Copies</th><th class="num">If learned</th><th class="num">If ◎</th><th class="num">If gold</th></tr></thead><tbody>
				{skills.map((s) => <tr><td>{s.name}</td><td class="num">{s.copies}</td><td class="num">{percent(s.learned)}</td><td class="num">{percent(s.upgraded)}</td><td class="num">{percent(s.gold)}</td></tr>)}
			</tbody></table><p class="muted">The chance the trainee ends her career with this white spark. An estimate fitted to Team Trials data: the game does not publish it.</p></> : <p class="muted">Add white skill sparks to a parent or grandparent to see this.</p>)}
			<p class="muted">Chance per inspiration: base odds × (1 + affinity / 100), rolled apart for every horse. A community model the game does not confirm.</p>
		</section>
	);
}

/** Plan any lineage by hand, trained or not, and see its affinity and spark odds. It ranks nothing: that is the Recommend view's job. */
export function PlannerView({ data, roster }: Props) {
	const [tree, setTree] = useState<WhatIfTree>(() => {
		const shared = location.hash.startsWith(SHARE_PREFIX) ? decodeTree(location.hash.slice(SHARE_PREFIX.length), data) : null;
		return shared ?? loadPlannerTree(localStorage, data);
	});
	const [saves, setSaves] = useState<PlannerSave[]>(() => loadPlannerSaves(localStorage, data));
	const [saveName, setSaveName] = useState('');
	const [editing, setEditing] = useState<{ kind: 'choose' | 'sparks' | 'wins'; slot: TreeSlot } | null>(null);
	useEffect(() => { savePlannerTree(localStorage, tree); }, [tree]);
	const affinity = useMemo(() => treeAffinity(data, tree), [data, tree]);
	const change = (slot: TreeSlot, part: Partial<TreeHorse>) => setTree({ ...tree, [slot]: { ...tree[slot]!, ...part } });
	const clear = (slot: TreeSlot) => { const next = { ...tree }; delete next[slot]; setTree(next); };
	const storeSaves = (next: PlannerSave[]) => { savePlannerSaves(localStorage, next); setSaves(next); };
	const shareLink = `${location.origin}${location.pathname}${SHARE_PREFIX}${encodeTree(tree)}`;
	const nodeProps = (slot: TreeSlot) => ({ data, tree, slot, affinity: slot === 'target' ? undefined : affinity.slots[slot], onChoose: () => setEditing({ kind: 'choose', slot }), onSparks: () => setEditing({ kind: 'sparks', slot }), onWins: () => setEditing({ kind: 'wins', slot }), onClear: () => clear(slot) });
	const branch = (p: 'p1' | 'p2') => (
		<div class="plan-branch">
			<Node {...nodeProps(p)} />
			<div class="plan-grandparents"><Node {...nodeProps(`${p}g1`)} /><Node {...nodeProps(`${p}g2`)} /></div>
		</div>
	);
	const horse = editing && tree[editing.slot];
	return (
		<div class="planner" data-testid="planner">
			<header class="page-head">
				<div>
					<h1>Lineage planner</h1>
					<p class="muted">Plan a lineage by hand, trained or not, and see its affinity and spark odds.</p>
				</div>
				<div class="affinity-total" data-testid="plan-total" title="Lineage total, as the game shows it"><span class="big">{RANK_SYMBOL[affinity.rank] ?? ''} {affinity.total}</span><span class="muted">affinity</span></div>
			</header>
			<section class="panel plan-tree">
				<Node {...nodeProps('target')} />
				<div class="plan-parents">{branch('p1')}{branch('p2')}</div>
			</section>
			<SparkOdds data={data} tree={tree} affinity={affinity} />
			<section class="panel" data-testid="plan-saves">
				<h2>Save and share</h2>
				<div class="row">
					<input type="text" name="plan-save-name" placeholder="Name this plan" aria-label="Plan name" value={saveName} onInput={(e) => setSaveName(e.currentTarget.value)} />
					<button type="button" name="plan-save" disabled={!saveName.trim()} onClick={() => { storeSaves([...saves.filter((s) => s.name !== saveName.trim()), { name: saveName.trim(), tree }]); setSaveName(''); }}>Save</button>
					<button type="button" name="plan-reset" onClick={() => setTree({})}>Clear all</button>
				</div>
				{saves.length > 0 && <ul class="plan-save-list">{saves.map((s) => <li><span>{s.name}</span><button type="button" name="plan-load" onClick={() => setTree(s.tree)}>Load</button><button type="button" name="plan-delete" class="quiet" aria-label={`Delete ${s.name}`} onClick={() => storeSaves(saves.filter((x) => x !== s))}>×</button></li>)}</ul>}
				<label>Share link <input type="text" name="plan-share" readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} /></label>
				<p class="muted">The link holds this tree, its sparks and wins; anyone with it can read them. Saved plans stay in this browser.</p>
			</section>
			{editing?.kind === 'choose' && <ChooseHorse data={data} roster={roster} tree={tree} slot={editing.slot} onPlace={(next) => { setTree(next); setEditing(null); }} onClose={() => setEditing(null)} />}
			{editing?.kind === 'sparks' && horse && <EditSparks data={data} horse={horse} title={`Sparks of ${SLOT_LABEL[editing.slot]}`} onChange={(factorIds) => change(editing.slot, { factorIds })} onClose={() => setEditing(null)} />}
			{editing?.kind === 'wins' && horse && <EditWins data={data} horse={horse} title={`G1 wins of ${SLOT_LABEL[editing.slot]}`} onChange={(winSaddleIds) => change(editing.slot, { winSaddleIds })} onClose={() => setEditing(null)} />}
		</div>
	);
}
