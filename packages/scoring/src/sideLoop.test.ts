import { expect, test } from 'vitest';
import { recommend, type Candidate, type LineageHorse } from './recommend';

const horse = { speed: 1000, stamina: 800, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
const preset = { courseId: 10101, runner: horse, samples: 5, seed: 7 };
const SKILL = '200012';
function horseOf(o: Partial<LineageHorse> = {}): LineageHorse { return { affinity: 0, pinkStars: 0, dirtStars: 0, skills: [], ...o }; }
function carries(stars: number) { return [{ skillId: SKILL, name: 'Spark', stars }]; }
function cand(id: string, ...horses: LineageHorse[]): Candidate { return { id, name: id, horses }; }
function score(c: Candidate) { return recommend({ candidates: [c] }, preset).side[0].score; }

test('CM pink spark raises side score; affinity raises it further', () => {
	// Scored alone: together, a better pick would already supply the pink.
	const plain = score(cand('plain', horseOf({ skills: carries(3) })));
	const pink = score(cand('pink', horseOf({ skills: carries(3), pinkStars: 3 })));
	const affine = score(cand('affine', horseOf({ skills: carries(3), pinkStars: 3, affinity: 100 })));
	expect(pink).toBeGreaterThan(plain);
	expect(affine).toBeGreaterThan(pink);
	expect(score(cand('empty', horseOf()))).toBe(0);
});

test('a better pick already carrying the CM pink spark supplies it', () => {
	const { side } = recommend({ candidates: [cand('a-lead', horseOf({ pinkStars: 3, affinity: 100 })), cand('dup', horseOf({ pinkStars: 3 }))] }, preset);
	expect(side.find((p) => p.candidateId === 'dup').score).toBe(0);
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
	const { side } = recommend({ candidates: [cand('a', horseOf({ skills: carries(3) }))] }, { ...preset, runner: { ...horse, skills: [SKILL] } });
	expect(side[0].score).toBe(0);
	expect(side[0].detail).toEqual([]);
});
