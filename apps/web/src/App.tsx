import { useEffect, useMemo, useState } from 'preact/hooks';
import { GameData, loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { buildAce, defaultTargetStats, STYLES, type Category, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatePool } from '../../../packages/scoring/src/candidatePool';
import { CMS, cmPreset, pickCm } from '../../../packages/scoring/src/cm';
import type { Recommendation } from '../../../packages/scoring/src/recommend';
import { resolveTierList } from '../../../packages/lineage/src/tiers';
import type { TierList } from '../../../packages/scoring/src/shared';
import { PickList } from './PickList';
import { workerRunner, type Runner } from './job';
import { OwnedFilterSelect, useOwned } from './Owned';
import { clearRoster, importRoster, loadRoster, saveRoster } from './roster';

const PINK_GROUP: Record<Category, number> = { short: 31, mile: 32, middle: 33, long: 34 };

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
function tierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) for (const n of e.skills) list[n] ??= e.tier;
	return list;
}

const STATS = ['speed', 'stamina', 'power', 'guts', 'wisdom'] as const;

function categoryOf(distance: number): Category {
	return distance <= 1400 ? 'short' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'middle' : 'long';
}

interface Props {
	loadData?: () => Promise<GameData>;
	run?: Runner;
}

export function App({ loadData = loadGameData, run = workerRunner }: Props) {
	const [roster, setRoster] = useState<ImportResult | null>(() => loadRoster(localStorage));
	const [data, setData] = useState<GameData | null>(null);
	const [error, setError] = useState('');
	const [cmId, setCmId] = useState<number>(() => pickCm(new Date()).id);
	const [aceId, setAceId] = useState<number | null>(null);
	const [style, setStyle] = useState<Style>('senko');
	const [target, setTarget] = useState<Partial<TargetStats>>({});
	const [result, setResult] = useState<Recommendation | null>(null);
	const [busy, setBusy] = useState(false);
	const [cancel, setCancel] = useState<() => void>(() => () => {});

	useEffect(() => { loadData().then(setData, (e) => setError(String(e))); }, []);

	const own = useOwned();
	const card = data && (data.cards.get(aceId ?? -1) ?? data.cards.values().next().value);
	const cm = pickCm(new Date(), cmId);
	const course = data?.courses.get(cm.courseId);
	// The CM-relevant pink spark is the distance aptitude of the CM course (factor groups 31-34).
	const pinkGroupId = course ? PINK_GROUP[categoryOf(course.distance)] : 0;
	const pool = useMemo(
		() => (data && roster ? candidatePool(data, roster.veterans, card && { aceCardId: card.id, pinkGroupId }) : []).map((o) => ({ ...o, owned: own.overrides[o.id] ?? o.owned })),
		[data, roster, card, pinkGroupId, own.overrides],
	);
	const tierList = useMemo(() => (data ? tierListOf(data, style) : {}), [data, style]);

	useEffect(() => {
		if (!data || !card || !course || !pool.length) return;
		const ace = buildAce({
			aptitudes: card.aptitudes, style, category: categoryOf(course.distance), surface: course.ground === 2 ? 'dirt' : 'turf', target,
			uniqueSkillId: card.uniqueSkillId == null ? undefined : String(card.uniqueSkillId),
		});
		setBusy(true);
		const stop = run({ roster: { outfits: pool }, preset: cmPreset(cm, ace), tierList }, (r) => { setResult(r); setBusy(false); });
		setCancel(() => () => { stop(); setBusy(false); });
		return stop; // restart: drop the stale job when inputs change
	}, [data, pool, card, course, style, target, cmId, tierList]);

	async function onFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const d = data ?? (await loadData());
			const next = importRoster(await file.text(), d);
			saveRoster(localStorage, next);
			setData(d);
			setRoster(next);
			setError('');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err)); // previous Roster stays
		}
	}

	const name = (id: string) => pool.find((o) => o.id === id)?.name ?? id;
	const isOwned = (id: string) => pool.find((o) => o.id === id)?.owned ?? false;
	const defaults = course && defaultTargetStats(categoryOf(course.distance), style);

	return (
		<main>
			<h1>Stud Finder</h1>
			<p>Your export is read in this browser only and never sent anywhere.</p>
			<input type="file" accept=".json,application/json" onChange={onFile} />
			{error && <p role="alert">{error}</p>}
			{roster && (
				<section>
					<h2>Roster</h2>
					<p>{roster.veterans.length} veterans, {roster.borrowed.length} borrowed</p>
					<button onClick={() => { clearRoster(localStorage); setRoster(null); setResult(null); }}>Clear data</button>
				</section>
			)}
			{roster && data && (
				<section>
					<h2>Ace</h2>
					<label>CM <select name="cm" value={cmId} onChange={(e) => setCmId(Number(e.currentTarget.value))}>
						{CMS.map((c) => <option value={c.id}>{c.name} {c.date}{c.confirmed === false ? ' (predicted)' : ''}</option>)}
					</select></label>
					<label>Ace outfit <select name="ace" value={card?.id} onChange={(e) => setAceId(Number(e.currentTarget.value))}>
						{[...data.cards.values()].map((c) => <option value={c.id}>{`${c.title} ${c.name}`.trim()}</option>)}
					</select></label>
					<label>Style <select name="style" value={style} onChange={(e) => setStyle(e.currentTarget.value as Style)}>
						{STYLES.map((s) => <option>{s}</option>)}
					</select></label>
					{defaults && STATS.map((k) => (
						<label>{k} <input type="number" name={k} value={target[k] ?? defaults[k]} onChange={(e) => setTarget({ ...target, [k]: Number(e.currentTarget.value) })} /></label>
					))}
					{busy && <p>Computing... <button name="cancel" onClick={cancel}>Cancel</button></p>}
					<OwnedFilterSelect value={own.filter} onChange={own.setFilter} />
					<PickList title="Ace" testId="ace-card" picks={result?.ace} name={name} data={data} own={own} isOwned={isOwned} />
					<PickList title="Core loop" testId="core-card" picks={result?.core} name={name} data={data} own={own} isOwned={isOwned} />
					<PickList title="Side loop" testId="side-card" picks={result?.side} name={name} data={data} own={own} isOwned={isOwned} />
				</section>
			)}
		</main>
	);
}
