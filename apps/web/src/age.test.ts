import { expect, test } from 'vitest';
import { formatAge } from './age';

const t = Date.parse('2026-10-13T22:00:00Z');
test('formats age in days', () => {
	expect(formatAge('2026-10-13T22:00:00Z', t + 3600_000)).toBe('today');
	expect(formatAge('2026-10-13T22:00:00Z', t + 86_400_000)).toBe('1 day ago');
	expect(formatAge('2026-10-13T22:00:00Z', t + 5 * 86_400_000)).toBe('5 days ago');
});
