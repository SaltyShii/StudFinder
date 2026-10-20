import { expect, test } from 'vitest';
import type { Veteran } from '@stud-finder/lineage/src/types';
import { scoreVeterans } from './veterans';

const aptitudes = { turf: 8, dirt: 3, short: 4, mile: 7, middle: 7, long: 5, nige: 2, senko: 7, sashi: 6, oikomi: 1 };
function vet(trainedId: number, over: Partial<Veteran> = {}): Veteran {
	return {
	cardId: 1, charaId: 1, factorIds: [], winSaddleIds: [], trainedId, aptitudes, rankScore: 1000 + trainedId, createdAt: '2026-01-01',
	stats: { speed: 1000, stamina: 800, power: 800, guts: 400, wiz: 400 }, skillIds: [], runningStyle: 3, isLocked: false, useType: 0, parents: [null, null], ...over,
	};
}
const opts = { courseId: 10101, samples: 10 };

test('a veteran with skills gains lengths, with per-skill detail and career style', () => {
	const [r] = scoreVeterans([vet(1, { skillIds: [10071, 999999999] })], opts);
	expect(r.style).toBe('sashi');
	expect(r.setLengthsGained).toBeGreaterThan(0);
	expect(r.detail.map((d) => d.skillId)).toEqual(['10071']); // unknown ids skipped
	expect(r.gap).toBe(0);
	expect(r.skillsNotSimulated).toBe(1);
});

test('no skills gains nothing; ranking is best first with gaps, and repeatable', () => {
	const vs = [vet(1), vet(2, { skillIds: [10071] })];
	const a = scoreVeterans(vs, opts);
	expect(a.map((r) => r.trainedId)).toEqual([2, 1]);
	expect(a[1].setLengthsGained).toBe(0);
	expect(a[1].gap).toBe(a[0].setLengthsGained);
	expect(scoreVeterans(vs, opts)).toEqual(a);
});

test('stats are the veteran own', () => {
	const strong = scoreVeterans([vet(1, { skillIds: [10071], stats: { speed: 1200, stamina: 1000, power: 1000, guts: 600, wiz: 600 } })], opts)[0];
	const weak = scoreVeterans([vet(1, { skillIds: [10071] })], opts)[0];
	expect(strong.setLengthsGained).not.toBe(weak.setLengthsGained);
});

test('duplicate versions are labelled rows; low aptitude is scored and exposed; progress reports', () => {
	const calls: number[][] = [];
	const low = { ...aptitudes, turf: 1, middle: 1, mile: 1 };
	const r = scoreVeterans([vet(1, { rankScore: 5000 }), vet(2, { rankScore: 6000, createdAt: '2026-02-02', aptitudes: low })], { ...opts, onProgress: (d, t) => calls.push([d, t]) });
	expect(r).toHaveLength(2);
	const b = r.find((x) => x.trainedId === 2)!;
	expect(b.rankScore).toBe(6000);
	expect(b.aptitude.surface).toBe(1);
	expect(calls).toEqual([[1, 2], [2, 2]]);
});

test('the card unique skill is used, once, and the baseline has none', () => {
	const none = scoreVeterans([vet(1)], opts)[0];
	const withUnique = scoreVeterans([vet(1)], { ...opts, uniqueSkills: new Map([[1, 10071]]) })[0];
	expect(none.setLengthsGained).toBe(0);
	expect(withUnique.detail.map((d) => d.skillId)).toEqual(['10071']);
	expect(withUnique.setLengthsGained).toBeGreaterThan(0);
	const dup = scoreVeterans([vet(1, { skillIds: [10071] })], { ...opts, uniqueSkills: new Map([[1, 10071]]) })[0];
	expect(dup.detail).toHaveLength(1);
});

test('progress reaches N/N only after the last veteran is scored', () => {
	let lastLeft = false;
	const vs = [vet(1, { skillIds: [10071] })];
	scoreVeterans(vs, { ...opts, onProgress: () => { lastLeft = true; } });
	expect(lastLeft).toBe(true);
});
