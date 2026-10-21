import { expect, test } from 'vitest';
import { placeChips } from './chips';

test('chips far apart share the first lane at their spots', () => {
	const out = placeChips([{ id: 'a', label: 'Alpha', pos: 500 }, { id: 'b', label: 'Beta', pos: 2000 }], 2400);
	expect(out.map((c) => [c.id, c.lane, c.at])).toEqual([['a', 0, 500], ['b', 0, 2000]]);
});

test('a chip that would overlap moves up a lane, and one that fits nowhere is dropped', () => {
	const items = ['a', 'b', 'c'].map((id, i) => ({ id, label: 'Long skill name', pos: 1000 + i * 10 }));
	expect(placeChips(items, 2400).map((c) => [c.id, c.lane])).toEqual([['a', 0], ['b', 1]]);
});

test('chips near the ends are nudged inside the course, and the count is capped', () => {
	const [first] = placeChips([{ id: 'a', label: 'Alpha', pos: 0 }], 2400);
	expect(first.at).toBeGreaterThan(0);
	const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: 'x', pos: 100 + i * 100 }));
	expect(placeChips(many, 2400).length).toBeLessThanOrEqual(6);
});
