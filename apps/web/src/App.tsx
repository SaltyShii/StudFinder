import { useEffect, useMemo, useState } from 'preact/hooks';
import { GameData, loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { STYLE_LABEL, STYLES, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { CMS, pickCm } from '../../../packages/scoring/src/cm';
import { formatAge } from './age';
import { AceHero } from './AceHero';
import { MustHaves } from './MustHaves';
import { OwnedVersions } from './OwnedVersions';
import { SimRunner } from './SimRunner';
import { TierEditor } from './TierEditor';
import { TrackOverview } from './TrackOverview';
import { LoopSlots } from './LoopSlots';
import { PickList } from './PickList';
import { applyTierEdit, cardIdsOf, coreTierListOf, planCandidates, planOwned, planRecommend, planVeterans, type RecommendJob, type RecommendRunner, type VeteranJob, type TierEdit, type TierEdits, type VeteranRunner } from './jobs';
import { recommendRunner, veteranRunner } from './runners';
import { useJob } from './useJob';
import { VeteranList } from './VeteranList';
import { clearRoster, importRoster, loadCm, loadOwnedVersions, loadMustHaves, loadRoster, loadTierEdits, loadUseBorrowed, saveCm, saveMustHaves, saveOwnedVersions, saveRoster, saveTierEdits, saveUseBorrowed } from './roster';

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
	run?: RecommendRunner;
	runVeterans?: VeteranRunner;
}

export function App({ loadData = loadGameData, run = recommendRunner, runVeterans = veteranRunner }: Props) {
	const [roster, setRoster] = useState<ImportResult | null>(() => loadRoster(localStorage));
	const [data, setData] = useState<GameData | null>(null);
	const [error, setError] = useState('');
	const [cmId, setCmId] = useState<number>(() => loadCm(localStorage, CMS.map((c) => c.id)) ?? pickCm(new Date()).id);
	const [useBorrowed, setUseBorrowed] = useState(() => loadUseBorrowed(localStorage));
	const [ownedChoice, setOwnedChoice] = useState<number[] | null>(() => loadOwnedVersions(localStorage));
	// Until the player edits, Owned versions are the versions the Roster has a veteran of.
	const owned = useMemo(() => new Set(ownedChoice ?? roster?.veterans.map((v) => v.cardId) ?? []), [ownedChoice, roster]);
	const [mustHaves, setMustHaves] = useState<string[]>(() => loadMustHaves(localStorage));
	// Null is the Generic runner (all A, no unique skill).
	const [simRunnerId, setSimRunnerId] = useState<number | null>(null);
	const [styleChoice, setStyleChoice] = useState<Style | null>(null);
	const [coreStyleChoice, setCoreStyleChoice] = useState<Style | null>(null);
	const [target, setTarget] = useState<Partial<TargetStats>>({});
	const [tierEdits, setTierEdits] = useState<TierEdits>(() => loadTierEdits(localStorage));

	useEffect(() => { loadData().then(setData, (e) => setError(String(e))); }, []);

	const card = data && simRunnerId != null ? data.cards.get(simRunnerId) : undefined;
	const cm = useMemo(() => pickCm(new Date(), cmId), [cmId]);
	const course = data?.courses.get(cm.courseId);
	const candidates = useMemo(() => (data && roster ? planCandidates(data, roster, card, course, useBorrowed) : []), [data, roster, card, course, useBorrowed]);
	const ownedVersions = useMemo(() => (data && roster ? planOwned(data, roster, owned, course, useBorrowed) : []), [data, roster, owned, course, useBorrowed]);
	const { style, coreStyle, job, defaults } = useMemo(() => planRecommend(data, candidates, cm, { card, course, styleChoice, target, coreStyleChoice, owned: ownedVersions, tierEdits, mustHaves }), [data, candidates, cm, card, course, styleChoice, target, coreStyleChoice, ownedVersions, tierEdits, mustHaves]);
	const baseTierList = useMemo(() => (data ? coreTierListOf(data, coreStyle) : {}), [data, coreStyle]);
	const editTiers = (edit: TierEdit | undefined) => {
		const next = { ...tierEdits, [coreStyle]: edit }; // undefined drops out of the stored JSON
		saveTierEdits(localStorage, next);
		setTierEdits(next);
	};
	const cardIds = useMemo(() => (roster ? cardIdsOf(roster) : new Map<string, number>()), [roster]);
	const veteranJob = useMemo(() => planVeterans(data, roster, cm), [data, roster, cm]);
	// Nothing computes until Run: the jobs run the snapshot taken then, and any later change to `job` marks the results outdated.
	const [ran, setRan] = useState<{ job: RecommendJob; veteranJob: VeteranJob | null; run: RecommendJob; vRun: VeteranJob | null } | null>(null);
	const { result, progress, busy, stale: running, error: jobError, cancel } = useJob(run, ran?.run ?? null);
	// Scores of another CM must not pass as current, so a restart or cancel drops them.
	const vs = useJob(runVeterans, ran?.vRun ?? null, { clearOnRestart: true });
	const stale = running || (!!ran && ran.job !== job);
	const vsStale = vs.stale || (!!ran && ran.veteranJob !== veteranJob);
	// The track's top simulated skills, best value first.
	const suggestions = useMemo(() => result?.skills.slice(0, 5).map((d) => d.skillId) ?? [], [result]);
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
						<button onClick={() => { clearRoster(localStorage); setRoster(null); setOwnedChoice(null); setUseBorrowed(false); setMustHaves([]); setTierEdits({}); setRan(null); }}>Clear data</button>
					</section>
				)}
				{roster && data && <OwnedVersions data={data} owned={owned} onChange={(ids) => { saveOwnedVersions(localStorage, ids); setOwnedChoice(ids); }} />}
				{roster && data && (
					<section class="panel">
						<CmBanner cmId={cm.id} />
						<h2>Sim runner</h2>
						<label>CM <select name="cm" value={cmId} onChange={(e) => { const id = Number(e.currentTarget.value); saveCm(localStorage, id); setCmId(id); setStyleChoice(null); setCoreStyleChoice(null); }}>
							{CMS.map((c) => <option value={c.id}>{c.name} {c.date}{c.confirmed === false ? ' (predicted)' : ''}</option>)}
						</select></label>
						<SimRunner data={data} cardId={card?.id ?? null} onPick={(id) => { setSimRunnerId(id); setStyleChoice(null); setCoreStyleChoice(null); }} />
						<label>Style <select name="style" value={style} onChange={(e) => setStyleChoice(e.currentTarget.value as Style)}>
							{STYLES.map((s) => <option value={s}>{STYLE_LABEL[s]}</option>)}
						</select></label>
						<label>Core loop style <select name="core-style" value={coreStyle} onChange={(e) => setCoreStyleChoice(e.currentTarget.value as Style)}>
							{STYLES.map((s) => <option value={s}>{STYLE_LABEL[s]}</option>)}
						</select></label>
						{defaults && <fieldset><legend>Target stats</legend>{STATS.map((k) => (
							<label>{k} <input type="number" name={k} value={target[k] ?? defaults[k]} onChange={(e) => setTarget({ ...target, [k]: Number(e.currentTarget.value) })} /></label>
						))}</fieldset>}
					</section>
				)}
				{roster && data && <MustHaves data={data} tiers={applyTierEdit(baseTierList, tierEdits[coreStyle])} mustHaves={mustHaves} suggestions={suggestions} onChange={(ids) => { saveMustHaves(localStorage, ids); setMustHaves(ids); }} />}
				{roster && data && <TierEditor base={baseTierList} edit={tierEdits[coreStyle]} onChange={editTiers} />}
				<section class="panel">
					<button class="primary" name="run" disabled={!job} onClick={() => setRan({ job: job!, veteranJob, run: { ...job! }, vRun: veteranJob && { ...veteranJob } })}>Run</button>
					{!job && <p class="muted">Import a Roster with Owned versions to run.</p>}
				</section>
			</div>
			{!ran && <div class="results"><p class="panel empty">Import your roster, set your options, then press Run.</p></div>}
			{roster && data && ran && (
				<div class="results">
					{busy && <p class="panel">Computing{progress && (progress.phase === 'screen' ? `: screening skills (${progress.done} simulated)` : `: refining the shown skills (${progress.done}/${progress.total})`)}... <button name="cancel" onClick={cancel}>Cancel</button></p>}
					<AceHero pick={result?.aceSlot} data={data} ownedVersions={ownedVersions} cardIds={cardIds} stale={stale} />
					{result && <TrackOverview track={result.track} stale={stale} />}
					<div class="picks">
						{ownedVersions.length ? <>
							<LoopSlots title="Side loop" testId="side" picks={result?.sideSlots} ownedVersions={ownedVersions} cardIds={cardIds} stale={stale} data={data} />
							<LoopSlots title="Core loop" testId="core" picks={result?.coreSlots} ownedVersions={ownedVersions} cardIds={cardIds} stale={stale} data={data} />
						</> : <>
							<PickList title="Side loop" testId="side-card" picks={result?.side} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
							<PickList title="Core loop" testId="core-card" picks={result?.core} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
						</>}
					</div>
					<details>
						<summary>Ace veteran list</summary>
						<PickList title="Ace" testId="ace-card" picks={result?.ace} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
						<VeteranList scores={vs.result} progress={vs.progress} stale={vsStale} data={data} onCancel={vs.cancel} />
					</details>
				</div>
			)}
			{data?.meta?.resourceVersion && <footer class="muted">Game data: resource version {data.meta.resourceVersion}, generated {formatAge(data.meta.generatedAt)}</footer>}
		</main>
	);
}
