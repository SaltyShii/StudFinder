import { expect, test } from 'vitest';
import type { Veteran } from '@stud-finder/lineage/src/types';
import { scoreVeterans } from './veterans';

const aptitudes = { turf: 8, dirt: 3, short: 4, mile: 7, middle: 7, long: 5, nige: 2, senko: 7, sashi: 6, oikomi: 1 };
const vet = (trainedId: number, over: Partial<Veteran> = {}): Veteran => ({
	cardId: 1, charaId: 1, factorIds: [], winSaddleIds: [], trainedId, aptitudes, rankScore: 1000 + trainedId, createdAt: '2026-01-01',
	stats: { speed: 1000, stamina: 800, power: 800, guts: 400, wiz: 400 }, skillIds: [], runningStyle: 3, isLocked: false, useType: 0, parents: [null, null], ...over,
});
const opts = { courseId: 10101, samples: 10 };

test('a veteran with skills gains lengths, with per-skill detail and career style', () => {
	const [r] = scoreVeterans([vet(1, { skillIds: [10071, 999999999] })], opts);
	expect(r.style).toBe('sashi');
	expect(r.lengthsGained).toBeGreaterThan(0);
	expect(r.detail.map((d) => d.skillId)).toEqual(['10071']); // unknown ids skipped
	expect(r.gap).toBe(0);
});

test('no skills gains nothing; ranking is best first with gaps, and repeatable', () => {
	const vs = [vet(1), vet(2, { skillIds: [10071] })];
	const a = scoreVeterans(vs, opts);
	expect(a.map((r) => r.trainedId)).toEqual([2, 1]);
	expect(a[1].lengthsGained).toBe(0);
	expect(a[1].gap).toBe(a[0].lengthsGained);
	expect(scoreVeterans(vs, opts)).toEqual(a);
});

test('stats are the veteran own', () => {
	const strong = scoreVeterans([vet(1, { skillIds: [10071], stats: { speed: 1200, stamina: 1000, power: 1000, guts: 600, wiz: 600 } })], opts)[0];
	const weak = scoreVeterans([vet(1, { skillIds: [10071] })], opts)[0];
	expect(strong.lengthsGained).not.toBe(weak.lengthsGained);
});
