import { describe, expect, test } from 'vitest';
import { rollSparks, rolls, wholeAceMean, type WholeAceInput } from './wholeAce';
import type { LineageHorse } from './shared';

function horse(over: Partial<LineageHorse> = {}): LineageHorse {
	return { affinity: 0, pinkStars: 0, dirtStars: 0, skills: [], ...over };
}
const apt = { distance: 4, surface: 7 };

describe('rolls', () => {
	test('a 0-chance spark never procs and a certain one always does', () => {
		expect(rolls(0, () => 0)).toBe(false); // the lowest draw there is
		expect(rolls(1, () => 0.999999)).toBe(true);
	});
});

describe('rollSparks', () => {
	const hs = [horse({ affinity: 80, pinkStars: 2, skills: [{ skillId: '10071', name: 'a', stars: 1 }, { skillId: '200342', name: 'b', stars: 1 }] }), horse({ affinity: 30, pinkStars: 1, skills: [{ skillId: '10071', name: 'a', stars: 2 }] })];
	test('same seed gives the same roll', () => {
		expect(rollSparks(hs, apt, 'turf', 5)).toEqual(rollSparks(hs, apt, 'turf', 5));
	});
	test('different seeds differ', () => {
		const bySeed = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(rollSparks(hs, apt, 'turf', i))));
		expect(bySeed.size).toBeGreaterThan(1);
	});
	test('a certain skill spark always procs, once, even carried twice', () => {
		const sure = [horse({ affinity: 1e6, skills: [{ skillId: '10071', name: 'a', stars: 3 }] }), horse({ affinity: 1e6, skills: [{ skillId: '10071', name: 'a', stars: 3 }] })];
		for (let seed = 0; seed < 10; seed++) expect(rollSparks(sure, apt, 'turf', seed).skillIds).toEqual(['10071']);
	});
	test('no sparks change nothing', () => {
		for (let seed = 0; seed < 10; seed++) expect(rollSparks([horse()], apt, 'turf', seed)).toEqual({ distance: 4, surface: 7, skillIds: [] });
	});
	test('certain pink sparks lift a grade to S mid-run', () => {
		const sure = [horse({ affinity: 1e6, pinkStars: 3, turfStars: 3 }), horse({ affinity: 1e6, pinkStars: 3, turfStars: 3 })];
		const r = rollSparks(sure, { distance: 7, surface: 7 }, 'turf', 1);
		expect(r.distance).toBe(8);
		expect(r.surface).toBe(8);
	});
	test('the surface spark follows the course surface', () => {
		const dirty = [horse({ affinity: 1e6, dirtStars: 3 })];
		expect(rollSparks(dirty, { distance: 7, surface: 4 }, 'dirt', 1).surface).toBeGreaterThan(4);
		expect(rollSparks(dirty, { distance: 7, surface: 4 }, 'turf', 1).surface).toBe(4);
	});
});

describe('wholeAceMean', () => {
	const input: WholeAceInput = {
		aptitudes: { turf: 7, dirt: 1, short: 1, mile: 1, middle: 7, long: 1, nige: 1, senko: 7, sashi: 1, oikomi: 1 },
		style: 'senko',
		scenario: { courseId: 10101 },
		buyableSkillIds: [],
		horses: [],
		seeds: [1, 2, 3, 4, 5, 6],
	};
	const sure = (id: string) => horse({ affinity: 1e6, skills: [{ skillId: id, name: id, stars: 3 }] });

	test('same inputs give the same mean', () => {
		const i = { ...input, uniqueSkillId: '10071' };
		expect(wholeAceMean(i)).toBe(wholeAceMean(i));
	});
	test('a skill the Ace buys gains lengths; none gains nothing', () => {
		expect(wholeAceMean(input)).toBe(0);
		expect(wholeAceMean({ ...input, buyableSkillIds: ['10071'] })).toBeGreaterThan(0);
	});
	test('a skill carried by both lineages, or also bought, counts once', () => {
		const once = wholeAceMean({ ...input, horses: [sure('10071')] });
		expect(once).toBeGreaterThan(0);
		expect(wholeAceMean({ ...input, horses: [sure('10071'), sure('10071')] })).toBe(once);
		expect(wholeAceMean({ ...input, buyableSkillIds: ['10071'], horses: [sure('10071')] })).toBe(once);
	});
	test('an aptitude upgrade is worth lengths and changes what a skill is worth', () => {
		const weak = { ...input, aptitudes: { ...input.aptitudes, middle: 5 } }; // C in the distance
		const up = [horse({ affinity: 1e6, pinkStars: 3 }), horse({ affinity: 1e6, pinkStars: 3 })];
		expect(wholeAceMean({ ...weak, horses: up })).toBeGreaterThan(0);
		const skilled = { ...weak, buyableSkillIds: ['10071'] };
		expect(wholeAceMean({ ...skilled, horses: up })).not.toBe(wholeAceMean(skilled));
	});
});
