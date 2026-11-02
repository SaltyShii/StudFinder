// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { beforeEach, expect, it } from 'vitest';
import { GameData } from '../../../packages/lineage/src/gameData';
import { FactorType, type ImportResult, type RawGameData, type Veteran } from '../../../packages/lineage/src/types';
import { PlannerView } from './PlannerView';

function card(id: number, charaId: number, name: string) {
	return { id, charaId, name, title: '', aptitudes: {}, uniqueSkillId: null };
}
function factor(id: number, groupId: number, type: FactorType, stars: number, name: string, skillId: number | null = null) {
	return { id, groupId, type, stars, name, targets: [], skillId };
}
const data = new GameData({
	meta: {}, charas: {},
	cards: { 1: card(1, 10, 'Ace'), 2: card(2, 20, 'Friend'), 3: card(3, 30, 'Stranger'), 4: card(4, 40, 'Elder') },
	skills: { 900: { id: 900, name: 'Corner Adept' } },
	factors: {
		101: factor(101, 1, FactorType.Stat, 1, 'Speed'), 102: factor(102, 1, FactorType.Stat, 2, 'Speed'), 103: factor(103, 1, FactorType.Stat, 3, 'Speed'),
		203: factor(203, 2, FactorType.Aptitude, 3, 'Turf'), 303: factor(303, 3, FactorType.Skill, 3, 'Corner Adept', 900),
	},
	relations: { points: { 1: 20 }, members: { 1: [10, 20] }, ranks: [[1, 0, 50], [2, 51, 150], [3, 151, 999]] },
	saddles: { 8: { id: 8, name: 'Arima Kinen', type: 3 }, 88: { id: 88, name: 'Arima Kinen', type: 3 }, 9: { id: 9, name: 'Some G2', type: 2 } },
	tracks: {}, courses: {}, races: [],
} as unknown as RawGameData);
const veteran = { trainedId: 7, cardId: 2, charaId: 20, factorIds: [103], winSaddleIds: [8], rankScore: 12345, parents: [{ cardId: 4, charaId: 40, factorIds: [203], winSaddleIds: [8] }, null] } as unknown as Veteran;
const roster: ImportResult = { veterans: [veteran], borrowed: [], warnings: [], importedAt: '', sourceName: '' };

let root: HTMLElement;
function q<T extends Element = HTMLElement>(sel: string) {
	return root.querySelector<T>(sel);
}
async function click(el: Element | null) { await act(() => { (el as HTMLElement).click(); }); }
async function choose(slot: string, cardId: number) {
	await click(q(`[data-testid=plan-${slot}] button[name=plan-choose]`));
	await click(q(`.modal button[name=card][value="${cardId}"]`));
}

beforeEach(() => { localStorage.clear(); location.hash = ''; root = document.createElement('div'); document.body.replaceChildren(root); });

it('plans with versions that are not trained, and shows the affinity a place would give in its picker', async () => {
	await act(() => render(<PlannerView data={data} roster={null} />, root));
	await choose('target', 1);
	expect(q('[data-testid=plan-target]')!.textContent).toContain('Ace');
	await click(q('[data-testid=plan-p1] button[name=plan-choose]'));
	expect(q('.modal button[name=card][value="1"]')).toBeNull(); // the target's character cannot be her parent
	expect(q('.modal button[name=card][value="2"] .card-badge')!.textContent).toBe('20');
	expect(q('.modal button[name=card][value="3"] .card-badge')!.textContent).toBe('0');
	expect([...root.querySelectorAll<HTMLButtonElement>('.modal button[name=card]')].map((b) => b.value)[0]).toBe('2'); // most affinity first
	await click(q('.modal button[name=card][value="2"]'));
	expect(q('[data-testid=plan-affinity-p1]')!.textContent).toContain('20');
	expect(q('[data-testid=plan-total]')!.textContent).toContain('20');
});

it('a veteran brings its sparks, wins and own parents, whose shared G1 raises the affinity', async () => {
	await act(() => render(<PlannerView data={data} roster={roster} />, root));
	await choose('target', 1);
	await click(q('[data-testid=plan-p1] button[name=plan-choose]'));
	expect(q('[data-testid=planner-veterans]')!.textContent).toContain('Rating 12,345');
	await click(q('.modal button[name=pick-veteran]'));
	expect(q('[data-testid=plan-p1]')!.textContent).toContain('Speed ★★★');
	expect(q('[data-testid=plan-p1g1]')!.textContent).toContain('Elder');
	expect(q('[data-testid=plan-affinity-p1g1]')!.textContent).toContain('3'); // 1 G1 shared with its parent
	expect(q('[data-testid=plan-affinity-p1]')!.textContent).toContain('23');
	const odds = q('[data-testid=plan-combined]')!.textContent!;
	expect(odds).toContain('Speed');
	expect(odds).toContain('Turf');
});

it('edits sparks with their stars and G1 wins by hand', async () => {
	await act(() => render(<PlannerView data={data} roster={null} />, root));
	await choose('p1', 2);
	await click(q('[data-testid=plan-p1] button[name=plan-sparks]'));
	const row = () => [...root.querySelectorAll('.modal .skill-rows li')].find((li) => li.textContent!.includes('Speed'))!;
	await click(row().querySelector('button'));
	expect(q('[data-testid=plan-p1]')!.textContent).toContain('Speed ★');
	const stars = row().querySelector<HTMLSelectElement>('select[name=spark-stars]')!;
	stars.value = '103';
	await act(() => { stars.dispatchEvent(new Event('change')); });
	expect(q('[data-testid=plan-p1]')!.textContent).toContain('Speed ★★★');
	await click(q('.modal-close'));
	await click(q('[data-testid=plan-p1] button[name=plan-wins]'));
	const rows = [...root.querySelectorAll('.modal .skill-rows li')].map((li) => li.textContent);
	expect(rows.map((t) => t!.trim())).toEqual(expect.arrayContaining([expect.stringContaining('Arima Kinen'), expect.stringContaining('(career version)')]));
	expect(rows.join()).not.toContain('Some G2');
	await click(root.querySelector('.modal .skill-rows li button'));
	expect(q('[data-testid=plan-p1] button[name=plan-wins]')!.textContent).toContain('(1)');
});

it('shows odds by spark, by source and as new white sparks', async () => {
	await act(() => render(<PlannerView data={data} roster={roster} />, root));
	await click(q('[data-testid=plan-p1] button[name=plan-choose]'));
	await click(q('.modal button[name=pick-veteran]'));
	await click(q('button[name=plan-tab-sources]'));
	expect(q('[data-testid=plan-sources]')!.textContent).toContain('P1');
	await click(q('input[name=plan-per-run]'));
	expect(q('[data-testid=plan-sources]')).not.toBeNull();
	await click(q('button[name=plan-tab-skills]'));
	expect(root.textContent).toContain('Add white skill sparks');
});

it('remembers the tree, saves named plans and restores a shared link', async () => {
	await act(() => render(<PlannerView data={data} roster={null} />, root));
	await choose('target', 1);
	await act(() => render(null, root));
	await act(() => render(<PlannerView data={data} roster={null} />, root));
	expect(q('[data-testid=plan-target]')!.textContent).toContain('Ace'); // persisted
	const name = q<HTMLInputElement>('input[name=plan-save-name]')!;
	name.value = 'Mine';
	await act(() => { name.dispatchEvent(new Event('input')); });
	await click(q('button[name=plan-save]'));
	const link = q<HTMLInputElement>('input[name=plan-share]')!.value;
	await click(q('button[name=plan-reset]'));
	expect(q('[data-testid=plan-target]')!.textContent).toContain('Empty');
	await click(q('button[name=plan-load]'));
	expect(q('[data-testid=plan-target]')!.textContent).toContain('Ace');
	await click(q('button[name=plan-reset]'));
	await act(() => render(null, root));
	location.hash = new URL(link).hash;
	await act(() => render(<PlannerView data={data} roster={null} />, root));
	expect(q('[data-testid=plan-target]')!.textContent).toContain('Ace');
});
