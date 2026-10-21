import { expect, test } from 'vitest';
import { placeChips } from './chips';

const chip = (id: string, label: string, pos: number) => ({ id, label, pos, kind: 'accelerating' as const });

test('chips far apart share the first lane at their spots', () => {
	const out = placeChips([chip('a', 'Alpha', 500), chip('b', 'Beta', 2000)], 2400);
	expect(out.map((c) => [c.id, c.lane, c.at])).toEqual([['a', 0, 500], ['b', 0, 2000]]);
});

test('a chip that would overlap moves up a lane, and one that fits nowhere is dropped', () => {
	const items = ['a', 'b', 'c', 'd', 'e'].map((id, i) => chip(id, 'Long skill name', 1000 + i * 10));
	expect(placeChips(items, 2400).map((c) => [c.id, c.lane])).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3]]);
});

test('chips near the ends are nudged inside the course, the count is capped, and long names count as the shown width', () => {
	const [first] = placeChips([chip('a', 'Alpha', 0)], 2400);
	expect(first.at).toBeGreaterThan(0);
	const many = Array.from({ length: 20 }, (_, i) => chip(String(i), 'x', 100 + i * 100));
	expect(placeChips(many, 2400).length).toBeLessThanOrEqual(10);
	const long = placeChips([chip('a', 'An extremely long skill name indeed', 100)], 2400)[0];
	const short = placeChips([chip('a', 'An extremely l', 100)], 2400)[0];
	expect(long.at).toBe(short.at);
});
