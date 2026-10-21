// @vitest-environment jsdom
import { act } from 'preact/test-utils';
import { render } from 'preact';
import { beforeEach, expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { RawGameData } from '../../../packages/lineage/src/types';
import { CMS } from '../../../packages/scoring/src/cm';
import { App } from './App';
import { runJob } from './runJob';
import type { RecommendJob, RecommendRunner, VeteranJob, VeteranRunner } from './jobs';
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
	expect(root.querySelector('[data-testid=ace-pick]')).not.toBeNull();
	expect(root.querySelector('[data-testid=ace-parent]')).not.toBeNull();
	const heads = [...root.querySelectorAll('.results h3, .results > details > summary')].map((h) => h.textContent);
	expect(heads.slice(0, 4)).toEqual(['Ace', 'Side loop', 'Core loop', 'Ace veteran list']);
	expect(root.querySelector('.results > details')!.hasAttribute('open')).toBe(false);
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
	expect([...root.querySelectorAll('h2')].map((h) => h.textContent)).toContain('Sim runner');
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

it('shows the Ace as one combined skill list with a pick list of parents, and leaves the loops without it', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const rows = [...root.querySelectorAll('[data-testid=ace-skill-row]')];
	expect(rows.length).toBeGreaterThan(0);
	const row = rows.find((r) => r.textContent!.includes('Synthetic Skill'))!;
	expect(row.textContent).toMatch(/%.*proc/s);
	expect(row.textContent).toContain('*'); // position-conditioned: greyed and marked
	expect(row.classList.contains('muted')).toBe(true);
	const ace = root.querySelector('[data-testid=ace-parent]')!;
	expect(ace.querySelector('strong')!.textContent).toBeTruthy();
	expect(ace.querySelector('details, .headline')).toBeNull(); // no skill text, no per-parent score
	expect(root.querySelectorAll('[data-testid=side-pick] [data-testid=ace-skill-row], [data-testid=core-pick] [data-testid=ace-skill-row]').length).toBe(0);
	expect(root.querySelector('[data-testid=side-parent] details')).not.toBeNull(); // loops unchanged
});
