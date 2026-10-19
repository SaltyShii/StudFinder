import { expect, test } from 'vitest';
import { courseFacts } from './courseFacts';
import { CMS } from './cm';

test('courseFacts reads distance and surface from the sim course', () => {
	const f = courseFacts(CMS[0].courseId);
	expect(f.distance).toBeGreaterThan(0);
	expect(['turf', 'dirt']).toContain(f.surface);
});

test('courseFacts names an unknown course id', () => {
	expect(() => courseFacts(-1)).toThrow('Unknown course id -1');
});
