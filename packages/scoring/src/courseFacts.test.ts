import { expect, test } from 'vitest';
import { courseFacts } from './courseFacts';

test('courseFacts reads distance and surface from the sim course', () => {
	expect(courseFacts(10101)).toEqual({ distance: 1200, surface: 'turf' });
	expect(courseFacts(10106)).toEqual({ distance: 1000, surface: 'dirt' });
});

test('courseFacts names an unknown course id', () => {
	expect(() => courseFacts(-1)).toThrow('Unknown course id -1');
	expect(() => courseFacts('toString' as unknown as number)).toThrow('Unknown course id toString');
});
