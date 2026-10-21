import { describe, expect, it } from 'vitest';
import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { SKILL_CATEGORIES, skillCategory } from './skillCategory';

describe('skillCategory', () => {
	it('puts target speed skills in Speed, even beside a lane or accel effect', () => {
		expect(skillCategory('200331')).toBe('speed'); // target speed only
		expect(skillCategory('201081')).toBe('speed'); // current speed + target speed
		expect(skillCategory('202521')).toBe('speed'); // current speed with natural deceleration
		expect(skillCategory('200371')).toBe('speed'); // target speed + accel
		expect(skillCategory('202381')).toBe('speed'); // target speed + lane movement
	});

	it('puts accel-only skills in Acceleration, and accel beside recovery too', () => {
		expect(skillCategory('200341')).toBe('acceleration');
		expect(skillCategory('200662')).toBe('acceleration'); // recovery + accel
	});

	it('puts recovery skills in Recovery', () => {
		expect(skillCategory('200351')).toBe('recovery');
	});

	it('puts a recovery skill that also raises target speed in Speed (speed outranks recovery)', () => {
		expect(skillCategory('200761')).toBe('speed');
	});

	it('puts stat boosts, lane movement, start delay and unknown skills in Other', () => {
		expect(skillCategory('200011')).toBe('other'); // speed stat boost, not a velocity effect
		expect(skillCategory('200451')).toBe('other'); // lane movement
		expect(skillCategory('200431')).toBe('other'); // start delay
		expect(skillCategory('999999999')).toBe('other');
	});

	it('gives every skill in the data exactly one known category', () => {
		const keys: string[] = SKILL_CATEGORIES.map((c) => c.key);
		for (const id of Object.keys(skillData)) expect(keys).toContain(skillCategory(id));
	});
});
