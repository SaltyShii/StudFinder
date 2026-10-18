import { expect, test } from 'vitest';
import { skillValue } from './skillValue';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;

test('a speed skill that procs gains lengths', () => {
	const v = skillValue('10071', { horse, courseId: 10101, samples: 50 });
	expect(v.proc).toBeGreaterThan(0);
	expect(v.lengths.median).toBeGreaterThan(0);
	expect(v.value).toBeCloseTo((v.proc / 100) * v.lengths.median);
});

test('same inputs give the same result', () => {
	const s = { horse, courseId: 10101, samples: 20 };
	expect(skillValue('10071', s)).toEqual(skillValue('10071', s));
});
