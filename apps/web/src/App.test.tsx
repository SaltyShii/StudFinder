// @vitest-environment jsdom
import { act } from 'preact/test-utils';
import { render } from 'preact';
import { beforeEach, expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import type { RawGameData } from '../../../packages/lineage/src/types';
import { CMS } from '../../../packages/scoring/src/cm';
import { App } from './App';
import { compute, type Job, type Runner, type VeteranJob, type VeteranRunner } from './job';

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
const courses = Object.fromEntries(CMS.map((c) => [c.courseId, { id: c.courseId, trackId: 1, distance: 2000, ground: 1, turn: 1 }]));
const data = new GameData({
	meta: {}, charas: {},
	cards: {
		100101: { id: 100101, charaId: 1001, name: 'Ace', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [] },
		100201: { id: 100201, charaId: 1002, name: 'Stud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [10071] },
		100301: { id: 100301, charaId: 1003, name: 'Dud', title: 'Test', aptitudes: apt, uniqueSkillId: null, skillIds: [] },
	},
	skills: { 10071: { id: 10071, name: 'Synthetic Skill' } }, factors: {}, relations: { points: {}, members: {}, ranks: [] },
	saddles: {}, tracks: {}, courses, races: [],
} as unknown as RawGameData);

const inline: Runner = (job, done) => { done(compute(job)); return () => {}; };
const noV: VeteranRunner = () => () => {};
const exportText = JSON.stringify([{ trained_chara_id: 1, card_id: 100301, succession_chara_array: [] }]);
const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

let root: HTMLElement;
beforeEach(() => { localStorage.clear(); root = document.createElement('div'); document.body.replaceChildren(root); });

async function importFile() {
	const input = root.querySelector('input[type=file]') as HTMLInputElement;
	Object.defineProperty(input, 'files', { value: [{ text: async () => exportText }] });
	await act(() => { input.dispatchEvent(new Event('change')); });
	await flush();
}

async function pickAce(id = '100101') {
	const sel = root.querySelector('select[name=ace]') as HTMLSelectElement;
	sel.value = id;
	await act(() => { sel.dispatchEvent(new Event('change')); });
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
	for (const id of ['ace-card', 'core-card', 'side-card']) expect(root.querySelectorAll(`[data-testid=${id}]`).length).toBe(2);
});

it('badges owned outfits, filters without recomputing, and persists manual owned toggles', async () => {
	const jobs: Job[] = [];
	const counting: Runner = (job, done) => { jobs.push(job); done(compute(job)); return () => {}; };
	render(<App loadData={async () => data} run={counting} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	const cards = () => [...root.querySelectorAll('[data-testid=ace-card]')];
	const owned = () => cards().filter((c) => c.querySelector('[data-testid=owned-badge]'));
	expect(owned().length).toBe(1); // Dud, from the export
	expect(owned()[0].textContent).toContain('Test Dud');

	const before = jobs.length;
	const filter = root.querySelector('select[name=owned-filter]') as HTMLSelectElement;
	for (const [v, n] of [['owned', 1], ['not-owned', 1], ['all', 2]] as const) {
		filter.value = v;
		await act(() => { filter.dispatchEvent(new Event('change')); });
		expect(cards().length).toBe(n);
		for (const id of ['core-card', 'side-card']) expect(root.querySelectorAll(`[data-testid=${id}]`).length).toBe(n);
	}
	expect(jobs.length).toBe(before);

	const scoreOf = (n: string) => cards().find((c) => c.textContent!.includes(n))!.querySelector('em')!.previousSibling!.textContent;
	const dudBefore = scoreOf('Test Dud');
	const stud = cards().find((c) => c.textContent!.includes('Test Stud'))!;
	await act(() => { (stud.querySelector('input[name=owned-toggle]') as HTMLInputElement).click(); });
	expect(jobs.length).toBe(before + 1);
	expect(scoreOf('Test Dud')).toBe(dudBefore); // Dud has no skills, unaffected
	expect(owned().length).toBe(2);

	render(null, root);
	render(<App loadData={async () => data} run={counting} runVeterans={noV} />, root);
	await flush();
	await flush();
	await pickAce();
	expect(owned().length).toBe(2); // survives reload
});

it('recomputes when an input changes and cancel stops the running job', async () => {
	const jobs: Job[] = [];
	let cancelled = 0;
	const manual: Runner = (job) => { jobs.push(job); return () => { cancelled++; }; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	await pickAce();
	expect(jobs).toHaveLength(1);
	const style = root.querySelector('select[name=style]') as HTMLSelectElement;
	style.value = 'nige';
	await act(() => { style.dispatchEvent(new Event('change')); });
	expect(jobs).toHaveLength(2);
	expect(cancelled).toBe(1); // the stale job is dropped
	await act(() => { (root.querySelector('button[name=cancel]') as HTMLButtonElement).click(); });
	expect(cancelled).toBe(2);
	expect(root.textContent).not.toContain('Computing');
});

it('shows a prompt and runs no job until an Ace is chosen, and marks lists stale on restart', async () => {
	const jobs: Job[] = [];
	const manual: Runner = (job) => { jobs.push(job); return () => {}; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	expect(jobs).toHaveLength(0);
	expect(root.textContent).toContain('Choose an Ace');
	await pickAce();
	expect(jobs).toHaveLength(1);
	expect(root.textContent).toContain('outdated');
	expect(jobs[0].roster.outfits.map((o) => o.id)).not.toContain('100101');
});

it('persists the CM override and clears owned overrides with Clear data', async () => {
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

it('scores veterans without an Ace, reruns on CM change, and cancels', async () => {
	const jobs: VeteranJob[] = [];
	let cancelled = 0;
	const manual: VeteranRunner = (job, progress) => { jobs.push(job); progress(1, 2); return () => { cancelled++; }; };
	render(<App loadData={async () => data} run={inline} runVeterans={manual} />, root);
	await importFile();
	expect(jobs).toHaveLength(1);
	expect(root.textContent).toContain('Scoring 1/2');
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS.find((c) => c.id !== Number(cm.value))!.id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
	expect(jobs).toHaveLength(2);
	expect(cancelled).toBe(1);
	await act(() => { (root.querySelector('button[name=cancel-veterans]') as HTMLButtonElement).click(); });
	expect(cancelled).toBe(2);
	expect(root.textContent).not.toContain('Scoring');
});

it('shows top 5 Ace veterans, expands to all, and notes ranking is relative only', async () => {
	const score = (i: number) => ({ trainedId: i, cardId: 100301, style: 'senko' as const, rankScore: 0, createdAt: '', skillsNotSimulated: 2, aptitude: { surface: 7, distance: 7 }, lengthsGained: 1, gap: i, detail: [], assumesPosition: false });
	const seven: VeteranRunner = (_j, _p, done) => { done([0, 1, 2, 3, 4, 5, 6].map(score)); return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={seven} />, root);
	await importFile();
	const cards = () => root.querySelectorAll('[data-testid=veteran-card]');
	expect(cards().length).toBe(5);
	expect(root.textContent).toContain('relative only');
	expect(root.textContent).toContain('surface A, distance A');
	expect(root.textContent).toContain('2 skills not simulated');
	await act(() => { (root.querySelector('button[name=toggle-all-veterans]') as HTMLButtonElement).click(); });
	expect(cards().length).toBe(7);
});

it('drops scores on cancel so they do not look current', async () => {
	const score = { trainedId: 1, cardId: 100301, style: 'senko' as const, rankScore: 0, createdAt: '', skillsNotSimulated: 0, aptitude: { surface: 7, distance: 7 }, lengthsGained: 1, gap: 0, detail: [], assumesPosition: false };
	let first = true;
	const r: VeteranRunner = (_j, _p, done) => { if (first) { first = false; done([score]); } return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={r} />, root);
	await importFile();
	expect(root.querySelectorAll('[data-testid=veteran-card]').length).toBe(1);
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS.find((c) => c.id !== Number(cm.value))!.id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
	expect(root.querySelectorAll('[data-testid=veteran-card]').length).toBe(0);
});

it('gives the same ranking for the same inputs', () => {
	const job = { roster: { outfits: [{ id: 'a', name: 'A', owned: false, skillIds: ['10071'] }] }, preset: { courseId: CMS[0].courseId, ace: { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const, samples: 20 } };
	expect(compute(job)).toEqual(compute(job));
});
