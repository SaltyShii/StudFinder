import { expect, test } from 'vitest';
import { aceForCourse, buildAce, CATEGORIES, defaultTargetStats, pinkGroupOf, STYLES } from './ace';
import { recommend } from './recommend';

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
	const r = recommend({ candidates: [{ id: 'a', name: 'A', horses: [{ affinity: 0, pinkStars: 0, dirtStars: 0, skills: [{ skillId: '10071', name: 'S', stars: 3 }] }] }] }, { courseId: 10101, ace, samples: 10 });
	expect(r.ace[0].score).toBeGreaterThan(0);
});

test('aceForCourse reads surface, distance and unique skill from the course and card', () => {
	const ace = aceForCourse({ aptitudes, uniqueSkillId: 1001 }, { distance: 2000, ground: 2 }, 'senko', { speed: 1234 });
	expect(ace).toMatchObject({ speed: 1234, surfaceAptitude: 'E', distanceAptitude: 'A', skills: ['1001'] });
	expect(pinkGroupOf(2000)).toBe(33);
});
