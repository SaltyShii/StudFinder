import { expect, test } from 'vitest';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import { rankStyles, styleScore } from './styleRank';

const apt = (o: Partial<Record<string, number>>) => ({ short: 1, mile: 1, middle: 1, long: 1, nige: 1, senko: 1, sashi: 1, oikomi: 1, ...o }) as unknown as Aptitudes;

test('ranks styles by style aptitude, best first, ties in STYLES order', () => {
	expect(rankStyles(apt({ middle: 7, sashi: 7, senko: 5 }), 'middle')).toEqual(['sashi', 'senko', 'nige', 'oikomi']);
});
test('distance aptitude weighs more than style aptitude', () => {
	expect(styleScore(apt({ mile: 8, nige: 1 }), 'mile', 'nige')).toBeGreaterThan(styleScore(apt({ mile: 1, nige: 8 }), 'mile', 'nige'));
});
