import { useEffect, useMemo, useState } from 'preact/hooks';
import { GameData, loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { buildAce, categoryOf, defaultTargetStats, PINK_GROUP, STYLE_LABEL, STYLES, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatePool } from '../../../packages/scoring/src/candidatePool';
import { CMS, cmPreset, pickCm } from '../../../packages/scoring/src/cm';
import { resolveTierList } from '../../../packages/lineage/src/tiers';
import type { TierList } from '../../../packages/scoring/src/shared';
import { formatAge } from './age';
import { PickList } from './PickList';
import type { Job, Runner, VeteranJob, VeteranRunner } from './job';
import { recommendRunner, veteranRunner } from './runners';
import { useJob } from './useJob';
import { VeteranList } from './VeteranList';
import { OwnedFilterSelect, useOwned } from './Owned';
import { clearRoster, importRoster, loadCm, loadRoster, saveCm, saveRoster } from './roster';

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
function tierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) for (const n of e.skills) list[n] ??= e.tier;
	return list;
}

const STATS = ['speed', 'stamina', 'power', 'guts', 'wisdom'] as const;

interface Props {
	loadData?: () => Promise<GameData>;
	run?: Runner;
	runVeterans?: VeteranRunner;
}

export function App({ loadData = loadGameData, run = recommendRunner, runVeterans = veteranRunner }: Props) {
	const [roster, setRoster] = useState<ImportResult | null>(() => loadRoster(localStorage));
	const [data, setData] = useState<GameData | null>(null);
	const [error, setError] = useState('');
	const [cmId, setCmId] = useState<number>(() => loadCm(localStorage, CMS.map((c) => c.id)) ?? pickCm(new Date()).id);
	const [aceId, setAceId] = useState<number | null>(null);
	const [style, setStyle] = useState<Style>('senko');
	const [target, setTarget] = useState<Partial<TargetStats>>({});

	useEffect(() => { loadData().then(setData, (e) => setError(String(e))); }, []);

	const own = useOwned();
	const card = data && aceId != null ? data.cards.get(aceId) : undefined;
	const cm = pickCm(new Date(), cmId);
	const course = data?.courses.get(cm.courseId);
	// The CM-relevant pink spark is the distance aptitude of the CM course (factor groups 31-34).
	const pinkGroupId = course ? PINK_GROUP[categoryOf(course.distance)] : 0;
	const pool = useMemo(
		() => (data && roster && card ? candidatePool(data, roster.veterans, { aceCardId: card.id, pinkGroupId }) : []).map((o) => ({ ...o, owned: own.overrides[o.id] ?? o.owned })),
		[data, roster, card, pinkGroupId, own.overrides],
	);
	const tierList = useMemo(() => (data ? tierListOf(data, style) : {}), [data, style]);

	const job = useMemo<Job | null>(() => {
		if (!data || !card || !course || !pool.length) return null;
		const ace = buildAce({
			aptitudes: card.aptitudes, style, category: categoryOf(course.distance), surface: course.ground === 2 ? 'dirt' : 'turf', target,
			uniqueSkillId: card.uniqueSkillId == null ? undefined : String(card.uniqueSkillId),
		});
		return { roster: { outfits: pool }, preset: cmPreset(cm, ace), tierList };
	}, [data, pool, card, course, style, target, cmId, tierList]);
	const onError = (e: Error) => setError(e.message);
	const { result, busy, stale, cancel } = useJob(run, job, { onError });

	// Needs no Ace or Target stats, so it runs as soon as a Roster and CM course exist.
	const veteranJob = useMemo<VeteranJob | null>(() => {
		if (!roster || !course) return null;
		const uniqueSkills: [number, number][] = [];
		data?.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
		return { veterans: roster.veterans, courseId: cm.courseId, uniqueSkills };
	}, [roster, course, cmId, data]);
	// Scores of another CM must not pass as current, so a restart or cancel drops them.
	const vs = useJob(runVeterans, veteranJob, { clearOnRestart: true, onError });

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

	const outfits = useMemo(() => new Map(pool.map((o) => [o.id, o])), [pool]);
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
					<button onClick={() => { clearRoster(localStorage); setRoster(null); own.clear(); }}>Clear data</button>
				</section>
			)}
			{roster && data && (
				<section>
					<h2>Ace</h2>
					<label>CM <select name="cm" value={cmId} onChange={(e) => { const id = Number(e.currentTarget.value); saveCm(localStorage, id); setCmId(id); }}>
						{CMS.map((c) => <option value={c.id}>{c.name} {c.date}{c.confirmed === false ? ' (predicted)' : ''}</option>)}
					</select></label>
					<label>Ace outfit <select name="ace" value={card?.id ?? ''} onChange={(e) => setAceId(Number(e.currentTarget.value))}>
						<option value="" disabled>Choose an Ace</option>
						{[...data.cards.values()].map((c) => <option value={c.id}>{`${c.title} ${c.name}`.trim()}</option>)}
					</select></label>
					<label>Style <select name="style" value={style} onChange={(e) => setStyle(e.currentTarget.value as Style)}>
						{STYLES.map((s) => <option value={s}>{STYLE_LABEL[s]}</option>)}
					</select></label>
					{defaults && <fieldset><legend>Target stats</legend>{STATS.map((k) => (
						<label>{k} <input type="number" name={k} value={target[k] ?? defaults[k]} onChange={(e) => setTarget({ ...target, [k]: Number(e.currentTarget.value) })} /></label>
					))}</fieldset>}
					{!card && <p>Choose an Ace to see recommendations.</p>}
					{busy && <p>Computing... <button name="cancel" onClick={cancel}>Cancel</button></p>}
					<OwnedFilterSelect value={own.filter} onChange={own.setFilter} />
					<PickList title="Ace" testId="ace-card" picks={result?.ace} outfits={outfits} stale={stale} data={data} show={own.show} onToggle={own.toggle} />
					<PickList title="Core loop" testId="core-card" picks={result?.core} outfits={outfits} stale={stale} data={data} show={own.show} onToggle={own.toggle} />
					<PickList title="Side loop" testId="side-card" picks={result?.side} outfits={outfits} stale={stale} data={data} show={own.show} onToggle={own.toggle} />
					<VeteranList scores={vs.result} progress={vs.progress} stale={vs.stale} data={data} onCancel={vs.cancel} />
				</section>
			)}
			{data?.meta?.resourceVersion && <footer>Game data: resource version {data.meta.resourceVersion}, generated {formatAge(data.meta.generatedAt)}</footer>}
		</main>
	);
}
