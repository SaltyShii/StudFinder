// @vitest-environment jsdom
import { render } from 'preact';
import { expect, it } from 'vitest';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AcePick } from '../../../packages/scoring/src/recommend';
import { AceHero } from './AceHero';

const data = { cards: new Map() } as unknown as GameData;
const pick = (over: Partial<AcePick>): AcePick => ({ cardId: 1, style: 'Senkou', fallback: false, score: 1, expectedLengths: 1, horses: [], mustHaveChance: 0, distanceAChance: 1, parents: [], skills: [], ...over }) as AcePick;
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
