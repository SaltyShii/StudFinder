import { expect, test } from 'vitest';
import { recommend, type Candidate, type LineageHorse } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, runner: horse, samples: 5, seed: 7 };
const S1 = '200012';
const S2 = '200022';
const tierList = { [S1]: 'T0', [S2]: 'T0' } as const;
const sp = (id: string, stars: number) => ({ skillId: id, name: id, stars });
const cand = (id: string, ...skills: LineageHorse['skills']): Candidate => ({ id, name: id, horses: [{ affinity: 50, pinkStars: id === 'a-lead' ? 3 : 0, dirtStars: 1, skills }] }); // the lead's pink keeps it ranked first
const MODES = ['ace', 'core', 'side'] as const;
const scoreOf = (mode: (typeof MODES)[number], cs: Candidate[], id: string, runner = horse) =>
	recommend({ candidates: cs }, { ...preset, runner }, tierList)[mode].find((p) => p.candidateId === id)!.score;

for (const mode of MODES) {
	test(`${mode}: a skill a better pick already supplies at that tier adds nothing`, () => {
		const lead = cand('a-lead', sp(S1, 3), sp(S2, 3));
		expect(scoreOf(mode, [lead, cand('dup', sp(S1, 3))], 'dup')).toBe(0);
		expect(scoreOf(mode, [lead, cand('lower', sp(S1, 1))], 'lower')).toBe(0);
	});

	test(`${mode}: a missing skill, or a higher tier, is still credited`, () => {
		const alone = scoreOf(mode, [cand('x', sp(S1, 3))], 'x');
		const higher = scoreOf(mode, [cand('a-lead', sp(S1, 1), sp(S2, 3)), cand('x', sp(S1, 3))], 'x');
		expect(higher).toBeGreaterThan(0);
		expect(higher).toBeLessThan(alone);
		expect(scoreOf(mode, [cand('a-lead', sp(S2, 3)), cand('x', sp(S1, 3))], 'x')).toBe(alone);
	});
}

test('ace and side: the Ace baseline supplies a skill at every tier', () => {
	const runner = { ...horse, skills: [S1] };
	for (const mode of ['ace', 'side'] as const) expect(scoreOf(mode, [cand('x', sp(S1, 3))], 'x', runner)).toBe(0);
});
