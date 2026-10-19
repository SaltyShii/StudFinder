import { expect, test } from 'vitest';
import { recommend, type Candidate, type LineageHorse, type CandidateList } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, ace: horse, samples: 5, seed: 7 };
const SKILL = '200012';
const horseOf = (o: Partial<LineageHorse> = {}): LineageHorse => ({ affinity: 0, pinkStars: 0, dirtStars: 0, skills: [], ...o });
const carries = (stars: number) => [{ skillId: SKILL, name: 'Spark', stars }];
const cand = (id: string, ...horses: LineageHorse[]): Candidate => ({ id, name: id, horses });
const score = (c: Candidate) => recommend({ candidates: [c] }, preset).side[0].score;

test('CM pink spark raises side score; affinity raises it further', () => {
	const roster: CandidateList = {
		candidates: [
			cand('plain', horseOf({ skills: carries(3) })),
			cand('pink', horseOf({ skills: carries(3), pinkStars: 3 })),
			cand('affine', horseOf({ skills: carries(3), pinkStars: 3, affinity: 100 })),
			cand('empty', horseOf()),
		],
	};
	const by = Object.fromEntries(recommend(roster, preset).side.map((p) => [p.candidateId, p]));
	expect(by.pink.score).toBeGreaterThan(by.plain.score);
	expect(by.affine.score).toBeGreaterThan(by.pink.score);
	expect(by.empty.score).toBe(0);
});

test('skills are valued by sim, details exposed', () => {
	const { side } = recommend({ candidates: [cand('a', horseOf({ skills: carries(3), pinkStars: 3 }))] }, preset);
	expect(side[0].detail.length).toBe(1);
	expect(side[0].reason).toMatch(/pink/);
});

test('skills are scored at the stars the veteran really carries, and only when carried', () => {
	expect(score(cand('v', horseOf({ skills: carries(1) })))).toBeGreaterThan(0);
	expect(score(cand('v', horseOf({ skills: carries(3) })))).toBeGreaterThan(score(cand('v', horseOf({ skills: carries(1) }))));
	expect(score(cand('v', horseOf()))).toBe(0);
});

test('the veteran parents inspire too, each with its own affinity', () => {
	const alone = cand('v', horseOf({ skills: carries(1) }));
	const withParent = cand('v', horseOf({ skills: carries(1) }), horseOf({ skills: carries(1), affinity: 100 }));
	const parentOnly = cand('v', horseOf(), horseOf({ skills: carries(1), affinity: 100 }));
	expect(score(parentOnly)).toBeGreaterThan(0); // a grandparent's spark counts on its own
	expect(score(withParent)).toBeGreaterThan(score(alone)); // and adds a second roll for the same skill
	const lowAffinity = cand('v', horseOf(), horseOf({ skills: carries(1), affinity: 0 }));
	expect(score(parentOnly)).toBeGreaterThan(score(lowAffinity));
});

test('skills the Ace already has are not scored', () => {
	const { side } = recommend({ candidates: [cand('a', horseOf({ skills: carries(3) }))] }, { ...preset, ace: { ...horse, skills: [SKILL] } });
	expect(side[0].score).toBe(0);
	expect(side[0].detail).toEqual([]);
});
