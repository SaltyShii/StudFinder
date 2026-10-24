// @vitest-environment jsdom
import { act } from 'preact/test-utils';
import { render } from 'preact';
import { beforeEach, expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { RawGameData } from '../../../packages/lineage/src/types';
import { CMS } from '../../../packages/scoring/src/cm';
import type { ComponentProps } from 'preact';
import { App as PlainApp } from './App';
import { runJob } from './runJob';
import type { AceRowsRunner, RecommendJob, RecommendRunner, VeteranJob, VeteranRunner } from './jobs';
import type { Recommendation } from '../../../packages/scoring/src/recommend';

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
const courses = Object.fromEntries(CMS.map((c) => [c.courseId, { id: c.courseId, trackId: 1, distance: 2000, ground: 1, turn: 1 }]));
const data = new GameData({
	meta: {}, charas: {},
	cards: {
		100101: { id: 100101, charaId: 1001, name: 'Ace', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [] },
		100201: { id: 100201, charaId: 1002, name: 'Stud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [10071] },
		100301: { id: 100301, charaId: 1003, name: 'Dud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [] },
	},
	skills: { 10071: { id: 10071, name: 'Synthetic Skill' }, 10072: { id: 10072, name: 'Racing Spirit: Stamina', rarity: 1, groupId: 9 } }, factors: {
		1201: { id: 1201, groupId: 12, type: 2, stars: 1, name: 'Dirt', targets: [], skillId: null },
		1202: { id: 1202, groupId: 4001, type: 4, stars: 3, name: 'Synthetic Spark', targets: [], skillId: 10071 },
	}, relations: { points: {}, members: {}, ranks: [] },
	saddles: {}, tracks: {}, courses, races: [],
} as unknown as RawGameData);

const computeRecommend = (job: RecommendJob) => runJob({ kind: 'recommend', job }, () => {}) as Recommendation;
const inline: RecommendRunner = (job, _p, done) => { done(computeRecommend(job)); return () => {}; };
const noV: VeteranRunner = () => () => {};
// Both carry a dirt spark, so the core loop (great-grandparents need one) lists them; Stud also carries a skill spark.
const exportText = JSON.stringify([
	// Dud's first parent is a friend's rental (owner_viewer_id), so the export also holds one borrowed veteran.
	{ trained_chara_id: 1, card_id: 100301, factor_id_array: [1201], succession_chara_array: [{ position_id: 10, card_id: 100201, owner_viewer_id: 777, factor_id_array: [1201] }] },
	{ trained_chara_id: 2, card_id: 100201, factor_id_array: [1201, 1202], succession_chara_array: [] },
]);
// Most tests below exercise the loop UI, which the default page hides behind a flag.
const App = (p: ComponentProps<typeof PlainApp>) => <PlainApp showLoops {...p} />;
const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

let root: HTMLElement;
beforeEach(() => { localStorage.clear(); root = document.createElement('div'); document.body.replaceChildren(root); });

async function importFile() {
	const input = root.querySelector('input[type=file]') as HTMLInputElement;
	Object.defineProperty(input, 'files', { value: [{ text: async () => exportText }] });
	await act(() => { input.dispatchEvent(new Event('change')); });
	await flush();
}

const click = (el: Element | null) => act(() => { (el as HTMLElement).click(); });
const run = () => click(root.querySelector('button[name=run]'));
const closeModal = () => click(root.querySelector('.modal-close'));

// Picks a real version in the Sim runner popup (the popup closes on pick); the default is the Generic runner.
async function chooseRunner(id = '100101') {
	await click(root.querySelector('button[name=choose-sim-runner]'));
	await click(root.querySelector(`.modal button[name=card][value="${id}"]`));
}
async function pickAce(id = '100101') {
	await chooseRunner(id);
	await run();
}

it('renders the ace list after importing an export, with expandable skill detail', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const cards = [...root.querySelectorAll('[data-testid=ace-card]')];
	expect(cards.length).toBe(2);
	expect(cards[0].textContent).toContain('Test Stud');
	expect(cards[0].querySelector('details')!.textContent).toMatch(/Synthetic Skill.*%.*position/s);
});

it('renders the core loop and side loop lists beside the ace list', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(root.querySelectorAll('[data-testid=ace-card]').length).toBe(2);
	for (const id of ['core', 'side']) {
		expect(root.querySelectorAll(`[data-testid=${id}-pick]`).length).toBe(2);
		expect(root.querySelectorAll(`[data-testid=${id}-parent]`).length).toBe(2); // each version excludes its own character, leaving one veteran
	}
});

it('lists exactly the veterans of the roster, with no owned controls', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const names = [...root.querySelectorAll('[data-testid=ace-card]')].map((c) => c.querySelector('strong')!.textContent);
	expect(names).toHaveLength(2);
	expect(names.every((n) => n!.includes('Rank score'))).toBe(true);
	expect(root.querySelector('input[name=owned-toggle]')).toBeNull();
	expect(root.querySelector('select[name=owned-filter]')).toBeNull();
});

it('scores borrowed veterans only when the toggle is on, and remembers it', async () => {
	const jobs: RecommendJob[] = [];
	const manual: RecommendRunner = (job) => { jobs.push(job); return () => {}; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(root.textContent).toContain('1 borrowed');
	expect(jobs.at(-1)!.candidateList.candidates.map((c) => c.id)).toEqual(['1', '2']);
	const box = root.querySelector('input[name=use-borrowed]') as HTMLInputElement;
	await act(() => { box.click(); });
	await run();
	const ids = jobs.at(-1)!.candidateList.candidates.map((c) => c.id);
	expect(ids).toHaveLength(3);
	expect(ids.some((id) => Number(id) < 0)).toBe(true);
	expect(jobs.at(-1)!.candidateList.candidates.find((c) => Number(c.id) < 0)!.name).toContain('borrowed from 777');
	expect(localStorage.getItem('stud-finder:use-borrowed')).toContain('true');
});

it('recomputes when an input changes and cancel stops the running job', async () => {
	const jobs: RecommendJob[] = [];
	let cancelled = 0;
	const manual: RecommendRunner = (job) => { jobs.push(job); return () => { cancelled++; }; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(jobs).toHaveLength(1);
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	style.value = 'nige';
	await act(() => { style.dispatchEvent(new Event('change')); });
	expect(jobs).toHaveLength(1); // nothing recomputes until Run
	expect(root.textContent).toContain('outdated');
	await run();
	expect(jobs).toHaveLength(2);
	expect(cancelled).toBe(1); // the stale job is dropped
	await act(() => { (root.querySelector('button[name=cancel]') as HTMLButtonElement).click(); });
	expect(cancelled).toBe(2);
	expect(root.textContent).not.toContain('Computing');
});

it('runs nothing until Run is pressed, starting with the Generic runner, then marks lists stale on change', async () => {
	const jobs: RecommendJob[] = [];
	const manual: RecommendRunner = (job) => { jobs.push(job); return () => {}; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	expect(jobs).toHaveLength(0);
	expect(root.querySelector('.empty')!.textContent).toContain('press Run');
	expect(root.querySelector('.sim-runner')!.textContent).toContain('Generic (all A)');
	await run();
	expect(jobs).toHaveLength(1);
	expect(jobs[0].preset.runner).toMatchObject({ distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', skills: [] });
	expect(jobs[0].candidateList.candidates.map((c) => c.id)).toEqual(['1', '2']);
	await chooseRunner();
	expect(jobs).toHaveLength(1);
	expect(root.textContent).toContain('outdated');
	await run();
	expect(jobs).toHaveLength(2);
	expect(jobs[1].candidateList.candidates.map((c) => c.id)).toEqual(['1', '2']);
});

it('disables Run without a Roster', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await flush();
	expect(root.querySelector<HTMLButtonElement>('button[name=run]')!.disabled).toBe(true);
});

it('persists the CM override, and Clear data drops it and the owned toggles of earlier versions', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS[0].id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
	expect(localStorage.getItem('stud-finder:cm')).toContain(String(CMS[0].id));
	localStorage.setItem('stud-finder:owned', JSON.stringify({ version: 1, overrides: { 1: true } }));
	await act(() => { (root.querySelector('button:not([name])') as HTMLButtonElement).click(); });
	expect(localStorage.getItem('stud-finder:owned')).toBeNull();
	expect(localStorage.getItem('stud-finder:cm')).toBeNull();
});

it('scores veterans on Run, reruns on CM change, and cancels', async () => {
	const jobs: VeteranJob[] = [];
	let cancelled = 0;
	const manual: VeteranRunner = (job, progress) => { jobs.push(job); progress([1, 2]); return () => { cancelled++; }; };
	render(<App loadData={async () => data} run={inline} runVeterans={manual} />, root);
	await importFile();
	await run();
	expect(jobs).toHaveLength(1);
	expect(root.textContent).toContain('Scoring 1/2');
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS.find((c) => c.id !== Number(cm.value))!.id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
	expect(jobs).toHaveLength(1);
	await run();
	expect(jobs).toHaveLength(2);
	expect(cancelled).toBe(1);
	await act(() => { (root.querySelector('button[name=cancel-veterans]') as HTMLButtonElement).click(); });
	expect(cancelled).toBe(2);
	expect(root.textContent).not.toContain('Scoring');
});

it('keeps the veteran scores on Run when nothing they depend on changed', async () => {
	const jobs: VeteranJob[] = [];
	const finish: VeteranRunner = (job, _p, done) => { jobs.push(job); done([]); return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={finish} />, root);
	await importFile();
	await run();
	expect(jobs).toHaveLength(1);
	await run(); // same CM, roster and assumptions: the scores on screen are current
	expect(jobs).toHaveLength(1);
	const style = root.querySelector('select[name=style]') as HTMLSelectElement; // the Sim runner does not enter the veterans' scores
	style.value = 'oikomi';
	await act(() => { style.dispatchEvent(new Event('change')); });
	await run();
	expect(jobs).toHaveLength(1);
	await click(root.querySelector('.sim-assumptions input[name=rushed]')); // a new assumption changes every score
	expect(jobs).toHaveLength(2);
});

it('rescores the veterans on Run after they were cancelled', async () => {
	let started = 0;
	const manual: VeteranRunner = () => { started++; return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={manual} />, root);
	await importFile();
	await run();
	await act(() => { (root.querySelector('button[name=cancel-veterans]') as HTMLButtonElement).click(); });
	await run();
	expect(started).toBe(2);
});

it('shows top 5 Ace veterans, expands to all, and notes ranking is relative only', async () => {
	const score = (i: number) => ({ trainedId: i, cardId: 100301, style: 'senko' as const, rankScore: 0, createdAt: '', skillsNotSimulated: 2, aptitude: { surface: 7, distance: 7 }, setLengthsGained: 1, gap: i, detail: [], assumesPosition: false });
	const seven: VeteranRunner = (_j, _p, done) => { done([0, 1, 2, 3, 4, 5, 6].map(score)); return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={seven} />, root);
	await importFile();
	await run();
	const cards = () => root.querySelectorAll('[data-testid=veteran-card]');
	expect(cards().length).toBe(5);
	expect(root.textContent).toContain('relative only');
	expect(root.textContent).toContain('surface A');
	expect(root.textContent).toContain('distance A');
	expect(root.textContent).toContain('2 skills not simulated');
	await act(() => { (root.querySelector('button[name=toggle-all-veterans]') as HTMLButtonElement).click(); });
	expect(cards().length).toBe(7);
});

it('renders veteran cards with portrait, best flag, grade chips and caveats, and survives a missing portrait', async () => {
	const score = (i: number) => ({ trainedId: i, cardId: 100301, style: 'senko' as const, rankScore: 0, createdAt: '', skillsNotSimulated: 2, aptitude: { surface: 7, distance: 6 }, setLengthsGained: 1, gap: i, detail: [], assumesPosition: i === 0 });
	const two: VeteranRunner = (_j, _p, done) => { done([score(0), score(1)]); return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={two} />, root);
	await importFile();
	await run();
	const [best, other] = [...root.querySelectorAll('[data-testid=veteran-card]')];
	expect(best.querySelector('img')!.getAttribute('src')).toContain('img/cards/100301.png');
	expect(best.hasAttribute('data-best')).toBe(true);
	expect(other.hasAttribute('data-best')).toBe(false);
	expect(best.textContent).toContain('surface A');
	expect(best.textContent).toContain('distance B');
	expect(best.textContent).toContain('assumes default position');
	expect(other.textContent).not.toContain('assumes default position');
	expect(best.textContent).toContain('2 skills not simulated');
	await act(() => { best.querySelector('img')!.dispatchEvent(new Event('error')); });
	expect(best.querySelector('img')).toBeNull();
	expect(best.querySelector('[data-testid=portrait-placeholder]')).not.toBeNull();
});

it('shows a portrait on pick cards', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(root.querySelector('[data-testid=ace-card] img')!.getAttribute('src')).toMatch(/img\/cards\/1002?01\.png/);
	for (const id of ['core-pick', 'side-pick']) expect(root.querySelector(`[data-testid=${id}]`)!.querySelector('img, [data-testid=portrait-placeholder]')).not.toBeNull();
	expect(root.querySelectorAll('.picks > section').length).toBe(2);
});

it('shows the Ace hero first, then Side and Core loops, with the Ace veteran list collapsed last', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(root.querySelector('[data-testid^=ace-pick]')).not.toBeNull();
	const heads = [...root.querySelectorAll('.results h3, .results > details > summary')].map((h) => h.textContent);
	expect(heads.slice(0, 5)).toEqual(['Ace', '2000m turf (right-handed)', 'Side loop', 'Core loop', 'Ace veteran list']);
	expect(root.querySelector('.results > details')!.hasAttribute('open')).toBe(false);
});

it('lists every fit Ace hero as a card, marking the ones that run in a fall-back style', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const cards = () => [...root.querySelectorAll('[data-testid^=ace-pick]')];
	expect(cards().map((c) => c.textContent)).toEqual([expect.stringContaining('Dud'), expect.stringContaining('Stud')]);
	expect(cards().every((c) => c.querySelector('.headline') && !c.textContent!.includes('fall-back'))).toBe(true);
	expect(cards().map((c) => c.getAttribute('data-testid'))).toEqual(['ace-pick-100301', 'ace-pick-100201']); // one id per hero
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	style.value = 'nige'; // D for every version: each falls back to Pace Chaser
	await act(() => { style.dispatchEvent(new Event('change')); });
	await run();
	expect(cards()).toHaveLength(2);
	expect(cards().every((c) => c.textContent!.includes('fall-back style'))).toBe(true);
});

it('marks every Ace hero card outdated when an input changes, and current again after Run', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const section = () => root.querySelector('[data-testid^=ace-pick]')!.closest('section')!;
	const cardLists = () => [...section().querySelectorAll('ol.hero-list')] as HTMLElement[];
	expect(section().getAttribute('aria-busy')).toBe('false');
	expect(cardLists().every((l) => l.style.opacity === '')).toBe(true);
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	style.value = 'nige';
	await act(() => { style.dispatchEvent(new Event('change')); });
	expect(section().getAttribute('aria-busy')).toBe('true');
	expect(section().querySelector('h3')!.textContent).toContain('outdated');
	expect(cardLists()).toHaveLength(1);
	expect(cardLists().every((l) => l.style.opacity === '0.5')).toBe(true);
	await run();
	expect(section().getAttribute('aria-busy')).toBe('false');
	expect(cardLists().every((l) => l.style.opacity === '')).toBe(true);
});

it('drops scores on cancel so they do not look current', async () => {
	const score = { trainedId: 1, cardId: 100301, style: 'senko' as const, rankScore: 0, createdAt: '', skillsNotSimulated: 0, aptitude: { surface: 7, distance: 7 }, setLengthsGained: 1, gap: 0, detail: [], assumesPosition: false };
	let first = true;
	const r: VeteranRunner = (_j, _p, done) => { if (first) { first = false; done([score]); } return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={r} />, root);
	await importFile();
	await run();
	expect(root.querySelectorAll('[data-testid=veteran-card]').length).toBe(1);
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS.find((c) => c.id !== Number(cm.value))!.id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
	await run();
	expect(root.querySelectorAll('[data-testid=veteran-card]').length).toBe(0);
});

it('gives the same ranking for the same inputs', () => {
	const job = { candidateList: { candidates: [{ id: 'a', name: 'A', horses: [{ affinity: 0, pinkStars: 0, dirtStars: 0, skills: [{ skillId: '10071', name: 'S', stars: 3 }] }] }] }, preset: { courseId: CMS[0].courseId, runner: { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const, samples: 20 } };
	expect(computeRecommend(job)).toEqual(computeRecommend(job));
});

it('shows a worker error, stops the busy state, drops the old result and clears the error on the next success', async () => {
	let fail = false;
	const r: RecommendRunner = (job, _p, done, onError) => { if (fail) onError(new Error('worker crashed')); else done(computeRecommend(job)); return () => {}; };
	render(<App loadData={async () => data} run={r} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const before = root.querySelectorAll('[data-testid=ace-card]').length;
	fail = true;
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	style.value = 'nige';
	await act(() => { style.dispatchEvent(new Event('change')); });
	await run();
	expect(root.querySelector('[role=alert]')?.textContent).toBe('worker crashed');
	expect(root.textContent).not.toContain('Computing');
	expect(root.querySelectorAll('[data-testid=ace-card]').length).toBe(0);
	expect(before).toBeGreaterThan(0);
	fail = false;
	style.value = 'oikomi';
	await act(() => { style.dispatchEvent(new Event('change')); });
	await run();
	expect(root.querySelector('[role=alert]')).toBeNull();
});

it('returns the Style to the best-ranked one when the Ace or CM changes', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	expect(style.value).toBe('senko'); // best aptitude on a middle-distance course
	const change = async (name: string, value: string) => {
		const sel = root.querySelector(`select[name=${name}]`) as HTMLSelectElement;
		sel.value = value;
		await act(() => { sel.dispatchEvent(new Event('change')); });
	};
	await change('style', 'nige');
	expect(style.value).toBe('nige');
	await pickAce('100301');
	expect(style.value).toBe('senko');
	await change('style', 'nige');
	await change('cm', String(CMS[1].id));
	expect(style.value).toBe('senko');
});

it('labels the Sim runner, not Ace, and shows the chosen one', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	expect(root.querySelector('[data-testid=top-bar] .sim-runner')!.textContent).toContain('Sim runner');
	await chooseRunner();
	expect(root.querySelector('.sim-runner')!.textContent).toContain('Test Ace');
	expect(root.querySelector('.modal')).toBeNull(); // a pick closes the popup
	await click(root.querySelector('button[name=choose-sim-runner]'));
	await click(root.querySelector('button[name=generic-runner]'));
	expect(root.querySelector('.sim-runner')!.textContent).toContain('Generic (all A)');
});

it('popups are labelled dialogs that take focus and close on X, Esc and backdrop click', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	const open = () => click(root.querySelector('button[name=edit-owned]'));
	await open();
	const dialog = root.querySelector('[role=dialog]')!;
	expect(dialog.getAttribute('aria-modal')).toBe('true');
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Owned versions');
	expect(dialog.contains(document.activeElement)).toBe(true);
	await closeModal();
	expect(root.querySelector('[role=dialog]')).toBeNull();
	await open();
	await act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
	expect(root.querySelector('[role=dialog]')).toBeNull();
	await open();
	await click(root.querySelector('.modal-backdrop'));
	expect(root.querySelector('[role=dialog]')).toBeNull();
	await open();
	await click(root.querySelector('.modal-body')); // a click inside stays open
	expect(root.querySelector('[role=dialog]')).not.toBeNull();
});

it('Core loop style follows the Sim runner style until overridden', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const change = async (name: string, value: string) => {
		const sel = root.querySelector(`select[name=${name}]`) as HTMLSelectElement;
		sel.value = value;
		await act(() => { sel.dispatchEvent(new Event('change')); });
	};
	const core = root.querySelector('select[name=core-style]') as HTMLSelectElement;
	expect(core.value).toBe('senko');
	await change('style', 'sashi');
	expect(core.value).toBe('sashi');
	await change('core-style', 'oikomi');
	await change('style', 'nige');
	expect(core.value).toBe('oikomi');
});

it('shows the Sim assumptions with umalator defaults, re-runs every slot on a change, resets and persists them', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, onError) => { jobs.push(job); return inline(job, p, done, onError); };
	const mount = () => render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root);
	mount();
	await importFile();
	const box = (name: string) => root.querySelector<HTMLInputElement>(`.sim-assumptions input[name=${name}]`)!;
	const flip = (name: string) => click(box(name));
	expect(box('witCheck').checked).toBe(false);
	for (const name of ['rushed', 'spotStruggle', 'laneMovement']) expect(box(name).checked).toBe(true);
	expect(box('dueling').checked).toBe(false);
	expect(root.querySelector('.sim-assumptions input[name=rate-frontRunner]')).toBeNull(); // rates show only while dueling is on
	await run();
	expect(jobs).toHaveLength(1);
	expect(jobs[0].preset.assumptions).toMatchObject({ witCheck: false, rushed: true, dueling: false });
	await flip('witCheck'); // results exist, so the change runs by itself
	expect(jobs).toHaveLength(2);
	expect(jobs[1].preset.assumptions!.witCheck).toBe(true);
	await flip('dueling');
	const rate = root.querySelector<HTMLInputElement>('.sim-assumptions input[name=rate-frontRunner]')!;
	rate.value = '40';
	await act(() => { rate.dispatchEvent(new Event('change')); });
	expect(jobs.at(-1)!.preset.assumptions).toMatchObject({ dueling: true, duelingRates: { frontRunner: 40 } });
	render(null, root);
	mount();
	await flush();
	await flush();
	expect(box('witCheck').checked).toBe(true);
	expect(box('rate-frontRunner').value).toBe('40');
	await click(root.querySelector('.sim-assumptions button[name=reset-assumptions]'));
	expect(box('witCheck').checked).toBe(false);
	expect(box('dueling').checked).toBe(false);
	expect(root.querySelector('.sim-assumptions input[name=rate-frontRunner]')).toBeNull();
});

it('shows the Skill point budget as 2700, passes it to the job, re-runs on a change, treats a cleared field as unlimited and persists it', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, onError) => { jobs.push(job); return inline(job, p, done, onError); };
	const mount = () => render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root);
	mount();
	await importFile();
	const field = () => root.querySelector<HTMLInputElement>('input[name=skill-point-budget]')!;
	const set = async (value: string) => { field().value = value; await act(() => { field().dispatchEvent(new Event('change')); }); };
	expect(field().value).toBe('2700');
	await run();
	expect(jobs[0].preset.skillPoints?.budget).toBe(2700);
	await set('1500'); // results exist, so the change runs by itself
	expect(jobs).toHaveLength(2);
	expect(jobs[1].preset.skillPoints?.budget).toBe(1500);
	await set('');
	expect(jobs).toHaveLength(3);
	expect(jobs[2].preset.skillPoints).toBeUndefined();
	render(null, root);
	mount();
	await flush();
	await flush();
	expect(field().value).toBe('');
});

it('shortlists Support cards in a searchable popup at max limit break, passes them to the job, re-runs on a change, and persists them', async () => {
	data.supportCards.set(10001, { id: 10001, charaId: 1, name: 'Alpha', title: '[T]', rarity: 3, type: 'speed', pool: [10071], hintFrequency: [20, 20, 20, 20, 30], hintLevelBonus: [0, 0, 0, 0, 2] });
	data.supportCards.set(10002, { id: 10002, charaId: 2, name: 'Beta', title: '[T]', rarity: 3, type: 'wit', pool: [10071], hintFrequency: [20, 20, 20, 20, 30], hintLevelBonus: [0, 0, 0, 0, 2] });
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, onError) => { jobs.push(job); return inline(job, p, done, onError); };
	const mount = () => render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root);
	mount();
	await importFile();
	await run();
	expect(jobs).toHaveLength(1);
	expect(jobs[0].preset.support).toBeUndefined();
	await click(root.querySelector('button[name=edit-support-own]'));
	const search = root.querySelector<HTMLInputElement>('.modal input[name=skill-search]')!;
	search.value = 'beta';
	await act(() => { search.dispatchEvent(new Event('input')); });
	expect(root.querySelectorAll('.modal [data-testid=skill-row]')).toHaveLength(1);
	await click(root.querySelector('.modal button[name=skill]'));
	await closeModal();
	expect(jobs).toHaveLength(2);
	expect(jobs[1].preset.support?.own).toEqual([{ card: expect.objectContaining({ id: 10002, pool: ['10071'] }), limitBreak: 4 }]);
	expect(jobs[1].preset.support?.borrowed).toEqual([]);
	const level = root.querySelector<HTMLSelectElement>('[data-testid=support-own] select[name=own-limit-break]')!;
	level.value = '1';
	await act(() => { level.dispatchEvent(new Event('change')); });
	expect(jobs).toHaveLength(3);
	expect(jobs[2].preset.support?.own[0].limitBreak).toBe(1);
	render(null, root);
	mount();
	await flush();
	await flush();
	expect(root.querySelector<HTMLSelectElement>('[data-testid=support-own] select')!.value).toBe('1');
	await click(root.querySelector('[data-testid=support-own] button[aria-label^=Remove]'));
	await run();
	expect(jobs.at(-1)!.preset.support).toBeUndefined();
	data.supportCards.clear();
});

it('sets the Type mix per CM and the trainings per card, passes both to the job, re-runs, and persists them', async () => {
	data.supportCards.set(10001, { id: 10001, charaId: 1, name: 'Alpha', title: '[T]', rarity: 3, type: 'speed', pool: [10071], hintFrequency: [20, 20, 20, 20, 30], hintLevelBonus: [0, 0, 0, 0, 2] });
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, onError) => { jobs.push(job); return inline(job, p, done, onError); };
	const mount = () => render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root);
	mount();
	await importFile();
	await run();
	await click(root.querySelector('button[name=edit-support-own]'));
	await click(root.querySelector('.modal button[name=skill]'));
	await closeModal();
	const count = () => jobs.length;
	expect(jobs.at(-1)!.preset.support).toMatchObject({ trainingsPerCard: 30 });
	expect(jobs.at(-1)!.preset.support?.typeMix).toBeUndefined();
	const field = (name: string) => root.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
	expect(field('mix-speed').value).toBe('0');
	expect(root.querySelector('[data-testid=type-mix-total]')!.textContent).toContain('0 / 6');
	const before = count();
	field('mix-speed').value = '4';
	await act(() => { field('mix-speed').dispatchEvent(new Event('input')); });
	field('mix-wit').value = '2';
	await act(() => { field('mix-wit').dispatchEvent(new Event('input')); });
	expect(count()).toBeGreaterThan(before);
	expect(jobs.at(-1)!.preset.support?.typeMix).toEqual({ speed: 4, wit: 2 });
	expect(root.querySelector('[data-testid=type-mix-total]')!.textContent).toContain('6 / 6');
	const mixed = count();
	field('trainings-per-card').value = '45';
	await act(() => { field('trainings-per-card').dispatchEvent(new Event('input')); });
	expect(count()).toBeGreaterThan(mixed);
	expect(jobs.at(-1)!.preset.support).toMatchObject({ trainingsPerCard: 45, typeMix: { speed: 4, wit: 2 } });
	render(null, root);
	mount();
	await flush();
	await flush();
	expect(field('mix-speed').value).toBe('4');
	expect(field('trainings-per-card').value).toBe('45');
	const cm = root.querySelector<HTMLSelectElement>('select[name=cm]')!;
	cm.value = String(CMS.find((c) => c.id !== Number(cm.value))!.id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
	expect(field('mix-speed').value).toBe('0');
	data.supportCards.clear();
});

it('shows it is recomputing after an assumption change, and runs nothing before the first Run', async () => {
	const jobs: RecommendJob[] = [];
	const manual: RecommendRunner = (job) => { jobs.push(job); return () => {}; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	await click(root.querySelector('.sim-assumptions input[name=rushed]'));
	expect(jobs).toHaveLength(0);
	await run();
	expect(jobs[0].preset.assumptions!.rushed).toBe(false);
	await click(root.querySelector('.sim-assumptions input[name=laneMovement]'));
	expect(jobs).toHaveLength(2);
	expect(root.textContent).toContain('Computing');
});

it('adds Must-have skills in a popup by search or suggestion chip, passes them to the job and persists them', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, onError) => { jobs.push(job); return inline(job, p, done, onError); };
	const mount = () => render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root);
	mount();
	await importFile();
	await pickAce();
	await click(root.querySelector('button[name=edit-must-haves]'));
	const chips = () => [...root.querySelectorAll<HTMLButtonElement>('button[data-testid=must-have-suggestion]')];
	expect(chips().map((c) => c.textContent)).toEqual(['+ Synthetic Skill']);
	await click(chips()[0]);
	const listed = () => [...root.querySelectorAll('[data-testid=must-have]')].map((e) => e.textContent);
	expect(listed()).toEqual(['Synthetic Skill ×']);
	const row = () => root.querySelector('.modal [data-testid=skill-row]')!;
	expect(row().classList.contains('selected')).toBe(true);
	expect(row().textContent).toContain('✓');
	expect(chips()).toHaveLength(0);
	await closeModal();
	await run();
	expect(jobs[jobs.length - 1].mustHaves).toEqual(['10071']);
	await click(root.querySelector('[data-testid=must-have] button'));
	expect(listed()).toEqual([]);
	await click(root.querySelector('button[name=edit-must-haves]'));
	expect([...root.querySelectorAll('.modal [data-testid=skill-row]')].map((r) => r.textContent)).toEqual(['+Racing Spirit: StaminaURA', '+Synthetic Skill']); // tiered first
	const search = root.querySelector('input[name=skill-search]') as HTMLInputElement;
	search.value = 'racing';
	await act(() => { search.dispatchEvent(new Event('input')); });
	expect([...root.querySelectorAll('.modal [data-testid=skill-row]')].map((r) => r.textContent)).toEqual(['+Racing Spirit: StaminaURA']); // tier badge
	search.value = 'synth';
	await act(() => { search.dispatchEvent(new Event('input')); });
	await click(root.querySelector('.modal button[name=skill]'));
	expect(listed()).toEqual(['Synthetic Skill ×']);
	render(null, root);
	mount();
	await flush();
	await flush();
	expect(listed()).toEqual(['Synthetic Skill ×']);
});

it('picks Owned versions in a popup grid, shows a summary, and persists the edit', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	expect(root.textContent).toContain('2 owned');
	await click(root.querySelector('button[name=edit-owned]'));
	const boxes = () => [...root.querySelectorAll<HTMLButtonElement>('.modal button[name=card]')];
	expect(boxes().map((b) => [b.value, b.getAttribute('aria-pressed')])).toEqual([['100101', 'false'], ['100201', 'true'], ['100301', 'true']]);
	expect(root.querySelector('.owned-grid img')!.getAttribute('src')).toContain('img/cards/100101.png');
	expect(root.querySelector('.modal')!.textContent).toContain('2 selected');
	await click(boxes()[0]);
	expect(boxes()[0].getAttribute('aria-pressed')).toBe('true');
	expect(localStorage.getItem('stud-finder:owned-versions')).toContain('100101');
	const search = root.querySelector('input[name=card-search]') as HTMLInputElement;
	search.value = 'stud';
	await act(() => { search.dispatchEvent(new Event('input')); });
	expect(boxes().map((b) => b.value)).toEqual(['100201']);
	await closeModal();
	expect(root.textContent).toContain('3 owned');
	render(null, root);
	await act(() => { render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root); });
	await flush();
	expect(root.textContent).toContain('3 owned');
	localStorage.setItem('stud-finder:owned-versions', JSON.stringify({ version: 99, ids: [100101] }));
	render(null, root);
	await act(() => { render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root); });
	await flush();
	expect(root.textContent).toContain('2 owned');
});

it('picks Loop versions in a popup of the owned versions only, defaults to all, persists, and sends them to the run', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, fail) => { jobs.push(job); return inline(job, p, done, fail); };
	const mount = async () => { render(null, root); await act(() => { render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root); }); await flush(); };
	await mount();
	await importFile();
	expect(root.textContent).toContain('2 of 2 loop versions');
	await run();
	expect(jobs.at(-1)!.loopVersions!.map((v) => v.cardId).sort()).toEqual([100201, 100301]);
	await click(root.querySelector('button[name=edit-loop]'));
	const boxes = () => [...root.querySelectorAll<HTMLButtonElement>('.modal button[name=card]')];
	expect(boxes().map((b) => [b.value, b.getAttribute('aria-pressed')])).toEqual([['100201', 'true'], ['100301', 'true']]);
	await click(boxes()[0]);
	expect(boxes().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
	expect(localStorage.getItem('stud-finder:loop-versions')).toContain('100301');
	await closeModal();
	expect(root.textContent).toContain('1 of 2 loop versions');
	await run();
	expect(jobs.at(-1)!.loopVersions!.map((v) => v.cardId)).toEqual([100301]);
	expect(jobs.at(-1)!.owned!.map((v) => v.cardId).sort()).toEqual([100201, 100301]);
	await mount();
	await run();
	expect(root.textContent).toContain('1 of 2 loop versions');
	expect(jobs.at(-1)!.loopVersions!.map((v) => v.cardId)).toEqual([100301]);
	localStorage.setItem('stud-finder:loop-versions', JSON.stringify({ version: 99, ids: [100301] }));
	await mount();
	expect(root.textContent).toContain('2 of 2 loop versions');
});

it('skips Unfit versions in the Ace slot only, lists them apart with the reason, and keeps the cutoff', async () => {
	const dud = data.cards.get(100301)!;
	const before = dud.aptitudes;
	dud.aptitudes = { ...apt, turf: 2 }; // Turf F: below the default cutoff D on the turf CM course
	try {
		const jobs: RecommendJob[] = [];
		const spy: RecommendRunner = (job, p, done, fail) => { jobs.push(job); return inline(job, p, done, fail); };
		const mount = async () => { render(null, root); await act(() => { render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root); }); await flush(); };
		const ids = (vs: { cardId: number }[] | undefined) => vs!.map((v) => v.cardId).sort();
		const cutoff = () => root.querySelector<HTMLSelectElement>('select[name=fit-cutoff]')!;
		const setCutoff = (letter: string) => { cutoff().value = String('GFEDCBAS'.indexOf(letter) + 1); return act(() => { cutoff().dispatchEvent(new Event('change')); }); };
		await mount();
		await importFile();
		expect(cutoff().selectedOptions[0].textContent).toContain('D');
		await run();
		expect(ids(jobs.at(-1)!.owned)).toEqual([100201]);
		expect(ids(jobs.at(-1)!.loopVersions)).toEqual([100201, 100301]);
		expect(jobs.at(-1)!.candidateList.candidates.length).toBeGreaterThan(0); // the Unfit version's veteran stays a parent candidate
		await click(root.querySelector('button[name=edit-owned]'));
		expect(root.querySelector('.modal [data-testid=unfit-versions]')!.textContent).toMatch(/Not simulated for this CM.*Dud.*Turf F/s);
		await closeModal();
		await setCutoff('G');
		await run();
		expect(ids(jobs.at(-1)!.owned)).toEqual([100201, 100301]);
		await setCutoff('S');
		expect(root.querySelector<HTMLButtonElement>('button[name=run]')!.disabled).toBe(true);
		expect(root.textContent).toContain('All owned versions are below S on this CM; force-enable one');
		await mount();
		expect(cutoff().selectedOptions[0].textContent).toContain('S');
		localStorage.setItem('stud-finder:fit-cutoff', JSON.stringify({ version: 99, grade: 1 }));
		await mount();
		expect(cutoff().selectedOptions[0].textContent).toContain('D');
	} finally { dud.aptitudes = before; }
});

it('marks Viable versions per CM on the Owned versions picker, narrows the Ace slot only, and persists the picks', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, fail) => { jobs.push(job); return inline(job, p, done, fail); };
	const mount = async () => { render(null, root); await act(() => { render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root); }); await flush(); };
	const ids = (vs: { cardId: number }[] | undefined) => vs!.map((v) => v.cardId).sort();
	const toggles = () => [...root.querySelectorAll<HTMLInputElement>('.modal input[name=viable]')];
	await mount();
	await importFile();
	await click(root.querySelector('button[name=edit-owned]'));
	expect(toggles().map((t) => [t.value, t.checked]).sort()).toEqual([['100201', false], ['100301', false]]);
	await click(toggles().find((t) => t.value === '100201') ?? null);
	expect(localStorage.getItem('stud-finder:viable-versions')).toContain('100201');
	await closeModal();
	await run();
	expect(ids(jobs.at(-1)!.owned)).toEqual([100201]);
	expect(ids(jobs.at(-1)!.loopVersions)).toEqual([100201, 100301]);
	await mount(); // across reloads
	await run();
	expect(ids(jobs.at(-1)!.owned)).toEqual([100201]);
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS.find((c) => String(c.id) !== cm.value)!.id); // a new CM starts empty
	await act(() => { cm.dispatchEvent(new Event('change')); });
	await run();
	expect(ids(jobs.at(-1)!.owned)).toEqual([100201, 100301]);
	localStorage.setItem('stud-finder:viable-versions', JSON.stringify({ version: 99, picks: {} }));
	await mount();
	await run();
	expect(ids(jobs.at(-1)!.owned)).toEqual([100201, 100301]);
});

it('force-enables an Unfit version for the Ace, keeps it across cutoff changes and reloads, and re-enables Run', async () => {
	const dud = data.cards.get(100301)!;
	const before = dud.aptitudes;
	dud.aptitudes = { ...apt, turf: 2 };
	try {
		const jobs: RecommendJob[] = [];
		const spy: RecommendRunner = (job, p, done, fail) => { jobs.push(job); return inline(job, p, done, fail); };
		const mount = async () => { render(null, root); await act(() => { render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root); }); await flush(); };
		const ids = (vs: { cardId: number }[] | undefined) => vs!.map((v) => v.cardId).sort();
		const cutoff = () => root.querySelector<HTMLSelectElement>('select[name=fit-cutoff]')!;
		const setCutoff = (letter: string) => { cutoff().value = String('GFEDCBAS'.indexOf(letter) + 1); return act(() => { cutoff().dispatchEvent(new Event('change')); }); };
		const force = () => root.querySelector<HTMLInputElement>('.modal [data-testid=unfit-versions] input[name=force-unfit]')!;
		await mount();
		await importFile();
		await click(root.querySelector('button[name=edit-owned]'));
		expect(force().checked).toBe(false);
		await click(force());
		expect(force().checked).toBe(true);
		expect(localStorage.getItem('stud-finder:forced-versions')).toContain('100301');
		await closeModal();
		await run();
		expect(ids(jobs.at(-1)!.owned)).toEqual([100201, 100301]);
		await setCutoff('A'); // the forced version stays forced when the cutoff changes
		await run();
		expect(ids(jobs.at(-1)!.owned)).toEqual([100201, 100301]);
		await mount(); // and across reloads
		await run();
		expect(ids(jobs.at(-1)!.owned)).toEqual([100201, 100301]);
		await setCutoff('S'); // both are unfit; only the forced one is simulated, so Run stays enabled
		expect(root.querySelector<HTMLButtonElement>('button[name=run]')!.disabled).toBe(false);
		await run();
		expect(ids(jobs.at(-1)!.owned)).toEqual([100301]);
		await click(root.querySelector('button[name=edit-owned]'));
		await click(force());
		await closeModal();
		expect(root.querySelector<HTMLButtonElement>('button[name=run]')!.disabled).toBe(true);
		localStorage.setItem('stud-finder:forced-versions', JSON.stringify({ version: 99, ids: [100301] }));
		await mount();
		await setCutoff('S');
		expect(root.querySelector<HTMLButtonElement>('button[name=run]')!.disabled).toBe(true);
	} finally { dud.aptitudes = before; }
});

it('edits the Tier list in a popup per Core loop style, resets it, and persists the edit', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, fail) => { jobs.push(job); return inline(job, p, done, fail); };
	const mount = async () => { render(null, root); await act(() => { render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root); }); await flush(); };
	await mount();
	await importFile();
	await run();
	const tier = () => jobs.at(-1)!.tierList!['Racing Spirit: Stamina'];
	const field = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
	const edit = () => click(field('button[name=edit-tiers]'));
	await edit();
	expect(tier()).toBe('URA');
	expect(field('.modal [data-testid=skill-row]').textContent).toContain('Racing Spirit: Stamina');
	const move = field<HTMLSelectElement>('select[name=tier-of][data-skill="Racing Spirit: Stamina"]');
	move.value = 'T5';
	await act(() => { move.dispatchEvent(new Event('change')); });
	await closeModal();
	await run();
	expect(tier()).toBe('T5');
	jobs.length = 0;
	await mount();
	await run();
	expect(tier()).toBe('T5'); // persisted
	await edit();
	const row = () => field('.modal [data-testid=skill-row]');
	expect(row().classList.contains('selected')).toBe(true);
	await click(field('.modal button[name=skill]')); // disable
	expect(row().classList.contains('selected')).toBe(false);
	await closeModal();
	await run();
	expect(jobs.at(-1)!.tierList).not.toHaveProperty(['Racing Spirit: Stamina']);
	const core = field<HTMLSelectElement>('select[name=core-style]');
	core.value = 'oikomi';
	await act(() => { core.dispatchEvent(new Event('change')); });
	await run();
	expect(tier()).toBe('URA'); // edits are per style
	core.value = 'nige'; // the Generic runner ranks nige first
	await act(() => { core.dispatchEvent(new Event('change')); });
	await edit();
	await click(field('button[name=tier-reset]'));
	await closeModal();
	await run();
	expect(tier()).toBe('URA');
	expect(localStorage.getItem('stud-finder:tier-edits')).not.toContain('Racing');
});

async function chooseCm(id: number) {
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
}

it('draws the Track overview of the selected CM on the Ace slot only, and redraws when the CM changes', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await chooseCm(1); // course 10606, 2400 m
	await pickAce();
	const overviews = root.querySelectorAll('[data-testid=track-overview]');
	expect(overviews.length).toBe(1);
	const overview = overviews[0];
	expect(overview.querySelector('svg')!.getAttribute('aria-label')).toContain('2400 m');
	expect(overview.querySelectorAll('[data-testid=section]').length).toBe(24);
	expect(overview.querySelectorAll('[data-testid=phase]').length).toBe(4);
	expect(overview.querySelector('[data-testid=speed-curve]')!.getAttribute('d')).toMatch(/^M/);
	// Labelled rows, text inside the strips, a speed axis and a height row.
	const labels = [...overview.querySelectorAll('.row-label > span')].map((l) => l.textContent);
	expect(labels).toEqual(['m/s', 'height', 'slope', 'track', 'phase', 'section', 'metres']);
	expect(overview.querySelector('[data-testid=course-title]')!.textContent).toBe('2000m turf (right-handed)');
	expect(overview.querySelector('.spurt-info')!.textContent).toMatch(/^Last spurt from [\d,]+m/);
	expect(overview.querySelector('[data-testid=fx-legend]')!.textContent).toContain('only speed helps');
	expect(overview.closest('[data-testid=chart-scroll]')).not.toBeNull(); // scrolls sideways on narrow screens
	expect(overview.querySelector('[data-testid=height-profile]')!.getAttribute('d')).toMatch(/^M/);
	expect([...overview.querySelectorAll('[data-testid=phase]')].map((p) => p.textContent)).toEqual(['Early-race400m', 'Mid-race1,600m', 'Late-race2,000m', 'Last spurt']);
	for (const s of overview.querySelectorAll('[data-testid=slope]')) expect(s.textContent).toMatch(/^(Uphill|Downhill)/);
	expect([...overview.querySelectorAll('[data-testid=straight]')].every((s) => s.textContent!.startsWith('Straight'))).toBe(true);
	expect([...overview.querySelectorAll('[data-testid=corner]')].map((c) => c.textContent)).toEqual([...overview.querySelectorAll('[data-testid=corner]')].map(() => expect.stringMatching(/^Corner [↺↻][1-4]/)));
	// Event bands sit in the panel body behind the rows and the skill chart.
	const bands = [...overview.querySelectorAll('.bands [data-testid=event-band]')];
	expect(bands.map((b) => b.textContent)).toEqual(['Start', 'Pace change', 'Last-spurt kick']);
	expect(overview.querySelector('.track-rows > .bands')!.nextElementSibling!.classList.contains('track-row')).toBe(true);
	await chooseCm(2); // course 10811, 3200 m
	await run();
	expect(root.querySelector('[data-testid=track-overview] svg')!.getAttribute('aria-label')).toContain('3200 m');
});

it('shows the Ace as one combined skill list with a pick list of parents, and leaves the loops without it', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const rows = [...root.querySelectorAll('[data-testid=ace-skill-row]')];
	expect(rows.length).toBeGreaterThan(0);
	const row = rows.find((r) => r.textContent!.includes('Synthetic Skill'))!;
	expect(row.querySelector('.skill-lengths')!.textContent).toMatch(/^[+-]\d+\.\d\d L$/);
	expect(row.querySelector('.skill-proc')!.textContent).toMatch(/^\d+%$/);
	expect(row.querySelector('.rarity-dot')!.getAttribute('title')).toMatch(/\d+% inherited/);
	expect(row.textContent).toContain('*'); // position-conditioned: greyed and marked
	expect(row.classList.contains('muted')).toBe(true);
	expect(row.closest('.skill-panel')).not.toBeNull(); // its own panel under the overview
	expect(row.closest('[data-testid=track-overview]')).toBeNull();
	expect(row.querySelectorAll('[data-testid=spot-density], [data-testid=spot-pin], [data-testid=spot-block]').length).toBeGreaterThan(0);
	expect(root.querySelectorAll('[data-testid=side-pick] [data-testid=ace-skill-row], [data-testid=core-pick] [data-testid=ace-skill-row]').length).toBe(0);
	expect(root.querySelector('[data-testid=side-parent] details')).not.toBeNull(); // loops unchanged
});

it('lists the Ace skills as a table with Speed, Acceleration, Recovery and Other tabs, Speed first', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const tabs = () => [...root.querySelectorAll('[data-testid=skill-tabs]')[0].querySelectorAll('[role=tab]')];
	expect(tabs().map((t) => t.textContent)).toEqual(['Speed', 'Acceleration', 'Recovery', 'Other']);
	expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
	expect([...root.querySelectorAll('.skill-table .skill-head')[0].children].map((h) => h.textContent)).toEqual(['', 'Skill', 'Lengths gained', 'Proc', 'Activation spotswhitegoldinherited unique']);
	const names = () => [...root.querySelectorAll('.skill-table')[0].querySelectorAll('[data-testid=ace-skill-row] .skill-name')].map((n) => n.textContent);
	expect(names().some((n) => n!.includes('Synthetic Skill'))).toBe(true); // target speed
	await act(async () => { (tabs()[1] as HTMLElement).click(); });
	expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
	expect(names().some((n) => n!.includes('Synthetic Skill'))).toBe(false); // each skill in one tab only
});

it('shows the app title, the selected CM with its course and the Ace running style in the header, and follows changes', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	const header = () => root.querySelector('header[data-testid=app-header]')!;
	expect(header().querySelector('h1')!.textContent).toBe('Stud Finder');
	const pick = async (name: string, value: string) => {
		const el = root.querySelector(`select[name=${name}]`) as HTMLSelectElement;
		el.value = value;
		await act(() => { el.dispatchEvent(new Event('change')); });
	};
	await pick('cm', String(CMS[1].id));
	expect(header().querySelector('[data-testid=header-cm]')!.textContent).toContain(CMS[1].name);
	expect(header().querySelector('[data-testid=header-cm]')!.textContent).toContain('2000m');
	await pick('cm', String(CMS[0].id));
	expect(header().querySelector('[data-testid=header-cm]')!.textContent).toContain(CMS[0].name);
	await pick('style', 'nige');
	expect(header().querySelector('[data-testid=style-badge]')!.textContent).toBe('Front Runner');
	await pick('style', 'oikomi');
	expect(header().querySelector('[data-testid=style-badge]')!.textContent).toBe('End Closer');
});

it('charts the selected Side loop pick with the same tabs, table and footnote as the Ace, and follows the selection', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const chart = () => root.querySelector('[data-testid=side-chart]')!;
	expect(chart()).not.toBeNull();
	expect(chart().querySelector('.chart-title')!.textContent).toMatch(/^Side loop skills: /);
	expect([...chart().querySelectorAll('[data-testid=skill-tabs] [role=tab]')].map((t) => t.textContent)).toEqual(['Speed', 'Acceleration', 'Recovery', 'Other']);
	expect(chart().querySelectorAll('.skill-table [data-testid=ace-skill-row]').length).toBeGreaterThan(0);
	expect(chart().querySelector('[data-testid=skill-footnote]')).not.toBeNull();
	// Side loop tabs are their own: switching them leaves the Ace chart alone.
	const aceTabs = [...root.querySelectorAll('[data-testid=skill-tabs]')][0];
	await click(chart().querySelectorAll('[role=tab]')[1]);
	expect(chart().querySelectorAll('[role=tab]')[1].getAttribute('aria-selected')).toBe('true');
	expect(aceTabs.querySelectorAll('[role=tab]')[0].getAttribute('aria-selected')).toBe('true');
	// Selecting another pick moves the chart to it.
	const buttons = [...root.querySelectorAll('[data-testid=side-select]')];
	expect(buttons.length).toBeGreaterThan(1);
	expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
	const first = chart().querySelector('.chart-title')!.textContent;
	await click(buttons[1]);
	expect(root.querySelectorAll('[data-testid=side-select]')[1].getAttribute('aria-pressed')).toBe('true');
	expect(chart().querySelector('.chart-title')!.textContent).not.toBe(first);
	expect(chart().querySelector('[data-testid=side-chart-empty]')).not.toBeNull(); // this lineage carries no simulated skill
});

it('opens any Ace hero on click, building its chart rows once, until the inputs change', async () => {
	const asked: number[][] = [];
	let answer: (() => void) | undefined;
	const runRows: AceRowsRunner = (job, _p, done) => { asked.push(job.owned!.map((v) => v.cardId)); answer = () => done([]); return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={noV} runRows={runRows} />, root);
	await importFile();
	await pickAce();
	const buttons = () => [...root.querySelectorAll('[data-testid^=ace-select-]')];
	const loading = () => root.querySelector('[data-testid=ace-chart-loading]');
	expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
	expect(asked).toEqual([]); // the first hero's rows come with the ranking
	await click(buttons()[1]);
	expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
	expect(asked).toEqual([[100201]]);
	expect(loading()).not.toBeNull();
	await act(() => answer!());
	expect(loading()).toBeNull();
	await click(buttons()[0]);
	await click(buttons()[1]);
	expect(asked).toHaveLength(1); // opened once, kept
	expect(loading()).toBeNull();
	// New inputs: the next result opens the first hero again and forgets the rows.
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	style.value = 'nige';
	await act(() => { style.dispatchEvent(new Event('change')); });
	await run();
	expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
	expect(asked).toHaveLength(1); // the old selection asks nothing of the new result
	await click(buttons()[1]);
	expect(asked).toHaveLength(2);
	expect(loading()).not.toBeNull();
});

// The default page: loop UI hidden, Ace slot only.
const HIDDEN_HEADINGS = ['Side loop', 'Core loop', 'Ace veteran list'];

it('hides the loop sections and their controls by default, and runs no veteran job', async () => {
	const jobs: VeteranJob[] = [];
	const spy: VeteranRunner = (job) => { jobs.push(job); return () => {}; };
	render(<PlainApp loadData={async () => data} run={inline} runVeterans={spy} />, root);
	await importFile();
	await pickAce();
	const headings = [...root.querySelectorAll('h2, h3, summary, legend, label')].map((h) => h.textContent!);
	for (const h of [...HIDDEN_HEADINGS, 'Loop versions', 'Core loop style', 'Tier list', 'Must-have skills']) expect(headings.some((t) => t.includes(h))).toBe(false);
	expect(root.querySelector('select[name=core-style]')).toBeNull();
	expect(root.querySelector('[data-testid=side-chart]')).toBeNull();
	expect(root.querySelector('[data-testid=side-pick]')).toBeNull();
	expect(jobs).toHaveLength(0);
	expect(root.querySelector('[data-testid^=ace-pick]')).not.toBeNull();
});

it('shows the loop sections again with the flag on', async () => {
	render(<PlainApp showLoops loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const headings = [...root.querySelectorAll('h2, h3, summary, label')].map((h) => h.textContent!);
	for (const h of ['Side loop', 'Core loop', 'Ace veteran list', 'Loop versions', 'Core loop style', 'Tier list', 'Must-have skills']) expect(headings.some((t) => t.includes(h))).toBe(true);
});

it('leaves saved loop settings and Must-haves in storage while hidden', async () => {
	// Versioned like the real saves, so a loader that accepted them would show up as a rewrite or a wipe.
	const saved = {
		'stud-finder:must-haves': JSON.stringify({ version: 1, ids: ['10071'] }),
		'stud-finder:loop-versions': JSON.stringify({ version: 1, ids: [100201] }),
		'stud-finder:tier-edits': JSON.stringify({ version: 1, edits: { Racing: { moved: {}, disabled: ['Synthetic Skill'] } } }),
	};
	for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
	render(<PlainApp loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	for (const [k, v] of Object.entries(saved)) expect(localStorage.getItem(k)).toBe(v);
});

it('puts the main actions in a top bar and the other options in a collapsed Settings section', async () => {
	render(<PlainApp loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	const bar = root.querySelector('[data-testid=top-bar]')!;
	expect(bar.querySelector('h1')!.textContent).toBe('Stud Finder');
	for (const sel of ['input[type=file]', 'select[name=cm]', 'button[name=choose-sim-runner]', 'select[name=style]', 'button[name=run]']) expect(bar.querySelector(sel)).not.toBeNull();
	const settings = root.querySelector('details[data-testid=settings]')!;
	expect(settings.hasAttribute('open')).toBe(false);
	expect(settings.querySelector('summary')!.textContent).toBe('Settings');
	for (const sel of ['input[name=speed]', 'input[name=use-borrowed]']) expect(settings.querySelector(sel)).not.toBeNull();
	expect(settings.textContent).toContain('Owned versions');
	expect(settings.textContent).toContain('Sim assumptions');
	await run();
	expect(bar.querySelector('button[name=run]')).not.toBeNull();
});

it('shows Cancel in the top bar while computing', async () => {
	const manual: RecommendRunner = () => () => {};
	render(<PlainApp loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	await run();
	expect(root.querySelector('[data-testid=top-bar] button[name=cancel]')).not.toBeNull();
});

it('lists the Ace heroes compactly with name, running style and expected lengths, and selects one', async () => {
	render(<PlainApp loadData={async () => data} run={inline} runVeterans={noV} runRows={() => () => {}} />, root);
	await importFile();
	await pickAce();
	const rows = [...root.querySelectorAll('[data-testid^=ace-pick]')];
	expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['ace-pick-100301', 'ace-pick-100201']);
	expect(rows[0].textContent).toContain('Dud');
	expect(rows[0].textContent).toContain('Pace Chaser');
	expect(rows[0].querySelector('[data-testid=hero-lengths]')!.textContent).toMatch(/^\d+\.\d{2} lengths$/);
	expect(rows[0].querySelector('.chip')).toBeNull(); // compact: no aptitude chips
	expect(root.querySelector('[data-testid=ace-select-100301]')!.getAttribute('aria-pressed')).toBe('true');
	await click(root.querySelector('[data-testid=ace-select-100201]'));
	expect(root.querySelector('[data-testid=ace-select-100201]')!.getAttribute('aria-pressed')).toBe('true');
	expect(root.querySelector('[data-testid=ace-select-100301]')!.getAttribute('aria-pressed')).toBe('false');
});

it('keeps the Track overview and skill panel for the selected hero', async () => {
	render(<PlainApp loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(root.textContent).toContain('2000m turf');
	expect(root.querySelector('.skill-table')).not.toBeNull();
});

// The Ace picks with sparks on their horses; the roster fixture itself carries no pink sparks.
const withSparks: RecommendRunner = (job, _p, done) => {
	const rec = computeRecommend(job);
	const spark = (pinkStars: number, dirtStars: number, cardId: number) => ({ cardId, affinity: 0, pinkStars, dirtStars, turfStars: 0, skills: [] });
	rec.aceSlots[0].horses = [[spark(3, 2, 100201), spark(0, 0, 100301), spark(1, 0, 100201)], [spark(0, 0, 100301), spark(0, 0, 100301), spark(0, 0, 100201)]];
	done(rec);
	return () => {};
};

it('draws the selected Ace hero as a lineage tree with spark chips and redraws on another pick', async () => {
	render(<App loadData={async () => data} run={withSparks} runVeterans={noV} runRows={() => () => {}} />, root);
	await importFile();
	await pickAce();
	const tree = () => root.querySelector('[data-testid=lineage-tree]')!;
	expect(tree().querySelectorAll('[data-testid=tree-parent]').length).toBe(2);
	expect(tree().querySelectorAll('[data-testid=tree-grandparent]').length).toBe(4);
	const parents = [...tree().querySelectorAll('[data-testid=tree-parent]')];
	expect([...parents[0].querySelectorAll('.chip-pink')].map((c) => c.textContent)).toEqual(['Distance 3', 'Dirt 2']);
	expect(parents[0].querySelector('.chip-blue')).toBeNull(); // aptitude sparks are all pink
	expect(parents[1].querySelector('.chip')).toBeNull(); // a pair without sparks shows none
	await click(root.querySelector('[data-testid=ace-select-100201]'));
	expect(tree().textContent).not.toContain('Distance 3'); // the other hero keeps its own horses
});

it('shows no chips on the hero list rows or the Ace node', async () => {
	render(<App loadData={async () => data} run={withSparks} runVeterans={noV} runRows={() => () => {}} />, root);
	await importFile();
	await pickAce();
	expect(root.querySelector('.hero-list .chip')).toBeNull();
	expect(root.querySelector('[data-testid=tree-ace] .chip')).toBeNull();
});
