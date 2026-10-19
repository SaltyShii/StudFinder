import { expect, test } from 'vitest';
import { CMS, pickCm } from './cm';

test('picks the next CM by date, override wins', () => {
	const sorted = [...CMS].sort((a, b) => a.date.localeCompare(b.date));
	const next = sorted[3];
	expect(pickCm(new Date(next.date + 'T00:00:00Z')).id).toBe(next.id);
	expect(pickCm(new Date(Date.parse(sorted[2].date) + 864e5)).id).toBe(next.id);
	expect(pickCm(new Date('2030-01-01')).id).toBe(sorted[sorted.length - 1].id);
	expect(pickCm(new Date(), sorted[0].id).id).toBe(sorted[0].id);
	expect(() => pickCm(new Date(), -1)).toThrow();
});
