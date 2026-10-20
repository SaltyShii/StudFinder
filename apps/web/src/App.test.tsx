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
	expect(jobs).toHaveLength(2);
	expect(cancelled).toBe(1); // the stale job is dropped
	await act(() => { (root.querySelector('button[name=cancel]') as HTMLButtonElement).click(); });
	expect(cancelled).toBe(2);
	expect(root.textContent).not.toContain('Computing');
});

it('shows a prompt and runs no job until a Sim runner is chosen, and marks lists stale on restart', async () => {
	const jobs: RecommendJob[] = [];
	const manual: RecommendRunner = (job) => { jobs.push(job); return () => {}; };
	render(<App loadData={async () => data} run={manual} runVeterans={noV} />, root);
	await importFile();
	expect(jobs).toHaveLength(0);
	expect(root.textContent).toContain('Choose a Sim runner');
	await pickAce();
	expect(jobs).toHaveLength(1);
	expect(root.textContent).toContain('outdated');
	expect(jobs[0].candidateList.candidates.map((c) => c.id)).toEqual(['1', '2']);
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

it('scores veterans without an Ace, reruns on CM change, and cancels', async () => {
	const jobs: VeteranJob[] = [];
	let cancelled = 0;
	const manual: VeteranRunner = (job, progress) => { jobs.push(job); progress([1, 2]); return () => { cancelled++; }; };
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
	const score = (i: number) => ({ trainedId: i, cardId: 100301, style: 'senko' as const, rankScore: 0, createdAt: '', skillsNotSimulated: 2, aptitude: { surface: 7, distance: 7 }, setLengthsGained: 1, gap: i, detail: [], assumesPosition: false });
	const seven: VeteranRunner = (_j, _p, done) => { done([0, 1, 2, 3, 4, 5, 6].map(score)); return () => {}; };
	render(<App loadData={async () => data} run={inline} runVeterans={seven} />, root);
	await importFile();
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
	for (const id of ['core-card', 'side-card']) expect(root.querySelector(`[data-testid=${id}]`)!.querySelector('img, [data-testid=portrait-placeholder]')).not.toBeNull();
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
	expect(root.querySelectorAll('[data-testid=veteran-card]').length).toBe(1);
	const cm = root.querySelector('select[name=cm]') as HTMLSelectElement;
	cm.value = String(CMS.find((c) => c.id !== Number(cm.value))!.id);
	await act(() => { cm.dispatchEvent(new Event('change')); });
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
	expect(root.querySelector('[role=alert]')?.textContent).toBe('worker crashed');
	expect(root.textContent).not.toContain('Computing');
	expect(root.querySelectorAll('[data-testid=ace-card]').length).toBe(0);
	expect(before).toBeGreaterThan(0);
	fail = false;
	style.value = 'oikomi';
	await act(() => { style.dispatchEvent(new Event('change')); });
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

it('labels the selector Sim runner, not Ace', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	const label = root.querySelector('select[name=ace]')!.closest('label')!;
	expect(label.firstChild!.textContent).toBe('Sim runner ');
	expect([...root.querySelectorAll('h2')].map((h) => h.textContent)).toContain('Sim runner');
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

it('adds Must-have skills by search or suggestion chip, passes them to the job and persists them', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, onError) => { jobs.push(job); return inline(job, p, done, onError); };
	const mount = () => render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root);
	mount();
	await importFile();
	await pickAce();
	const chips = () => [...root.querySelectorAll<HTMLButtonElement>('button[data-testid=must-have-suggestion]')];
	expect(chips().map((c) => c.textContent)).toEqual(['Synthetic Skill']);
	await act(() => { chips()[0].click(); });
	const listed = () => [...root.querySelectorAll('[data-testid=must-have]')].map((e) => e.textContent);
	expect(listed()).toEqual(['Synthetic Skill remove']);
	expect(jobs[jobs.length - 1].mustHaves).toEqual(['10071']);
	await act(() => { root.querySelector<HTMLButtonElement>('[data-testid=must-have] button')!.click(); });
	expect(listed()).toEqual([]);
	const search = root.querySelector('input[name=must-have-search]') as HTMLInputElement;
	search.value = 'synth';
	await act(() => { search.dispatchEvent(new Event('input')); });
	await act(() => { root.querySelector<HTMLButtonElement>('button[data-testid=must-have-result]')!.click(); });
	expect(listed()).toEqual(['Synthetic Skill remove']);
	render(null, root);
	mount();
	await flush();
	expect(listed()).toEqual(['Synthetic Skill remove']);
});

it('prefills Owned versions from the Roster, lets the player edit them, and persists the edit', async () => {
	render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root);
	await importFile();
	const boxes = () => [...root.querySelectorAll<HTMLInputElement>('input[name=owned-version]')];
	expect(boxes().map((b) => [b.value, b.checked])).toEqual([['100101', false], ['100201', true], ['100301', true]]);
	expect(root.querySelector('.owned-grid img')!.getAttribute('src')).toContain('img/cards/100101.png');
	await act(() => { boxes()[0].click(); });
	expect(boxes()[0].checked).toBe(true);
	expect(localStorage.getItem('stud-finder:owned-versions')).toContain('100101');
	render(null, root);
	await act(() => { render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root); });
	await flush();
	expect(boxes().map((b) => b.checked)).toEqual([true, true, true]);
	localStorage.setItem('stud-finder:owned-versions', JSON.stringify({ version: 99, ids: [100101] }));
	render(null, root);
	await act(() => { render(<App loadData={async () => data} run={inline} runVeterans={noV} />, root); });
	await flush();
	expect(boxes().map((b) => b.checked)).toEqual([false, true, true]);
});

it('edits the Tier list per Core loop style, resets it, and persists the edit', async () => {
	const jobs: RecommendJob[] = [];
	const spy: RecommendRunner = (job, p, done, fail) => { jobs.push(job); return inline(job, p, done, fail); };
	const mount = async () => { render(null, root); await act(() => { render(<App loadData={async () => data} run={spy} runVeterans={noV} />, root); }); await flush(); };
	await mount();
	await importFile();
	await pickAce();
	const tier = () => jobs.at(-1)!.tierList!['Racing Spirit: Stamina'];
	const field = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
	expect(tier()).toBe('URA');
	const move = field<HTMLSelectElement>('select[name=tier-of][data-skill="Racing Spirit: Stamina"]');
	move.value = 'T5';
	await act(() => { move.dispatchEvent(new Event('change')); });
	expect(tier()).toBe('T5');
	jobs.length = 0;
	await mount();
	await pickAce();
	expect(tier()).toBe('T5'); // persisted
	await act(() => { field<HTMLInputElement>('input[name=tier-enabled]').click(); });
	await flush();
	expect(jobs.at(-1)!.tierList).not.toHaveProperty(['Racing Spirit: Stamina']);
	const core = field<HTMLSelectElement>('select[name=core-style]');
	core.value = 'oikomi';
	await act(() => { core.dispatchEvent(new Event('change')); });
	expect(tier()).toBe('URA'); // edits are per style
	core.value = 'senko';
	await act(() => { core.dispatchEvent(new Event('change')); });
	await act(() => { field<HTMLButtonElement>('button[name=tier-reset]').click(); });
	expect(tier()).toBe('URA');
	expect(localStorage.getItem('stud-finder:tier-edits')).not.toContain('Racing');
});
