// @vitest-environment jsdom
import { render } from 'preact';
import { expect, it } from 'vitest';
import type { SupportDeck, SupportPick } from '../../../packages/scoring/src/recommend';
import { SupportDeckView } from './SupportDeckView';

const pick = (id: number, type: SupportPick['card']['type']): SupportPick => ({ card: { id, name: `Card ${id}`, type, pool: [], hintFrequency: [], hintLevelBonus: [] }, limitBreak: 4 });
function html(deck: SupportDeck): HTMLElement {
	const root = document.createElement('div');
	render(<SupportDeckView deck={deck} />, root);
	return root;
}

it('lists the 5 own cards and the borrowed card apart, with their types', () => {
	const root = html({ own: [1, 2, 3, 4, 5].map((i) => pick(i, 'speed')), borrowed: pick(41, 'friend'), notes: [] });
	expect([...root.querySelectorAll('[data-testid=deck-own]')].map((e) => e.textContent)).toEqual([1, 2, 3, 4, 5].map((i) => `Card ${i} (speed)`));
	expect(root.querySelector('[data-testid=deck-borrowed]')?.textContent).toBe('Card 41 (friend)');
});

it('shows the notes of a short deck and no borrowed line without a borrowed card', () => {
	const root = html({ own: [pick(1, 'wit')], notes: ['Only 1 own support cards shortlisted'] });
	expect(root.querySelector('[data-testid=deck-borrowed]')).toBeNull();
	expect(root.querySelector('[data-testid=deck-note]')?.textContent).toContain('Only 1');
});
