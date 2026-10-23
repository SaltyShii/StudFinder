// @vitest-environment jsdom
import { render } from 'preact';
import { expect, it } from 'vitest';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { AceSkillRow } from '../../../packages/scoring/src/recommend';
import type { TrackOverview } from '../../../packages/scoring/src/trackOverview';
import { SkillChart } from './SkillChart';

const track = { distance: 2000, events: [], curve: [], slopes: [], straights: [], corners: [], phases: [], sections: [], heights: [] } as TrackOverview;
const data = { skills: new Map() } as unknown as GameData;
const row = (over: Partial<AceSkillRow>): AceSkillRow => ({ skillId: '10071', proc: 100, lengths: { min: 0, avg: 0.4, median: 0.4, max: 1 }, value: 0.4, spots: [], spotSpread: { min: 0, median: 0, max: 0 }, duration: 0, assumesPosition: false, inherit: 1, own: true, mustHave: false, ...over }) as AceSkillRow;

function chartText(rows: AceSkillRow[]): string {
	const root = document.createElement('div');
	render(<SkillChart rows={rows} track={track} data={data} tab="speed" onTab={() => {}} />, root);
	return root.querySelector('[data-testid=ace-skill-row] .skill-name')?.textContent ?? '';
}

it('shows the bought share of a budgeted Buyable skill, and nothing for the others', () => {
	expect(chartText([row({ bought: 0.85 })])).toContain('bought in 85% of runs');
	expect(chartText([row({ bought: 1 })])).toContain('bought in 100% of runs');
	expect(chartText([row({})])).toBe('10071');
});
