// @vitest-environment jsdom
import { render } from 'preact';
import { expect, it } from 'vitest';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AcePick } from '../../../packages/scoring/src/recommend';
import { AceHero } from './AceHero';

const data = { cards: new Map() } as unknown as GameData;
const pick = (over: Partial<AcePick>): AcePick => ({ cardId: 1, style: 'senko', score: 1, expectedLengths: 1, horses: [], mustHaveChance: 0, distanceAChance: 1, styleAChance: 1, parents: [], skills: [], ...over }) as AcePick;
const deck = { own: [{ card: { id: 7, name: 'Own seven', type: 'speed', pool: [], hintFrequency: [], hintLevelBonus: [] }, limitBreak: 4 }], notes: [] } as AcePick['deck'];

function shown(p: AcePick): HTMLElement {
	const root = document.createElement('div');
	render(<AceHero picks={[p]} selected={p.cardId} data={data} stale={false} />, root);
	return root;
}

it('shows the deck under the selected hero, and nothing without a shortlist', () => {
	expect(shown(pick({ deck })).querySelector('[data-testid=support-deck]')?.textContent).toContain('Own seven (speed)');
	expect(shown(pick({})).querySelector('[data-testid=support-deck]')).toBeNull();
});

it('shows the chance of A after the style name only when the style is below A', () => {
	const style = (over: Partial<AcePick>) => shown(pick({ style: 'senko', ...over })).querySelector('[data-testid=hero-style]')!.textContent;
	expect(style({ styleAChance: 0.746 })).toBe('Pace Chaser, A in 74% of runs');
	expect(style({ styleAChance: 1 })).toBe('Pace Chaser');
});

it('shows the hero\'s style and no fall-back text', () => {
	const text = shown(pick({ style: 'oikomi' })).textContent!;
	expect(text).toContain('End Closer');
	expect(text).not.toContain('fall-back');
});
