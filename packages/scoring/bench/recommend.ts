// Timing loop for recommend() on a synthetic roster (seeded, no personal data). Run: npx vite-node packages/scoring/bench/recommend.ts [versions] [candidates] [samples] [budget]; a budget (SP; -1 for none) gives every version a card list of 30 pool skills and synthetic costs
import skillData from '@stud-finder/sim/src/data/skill_data.json';
import { skillDetail } from '../src/skillDetail';
import { createHash } from 'node:crypto';
import { recommend, recommendAsync, simulateRequest, type Candidate } from '../src/recommend';

const [versions = 3, perVersion = 30, samples = 100, budget] = process.argv.slice(2).map(Number);
let s = 12345;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const runner = { speed: 1100, stamina: 700, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 } as const;
// Skills the sim can't build in this scenario would throw in the app too; keep the bench on ones it can.
const ok = (id: string) => { try { skillDetail(id, { courseId: 10101, horse: runner, samples: 2, seed: 1 }); return true; } catch { return false; } };
const pool = Object.keys(skillData).filter((id) => Number(id) < 200000 && ok(id)).slice(0, 150);
const horse = () => ({ affinity: 20 + Math.floor(rnd() * 60), pinkStars: rnd() < 0.3 ? 1 + Math.floor(rnd() * 3) : 0, dirtStars: rnd() < 0.5 ? 1 : 0, skills: Array.from({ length: 4 }, () => ({ skillId: pick(pool), name: 'x', stars: 1 + Math.floor(rnd() * 3) })) });
const cand = (i: number): Candidate => ({ id: String(i), name: `c${i}`, charaId: i, horses: [horse(), horse(), horse()] });
const apt = { turf: 7, dirt: 5, short: 6, mile: 7, middle: 7, long: 6, nige: 3, senko: 7, sashi: 6, oikomi: 4 };
const costs = Object.fromEntries(pool.map((id, i) => [id, { cost: 100 + (i % 5) * 50, group: i }]));
const owned = Array.from({ length: versions }, (_, v) => ({ cardId: v + 1, aptitudes: apt, ...(budget ? { learnableSkillIds: pool.slice(v * 10, v * 10 + 30) } : {}), candidates: Array.from({ length: perVersion }, (_, i) => cand(v * 1000 + i)) }));
const args = [{ candidates: owned[0].candidates }, { courseId: 10101, runner, samples, seed: 1, ...(budget > 0 ? { skillPoints: { budget, costs } } : {}) }, undefined, owned, []] satisfies Parameters<typeof recommend>;
function hash(r: unknown) {
	return createHash('sha1').update(JSON.stringify(r)).digest('hex').slice(0, 12);
}
let t = performance.now();
const sync = recommend(...args);
console.log(`${versions} versions x ${perVersion} candidates, ${samples} samples: ${((performance.now() - t) / 1000).toFixed(1)}s sync, hash ${hash(sync)}`);
// The batches a page would hand to its worker pool, simulated here one after the other: the result must be the sync one.
t = performance.now();
const viaBatches = await recommendAsync(async (batch) => batch.requests.map((r) => simulateRequest(r, batch.scenario)), ...args);
console.log(`recommendAsync (batches run serially): ${((performance.now() - t) / 1000).toFixed(1)}s, hash ${hash(viaBatches)}`);
