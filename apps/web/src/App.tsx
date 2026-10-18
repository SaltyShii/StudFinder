import { useEffect, useMemo, useState } from 'preact/hooks';
import { GameData, loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { aceForCourse, categoryOf, defaultTargetStats, pinkGroupOf, STYLE_LABEL, STYLES, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { candidatesOf } from '../../../packages/scoring/src/candidates';
import { CMS, cmPreset, pickCm } from '../../../packages/scoring/src/cm';
import { resolveTierList } from '../../../packages/lineage/src/tiers';
import type { TierList } from '../../../packages/scoring/src/shared';
import { formatAge } from './age';
import { PickList } from './PickList';
import type { Job, Runner, VeteranJob, VeteranRunner } from './job';
import { recommendRunner, veteranRunner } from './runners';
import { useJob } from './useJob';
import { VeteranList } from './VeteranList';
import { clearRoster, importRoster, loadCm, loadRoster, loadUseBorrowed, saveCm, saveRoster, saveUseBorrowed } from './roster';

// Every skill name of an entry maps to its tier; resolved entries are sorted best first.
function tierListOf(data: GameData, style: Style): TierList {
	const list: TierList = {};
	for (const e of resolveTierList(data, style).entries) for (const n of e.skills) list[n] ??= e.tier;
	return list;
}

// Banner files are named <id>.png, or <id>-jp.png while the CM is only known from the JP release; hide when neither exists.
function CmBanner({ cmId }: { cmId: number }) {
	const [tries, setTries] = useState(0);
	useEffect(() => setTries(0), [cmId]);
	if (tries > 1) return null;
	return <img class="banner" alt="" src={`${import.meta.env.BASE_URL}img/cm/${cmId}${tries ? '-jp' : ''}.png`} onError={() => setTries(tries + 1)} />;
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
	const [useBorrowed, setUseBorrowed] = useState(() => loadUseBorrowed(localStorage));
	const [aceId, setAceId] = useState<number | null>(null);
	const [style, setStyle] = useState<Style>('senko');
	const [target, setTarget] = useState<Partial<TargetStats>>({});

	useEffect(() => { loadData().then(setData, (e) => setError(String(e))); }, []);

	const card = data && aceId != null ? data.cards.get(aceId) : undefined;
	const cm = pickCm(new Date(), cmId);
	const course = data?.courses.get(cm.courseId);
	const pinkGroupId = course ? pinkGroupOf(course.distance) : 0;
	const candidates = useMemo(
		() => (data && roster && card ? candidatesOf(data, useBorrowed ? [...roster.veterans, ...roster.borrowed] : roster.veterans, { aceCardId: card.id, pinkGroupId }) : []),
		[data, roster, card, pinkGroupId, useBorrowed],
	);
	const tierList = useMemo(() => (data ? tierListOf(data, style) : {}), [data, style]);

	const job = useMemo<Job | null>(() => {
		if (!data || !card || !course || !candidates.length) return null;
		const ace = aceForCourse(card, course, style, target);
		return { roster: { candidates }, preset: cmPreset(cm, ace), tierList };
	}, [data, candidates, card, course, style, target, cmId, tierList]);
	const { result, busy, stale, error: jobError, cancel } = useJob(run, job);

	// Needs no Ace or Target stats, so it runs as soon as a Roster and CM course exist.
	const veteranJob = useMemo<VeteranJob | null>(() => {
		if (!roster || !course) return null;
		const uniqueSkills: [number, number][] = [];
		data?.cards.forEach((c) => { if (c.uniqueSkillId != null) uniqueSkills.push([c.id, c.uniqueSkillId]); });
		return { veterans: roster.veterans, courseId: cm.courseId, uniqueSkills };
	}, [roster, course, cmId, data]);
	// Scores of another CM must not pass as current, so a restart or cancel drops them.
	const vs = useJob(runVeterans, veteranJob, { clearOnRestart: true });
	const shownError = error || jobError?.message || vs.error?.message;

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

	const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
	const defaults = course && defaultTargetStats(categoryOf(course.distance), style);

	return (
		<main class="layout">
			<div class="sidebar">
				<section class="panel">
					<h1>Stud Finder</h1>
					<p class="muted">Your export is read in this browser only and never sent anywhere.</p>
					<input type="file" accept=".json,application/json" onChange={onFile} />
				</section>
				{shownError && <p role="alert">{shownError}</p>}
				{roster && (
					<section class="panel">
						<h2>Roster</h2>
						<p>{roster.veterans.length} veterans, {roster.borrowed.length} borrowed</p>
						<label><input type="checkbox" name="use-borrowed" checked={useBorrowed} onChange={(e) => { const on = e.currentTarget.checked; saveUseBorrowed(localStorage, on); setUseBorrowed(on); }} /> Also score friends' borrowed veterans (up to 5 borrows a day)</label>
						<button onClick={() => { clearRoster(localStorage); setRoster(null); setUseBorrowed(false); }}>Clear data</button>
					</section>
				)}
				{roster && data && (
					<section class="panel">
						<CmBanner cmId={cm.id} />
						<h2>Ace</h2>
						<label>CM <select name="cm" value={cmId} onChange={(e) => { const id = Number(e.currentTarget.value); saveCm(localStorage, id); setCmId(id); }}>
							{CMS.map((c) => <option value={c.id}>{c.name} {c.date}{c.confirmed === false ? ' (predicted)' : ''}</option>)}
						</select></label>
						<label>Ace version <select name="ace" value={card?.id ?? ''} onChange={(e) => setAceId(Number(e.currentTarget.value))}>
							<option value="" disabled>Choose an Ace</option>
							{[...data.cards.values()].map((c) => <option value={c.id}>{`${c.title} ${c.name}`.trim()}</option>)}
						</select></label>
						<label>Style <select name="style" value={style} onChange={(e) => setStyle(e.currentTarget.value as Style)}>
							{STYLES.map((s) => <option value={s}>{STYLE_LABEL[s]}</option>)}
						</select></label>
						{defaults && <fieldset><legend>Target stats</legend>{STATS.map((k) => (
							<label>{k} <input type="number" name={k} value={target[k] ?? defaults[k]} onChange={(e) => setTarget({ ...target, [k]: Number(e.currentTarget.value) })} /></label>
						))}</fieldset>}
					</section>
				)}
			</div>
			{roster && data && (
				<div class="results">
					{!card && <p class="panel">Choose an Ace to see recommendations.</p>}
					{busy && <p class="panel">Computing... <button name="cancel" onClick={cancel}>Cancel</button></p>}
					<PickList title="Ace" testId="ace-card" picks={result?.ace} candidates={byId} stale={stale} data={data} />
					<PickList title="Core loop" testId="core-card" picks={result?.core} candidates={byId} stale={stale} data={data} />
					<PickList title="Side loop" testId="side-card" picks={result?.side} candidates={byId} stale={stale} data={data} />
					<VeteranList scores={vs.result} progress={vs.progress} stale={vs.stale} data={data} onCancel={vs.cancel} />
				</div>
			)}
			{data?.meta?.resourceVersion && <footer class="muted">Game data: resource version {data.meta.resourceVersion}, generated {formatAge(data.meta.generatedAt)}</footer>}
		</main>
	);
}
