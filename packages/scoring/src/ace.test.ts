import { expect, test } from 'vitest';
import { aceForCourse, buildAce, CATEGORIES, defaultTargetStats, gradeLabel, gradeLetter, STYLES, courseFacts, rankStyles, styleScore } from './ace';
import type { Aptitudes } from '@stud-finder/lineage/src/types';
import { recommend } from './recommend';

function apt(o: Partial<Aptitudes>): Aptitudes {
	return { turf: 1, dirt: 1, short: 1, mile: 1, middle: 1, long: 1, nige: 1, senko: 1, sashi: 1, oikomi: 1, ...o };
}

const aptitudes = { turf: 8, dirt: 3, short: 4, mile: 7, middle: 7, long: 5, nige: 2, senko: 7, sashi: 6, oikomi: 1 };

test('every distance category and style resolves to a default', () => {
	for (const c of CATEGORIES) for (const s of STYLES) {
		const t = defaultTargetStats(c, s);
		for (const v of Object.values(t)) expect(v).toBeGreaterThan(0);
	}
});

test('overriding one stat leaves the others at their defaults', () => {
	const base = buildAce({ aptitudes, style: 'senko', category: 'mile', surface: 'turf' });
	const over = buildAce({ aptitudes, style: 'senko', category: 'mile', surface: 'turf', target: { speed: 1200 } });
	expect(over.speed).toBe(1200);
	expect({ ...over, speed: 0 }).toEqual({ ...base, speed: 0 });
});

test('aptitudes come from the version and the unique skill is in the baseline', () => {
	const ace = buildAce({ aptitudes, style: 'senko', category: 'mile', surface: 'turf', uniqueSkillId: '100071' });
	expect([ace.distanceAptitude, ace.surfaceAptitude, ace.strategyAptitude]).toEqual(['A', 'S', 'A']);
	expect(ace.strategy).toBe('Senkou');
	expect(ace.skills).toEqual(['100071']);
});

test('recommend runs from a built Ace', () => {
	const ace = buildAce({ aptitudes, style: 'senko', category: 'mile', surface: 'turf' });
	const r = recommend({ candidates: [{ id: 'a', name: 'A', horses: [{ affinity: 0, pinkStars: 0, dirtStars: 0, skills: [{ skillId: '10071', name: 'S', stars: 3 }] }] }] }, { courseId: 10101, runner: ace, samples: 10 });
	expect(r.ace[0].score).toBeGreaterThan(0);
	expect(r.skills.map((d) => d.skillId)).toEqual(['10071']);
});

test('aceForCourse reads surface, distance and unique skill from the course and card', () => {
	const ace = aceForCourse({ aptitudes, uniqueSkillId: 1001 }, { distance: 2000, surface: 'dirt' }, 'senko', { speed: 1234 });
	expect(ace).toMatchObject({ speed: 1234, surfaceAptitude: 'E', distanceAptitude: 'A', skills: ['1001'] });
});

test('gradeLetter maps 1-8 to G-S and throws out of range', () => {
	expect([1, 4, 8].map(gradeLetter)).toEqual(['G', 'D', 'S']);
	expect(() => gradeLetter(0)).toThrow();
	expect(() => gradeLetter(9)).toThrow();
});

test('ranks styles by style aptitude, best first, ties in STYLES order', () => {
	expect(rankStyles(apt({ middle: 7, sashi: 7, senko: 5 }), 'middle')).toEqual(['sashi', 'senko', 'nige', 'oikomi']);
});
test('distance aptitude weighs more than style aptitude', () => {
	expect(styleScore(apt({ mile: 8, nige: 1 }), 'mile', 'nige')).toBeGreaterThan(styleScore(apt({ mile: 1, nige: 8 }), 'mile', 'nige'));
});

test('courseFacts reads distance and surface from the sim course', () => {
	expect(courseFacts(10101)).toEqual({ distance: 1200, surface: 'turf' });
	expect(courseFacts(10106)).toEqual({ distance: 1000, surface: 'dirt' });
});

test('courseFacts names an unknown course id', () => {
	expect(() => courseFacts(-1)).toThrow('Unknown course id -1');
	expect(() => courseFacts('toString' as unknown as number)).toThrow('Unknown course id toString');
});

test('gradeLabel shows ? instead of throwing out of range', () => {
	expect([0, 4, 9, NaN].map(gradeLabel)).toEqual(['?', 'D', '?', '?']);
});
