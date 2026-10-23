import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SimAssumptions } from '../../../packages/scoring/src/assumptions';
import { AssumptionsPanel } from './AssumptionsPanel';
import { GameData, loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { STYLE_LABEL, STYLES, gradeLabel, surfaceOf, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { CMS, pickCm } from '../../../packages/scoring/src/cm';
import type { Recommendation } from '../../../packages/scoring/src/recommend';
import { formatAge } from './age';
import { AceHero, nameOf } from './AceHero';
import { SHOW_LOOPS } from './flags';
import { MustHaves } from './MustHaves';
import { OwnedVersions } from './OwnedVersions';
import { LoopVersions } from './LoopVersions';
import { SimRunner } from './SimRunner';
import { TierEditor } from './TierEditor';
import { skillChips } from './SkillChart';
import { SkillPanel } from './SkillPanel';
import type { SkillCategory } from '../../../packages/scoring/src/skillCategory';
import { courseTitle, isLeftHanded } from './trackAxis';
import { TrackOverview } from './TrackOverview';
import { LoopSlots } from './LoopSlots';
import { PickList } from './PickList';
import { applyTierEdit, cardIdsOf, coreTierListOf, planCandidates, planFit, planOwned, DEFAULT_FIT_CUTOFF, planRecommend, planVeterans, type AceRowsRunner, type RecommendJob, type RecommendRunner, type VeteranJob, type TierEdit, type TierEdits, type VeteranRunner } from './jobs';
import { aceRowsRunner, recommendRunner, veteranRunner } from './runners';
import { useJob } from './useJob';
import { useAceRows } from './useAceRows';
import { VeteranList } from './VeteranList';
import { clearRoster, importRoster, loadAssumptions, saveAssumptions, loadCm, loadOwnedVersions, loadLoopVersions, saveLoopVersions, loadFitCutoff, saveFitCutoff, loadForcedVersions, saveForcedVersions, loadMustHaves, loadRoster, loadTierEdits, loadUseBorrowed, saveCm, saveMustHaves, saveOwnedVersions, saveRoster, saveTierEdits, saveUseBorrowed } from './roster';

// Banner files are named <id>.png, or <id>-jp.png while the CM is only known from the JP release; hide when neither exists.
function CmBanner({ cmId }: { cmId: number }) {
	const [tries, setTries] = useState(0);
	useEffect(() => setTries(0), [cmId]);
	if (tries > 1) return null;
	return <img class="banner" alt="" src={`${import.meta.env.BASE_URL}img/cm/${cmId}${tries ? '-jp' : ''}.png`} onError={() => setTries(tries + 1)} />;
}

const STATS = ['speed', 'stamina', 'power', 'guts', 'wisdom'] as const;

interface Props {
	/** Shows the Side loop, Core loop and Ace veteran sections with their controls; defaults to the SHOW_LOOPS flag. */
	showLoops?: boolean;
	loadData?: () => Promise<GameData>;
	run?: RecommendRunner;
	runVeterans?: VeteranRunner;
	/** Builds the chart rows of an Ace hero other than the first, when it is opened. */
	runRows?: AceRowsRunner;
}

export function App({ showLoops = SHOW_LOOPS, loadData = loadGameData, run = recommendRunner, runVeterans = veteranRunner, runRows = aceRowsRunner }: Props) {
	const [roster, setRoster] = useState<ImportResult | null>(() => loadRoster(localStorage));
	const [data, setData] = useState<GameData | null>(null);
	const [error, setError] = useState('');
	const [cmId, setCmId] = useState<number>(() => loadCm(localStorage, CMS.map((c) => c.id)) ?? pickCm(new Date()).id);
	const [useBorrowed, setUseBorrowed] = useState(() => loadUseBorrowed(localStorage));
	const [ownedChoice, setOwnedChoice] = useState<number[] | null>(() => loadOwnedVersions(localStorage));
	// Until the player edits, Owned versions are the versions the Roster has a veteran of.
	const owned = useMemo(() => new Set(ownedChoice ?? roster?.veterans.map((v) => v.cardId) ?? []), [ownedChoice, roster]);
	const [loopChoice, setLoopChoice] = useState<number[] | null>(() => loadLoopVersions(localStorage));
	// Until the player narrows it, the Loop versions are every Owned version.
	const loopPicked = useMemo(() => new Set(loopChoice ? [...owned].filter((id) => loopChoice.includes(id)) : owned), [loopChoice, owned]);
	const [cutoff, setCutoff] = useState<number>(() => loadFitCutoff(localStorage) ?? DEFAULT_FIT_CUTOFF);
	const [forced, setForced] = useState<number[]>(() => loadForcedVersions(localStorage));
	const [mustHaves, setMustHaves] = useState<string[]>(() => loadMustHaves(localStorage));
	// Null is the Generic runner (all A, no unique skill).
	const [simRunnerId, setSimRunnerId] = useState<number | null>(null);
	const [styleChoice, setStyleChoice] = useState<Style | null>(null);
	const [coreStyleChoice, setCoreStyleChoice] = useState<Style | null>(null);
	const [target, setTarget] = useState<Partial<TargetStats>>({});
	const [skillTab, setSkillTab] = useState<SkillCategory>('speed');
	const [sideTab, setSideTab] = useState<SkillCategory>('speed');
	// The pick belongs to the result it was made on: a new result opens the first Ace hero again.
	const [acePicked, setAcePicked] = useState<{ result: Recommendation | null; cardId: number } | null>(null);
	const [sideCard, setSideCard] = useState<number | null>(null);
	const [tierEdits, setTierEdits] = useState<TierEdits>(() => loadTierEdits(localStorage));

	const [assumptions, setAssumptions] = useState(() => loadAssumptions(localStorage));
	const changeAssumptions = (next: SimAssumptions) => { saveAssumptions(localStorage, next); setAssumptions(next); };

	useEffect(() => { loadData().then(setData, (e) => setError(String(e))); }, []);

	const card = data && simRunnerId != null ? data.cards.get(simRunnerId) : undefined;
	const cm = useMemo(() => pickCm(new Date(), cmId), [cmId]);
	const course = data?.courses.get(cm.courseId);
	const candidates = useMemo(() => (data && roster ? planCandidates(data, roster, card, course, useBorrowed) : []), [data, roster, card, course, useBorrowed]);
	const ownedVersions = useMemo(() => (data && roster ? planOwned(data, roster, owned, course, useBorrowed) : []), [data, roster, owned, course, useBorrowed]);
	// The Ace slot simulates the fit versions only; the loops rank the Loop versions whatever their Aptitude.
	const { fit: aceVersions, unfit } = useMemo(() => planFit(ownedVersions, course, cutoff, new Set(forced)), [ownedVersions, course, cutoff, forced]);
	const loopVersions = useMemo(() => ownedVersions.filter((v) => loopPicked.has(v.cardId)), [ownedVersions, loopPicked]);
	// The hidden loops must not steer the ranking; the stored Must-haves stay untouched.
	const activeMustHaves = useMemo(() => (showLoops ? mustHaves : []), [showLoops, mustHaves]);
	const { style, coreStyle, job, defaults } = useMemo(() => planRecommend(data, candidates, cm, { card, course, styleChoice, target, coreStyleChoice, owned: aceVersions, loopVersions, tierEdits, mustHaves: activeMustHaves, assumptions }), [data, candidates, cm, card, course, styleChoice, target, coreStyleChoice, aceVersions, loopVersions, tierEdits, activeMustHaves, assumptions]);
	const baseTierList = useMemo(() => (data ? coreTierListOf(data, coreStyle) : {}), [data, coreStyle]);
	const editTiers = (edit: TierEdit | undefined) => {
		const next = { ...tierEdits, [coreStyle]: edit }; // undefined drops out of the stored JSON
		saveTierEdits(localStorage, next);
		setTierEdits(next);
	};
	const noFit = ownedVersions.length > 0 && !aceVersions.length;
	const cardIds = useMemo(() => (roster ? cardIdsOf(roster) : new Map<string, number>()), [roster]);
	const veteranJob = useMemo(() => (showLoops ? planVeterans(data, roster, cm, assumptions) : null), [showLoops, data, roster, cm, assumptions]);
	// Nothing computes until Run: the jobs run the snapshot taken then, and any later change to `job` marks the results outdated.
	const [ran, setRan] = useState<{ job: RecommendJob; veteranJob: VeteranJob | null; run: RecommendJob; vRun: VeteranJob | null } | null>(null);
	// The veteran scores depend on the CM, roster and assumptions only: while those are unchanged, a finished or running job stays as it is (a cancelled or failed one has no result and runs again).
	const snapshot = () => job && setRan({ job, veteranJob, run: { ...job }, vRun: ran?.veteranJob === veteranJob && (vs.busy || vs.result) ? ran.vRun : veteranJob && { ...veteranJob } });
	// A new assumption changes every score, so results already on screen are recomputed rather than left outdated.
	const lastAssumptions = useRef(assumptions);
	useEffect(() => {
		if (lastAssumptions.current === assumptions) return;
		lastAssumptions.current = assumptions;
		if (ran) snapshot();
	}, [assumptions]);
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

	const aceCard = acePicked?.result === result ? acePicked.cardId : undefined;
	const acePick = result?.aceSlots.find((s) => s.cardId === aceCard) ?? result?.aceSlots[0];
	const aceChart = useAceRows(runRows, result, ran?.run ?? null, acePick?.cardId, !busy);
	const chips = useMemo(() => (acePick && data ? skillChips(aceChart.rows.filter((r) => !r.other), result!.track, data) : []), [acePick, aceChart.rows, result, data]);
	// The Side loop chart follows the selected pick; the best pick until one is chosen.
	const sidePick = result?.sideSlots.find((s) => s.cardId === sideCard) ?? result?.sideSlots[0];
	const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

	return (
		<main class="layout">
			<header class="app-header" data-testid="app-header">
				<div class="top-bar" data-testid="top-bar">
					<h1>Stud Finder</h1>
					<input type="file" accept=".json,application/json" title="Your export is read in this browser only and never sent anywhere." onChange={onFile} />
					{roster && data && (
						<>
							<label>CM <select name="cm" value={cmId} onChange={(e) => { const id = Number(e.currentTarget.value); saveCm(localStorage, id); setCmId(id); setStyleChoice(null); setCoreStyleChoice(null); }}>
								{CMS.map((c) => <option value={c.id}>{c.name} {c.date}{c.confirmed === false ? ' (predicted)' : ''}</option>)}
							</select></label>
							<SimRunner data={data} cardId={card?.id ?? null} onPick={(id) => { setSimRunnerId(id); setStyleChoice(null); setCoreStyleChoice(null); }} />
							<label>Style <select name="style" value={style} onChange={(e) => setStyleChoice(e.currentTarget.value as Style)}>
								{STYLES.map((s) => <option value={s}>{STYLE_LABEL[s]}</option>)}
							</select></label>
						</>
					)}
					<button class="primary" name="run" disabled={!job || noFit} onClick={snapshot}>Run</button>
					{busy && <button name="cancel" onClick={cancel}>Cancel</button>}
				</div>
				<p class="course" data-testid="header-cm">{cm.name}{course && ` - ${course.distance}m ${surfaceOf(course.ground)}`}</p>
				<span class="badge" data-testid="style-badge">{STYLE_LABEL[style]}</span>
			</header>
			{shownError && <p role="alert">{shownError}</p>}
			{noFit && <p class="muted">All owned versions are below {gradeLabel(cutoff)} on this CM; force-enable one</p>}
			{!job && <p class="muted">Import a Roster with Owned versions to run.</p>}
			{roster && data && (
				<details class="settings" data-testid="settings">
					<summary>Settings</summary>
					<div class="settings-body">
						<section class="panel">
							<CmBanner cmId={cm.id} />
							<h2>Roster</h2>
							<p>{roster.veterans.length} veterans, {roster.borrowed.length} borrowed</p>
							<label><input type="checkbox" name="use-borrowed" checked={useBorrowed} onChange={(e) => { const on = e.currentTarget.checked; saveUseBorrowed(localStorage, on); setUseBorrowed(on); }} /> Also score friends' borrowed veterans (up to 5 borrows a day)</label>
							<button onClick={() => { clearRoster(localStorage); setRoster(null); setOwnedChoice(null); setLoopChoice(null); setCutoff(DEFAULT_FIT_CUTOFF); setForced([]); setUseBorrowed(false); setMustHaves([]); setTierEdits({}); setRan(null); }}>Clear data</button>
						</section>
						{showLoops && <label class="panel">Core loop style <select name="core-style" value={coreStyle} onChange={(e) => setCoreStyleChoice(e.currentTarget.value as Style)}>
							{STYLES.map((s) => <option value={s}>{STYLE_LABEL[s]}</option>)}
						</select></label>}
						{defaults && <fieldset class="panel"><legend>Target stats</legend>{STATS.map((k) => (
							<label>{k} <input type="number" name={k} value={target[k] ?? defaults[k]} onChange={(e) => setTarget({ ...target, [k]: Number(e.currentTarget.value) })} /></label>
						))}</fieldset>}
						<AssumptionsPanel value={assumptions} onChange={changeAssumptions} />
						<OwnedVersions data={data} owned={owned} unfit={unfit} forced={forced} onForce={(ids) => { saveForcedVersions(localStorage, ids); setForced(ids); }} cutoff={cutoff} onCutoff={(g) => { saveFitCutoff(localStorage, g); setCutoff(g); }} onChange={(ids) => { saveOwnedVersions(localStorage, ids); setOwnedChoice(ids); }} />
						{showLoops && <>
							<LoopVersions data={data} owned={owned} picked={loopPicked} onChange={(ids) => { saveLoopVersions(localStorage, ids); setLoopChoice(ids); }} />
							<MustHaves data={data} tiers={applyTierEdit(baseTierList, tierEdits[coreStyle])} mustHaves={mustHaves} suggestions={suggestions} onChange={(ids) => { saveMustHaves(localStorage, ids); setMustHaves(ids); }} />
							<TierEditor base={baseTierList} edit={tierEdits[coreStyle]} onChange={editTiers} />
						</>}
					</div>
				</details>
			)}
			{!ran && <div class="results"><p class="panel empty">Import your roster, set your options, then press Run.</p></div>}
			{roster && data && ran && (
				<div class="results">
					{busy && <p class="panel">Computing{progress && (progress.phase === 'screen' ? `: screening skills (${progress.done} simulated)` : `: refining the shown skills (${progress.done}/${progress.total})`)}...</p>}
					<AceHero picks={result?.aceSlots} selected={acePick?.cardId} onSelect={(cardId) => setAcePicked({ result, cardId })} data={data} stale={stale} />
					{result && <TrackOverview track={result.track} title={course && data ? courseTitle(course, data.tracks) : `${result.track.distance}m`} leftHanded={!!course && isLeftHanded(course)} chips={chips} stale={stale} />}
					{aceChart.loading && <p class="panel muted" data-testid="ace-chart-loading">Simulating the skills of {nameOf(data, acePick!.cardId)}...</p>}
					{aceChart.error && <p class="panel" role="alert">Could not build the skills of {nameOf(data, acePick!.cardId)}: {aceChart.error}</p>}
					{acePick && !aceChart.loading && <SkillPanel rows={aceChart.rows} track={result!.track} data={data} tab={skillTab} onTab={setSkillTab} stale={stale} aceScore />}
					{showLoops && <>
					<div class="picks">
						{ownedVersions.length ? <>
							<LoopSlots title="Side loop" testId="side" picks={result?.sideSlots} ownedVersions={ownedVersions} cardIds={cardIds} stale={stale} data={data} selected={sidePick?.cardId} onSelect={setSideCard} />
							<LoopSlots title="Core loop" testId="core" picks={result?.coreSlots} ownedVersions={ownedVersions} cardIds={cardIds} stale={stale} data={data} />
						</> : <>
							<PickList title="Side loop" testId="side-card" picks={result?.side} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
							<PickList title="Core loop" testId="core-card" picks={result?.core} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
						</>}
					</div>
					{sidePick && <SkillPanel rows={sidePick.skills} track={result!.track} data={data} tab={sideTab} onTab={setSideTab} stale={stale} heading={{ testId: 'side-chart', title: `Side loop skills: ${nameOf(data, sidePick.cardId)}`, empty: 'This lineage carries no skill that gains lengths on this track.' }} />}
					<details>
						<summary>Ace veteran list</summary>
						<PickList title="Ace" testId="ace-card" picks={result?.ace} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
						<VeteranList scores={vs.result} progress={vs.progress} stale={vsStale} data={data} onCancel={vs.cancel} />
					</details>
					</>}
				</div>
			)}
			{data?.meta?.resourceVersion && <footer class="muted">Game data: resource version {data.meta.resourceVersion}, generated {formatAge(data.meta.generatedAt)}</footer>}
		</main>
	);
}
