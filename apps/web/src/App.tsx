import { useEffect, useMemo, useState } from 'preact/hooks';
import { GameData, loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { STYLE_LABEL, STYLES, type Style, type TargetStats } from '../../../packages/scoring/src/ace';
import { CMS, pickCm } from '../../../packages/scoring/src/cm';
import { formatAge } from './age';
import { OwnedVersions } from './OwnedVersions';
import { PickList } from './PickList';
import { cardIdsOf, planCandidates, planRecommend, planVeterans, type RecommendRunner, type VeteranRunner } from './jobs';
import { recommendRunner, veteranRunner } from './runners';
import { useJob } from './useJob';
import { VeteranList } from './VeteranList';
import { clearRoster, importRoster, loadCm, loadOwnedVersions, loadRoster, loadUseBorrowed, saveCm, saveOwnedVersions, saveRoster, saveUseBorrowed } from './roster';

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
	const [aceId, setAceId] = useState<number | null>(null);
	const [styleChoice, setStyleChoice] = useState<Style | null>(null);
	const [target, setTarget] = useState<Partial<TargetStats>>({});

	useEffect(() => { loadData().then(setData, (e) => setError(String(e))); }, []);

	const card = data && aceId != null ? data.cards.get(aceId) : undefined;
	const cm = useMemo(() => pickCm(new Date(), cmId), [cmId]);
	const course = data?.courses.get(cm.courseId);
	const candidates = useMemo(() => (data && roster && card ? planCandidates(data, roster, card, course, useBorrowed) : []), [data, roster, card, course, useBorrowed]);
	const { style, job, defaults } = useMemo(() => planRecommend(data, candidates, cm, card, course, styleChoice, target), [data, candidates, cm, card, course, styleChoice, target]);
	const cardIds = useMemo(() => (roster ? cardIdsOf(roster) : new Map<string, number>()), [roster]);
	const { result, busy, stale, error: jobError, cancel } = useJob(run, job);

	// Needs no Ace or Target stats, so it runs as soon as a Roster, game data and CM course exist.
	const veteranJob = useMemo(() => planVeterans(data, roster, cm), [data, roster, cm]);
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
						<button onClick={() => { clearRoster(localStorage); setRoster(null); setOwnedChoice(null); setUseBorrowed(false); }}>Clear data</button>
					</section>
				)}
				{roster && data && <OwnedVersions data={data} owned={owned} onChange={(ids) => { saveOwnedVersions(localStorage, ids); setOwnedChoice(ids); }} />}
				{roster && data && (
					<section class="panel">
						<CmBanner cmId={cm.id} />
						<h2>Sim runner</h2>
						<label>CM <select name="cm" value={cmId} onChange={(e) => { const id = Number(e.currentTarget.value); saveCm(localStorage, id); setCmId(id); setStyleChoice(null); }}>
							{CMS.map((c) => <option value={c.id}>{c.name} {c.date}{c.confirmed === false ? ' (predicted)' : ''}</option>)}
						</select></label>
						<label>Sim runner <select name="ace" value={card?.id ?? ''} onChange={(e) => { setAceId(Number(e.currentTarget.value)); setStyleChoice(null); }}>
							<option value="" disabled>Choose a Sim runner</option>
							{[...data.cards.values()].map((c) => <option value={c.id}>{`${c.title} ${c.name}`.trim()}</option>)}
						</select></label>
						<label>Style <select name="style" value={style} onChange={(e) => setStyleChoice(e.currentTarget.value as Style)}>
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
					{!card && <p class="panel">Choose a Sim runner to see recommendations.</p>}
					{busy && <p class="panel">Computing... <button name="cancel" onClick={cancel}>Cancel</button></p>}
					<div class="picks">
						<PickList title="Ace" testId="ace-card" picks={result?.ace} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
						<PickList title="Core loop" testId="core-card" picks={result?.core} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
						<PickList title="Side loop" testId="side-card" picks={result?.side} candidates={byId} cardIds={cardIds} stale={stale} data={data} />
					</div>
					<VeteranList scores={vs.result} progress={vs.progress} stale={vs.stale} data={data} onCancel={vs.cancel} />
				</div>
			)}
			{data?.meta?.resourceVersion && <footer class="muted">Game data: resource version {data.meta.resourceVersion}, generated {formatAge(data.meta.generatedAt)}</footer>}
		</main>
	);
}
