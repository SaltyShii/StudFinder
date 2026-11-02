import { expect, it } from 'vitest';
import type { Card } from '../../../packages/lineage/src/types';
import type { AcePick, AceSkillRow, CmPreset } from '../../../packages/scoring/src/recommend';
import { aceBuildCode, buildOptimizerLink, encodeBuildCode } from './buildCode';

const apt = { turf: 7, dirt: 1, short: 5, mile: 6, middle: 4, long: 3, nige: 3, senko: 5, sashi: 6, oikomi: 4 };
const card = { id: 100601, aptitudes: apt, uniqueSkillId: 100061 } as unknown as Card;
const horse = (pinkStars: number, senkoStars = 0) => ({ affinity: 0, pinkStars, dirtStars: 0, skills: [], styleStars: { senko: senkoStars } });
const pick = { cardId: 100601, style: 'senko', horses: [[horse(3), horse(1)], [horse(0, 2)]] } as unknown as AcePick;
const row = (skillId: string, extra: Partial<AceSkillRow> = {}) => ({ skillId, ...extra }) as AceSkillRow;
const runner = { speed: 1100, stamina: 900, power: 800, guts: 400, wisdom: 400, strategy: 'Senkou', distanceAptitude: 'D', surfaceAptitude: 'A', strategyAptitude: 'C', mood: 2 };
const preset = { courseId: 10611, ground: 3, weather: 4, season: 4, time: 2, runner, skillPoints: { budget: 2700, costs: {}, fastLearner: true } } as unknown as CmPreset;

it('describes the Ace hero as uma.moe reads it', () => {
	const code = aceBuildCode(pick, card, [row('100061'), row('200332', { own: true }), row('200512', { inherit: 0.4 }), row('200999', { other: true })], { distance: 2000, ground: 1 }, preset);
	expect(code).toMatchObject({ version: 1, mode: 'cm', courseId: 10611, racedef: { ground: 3, weather: 4, season: 4, time: 2 } });
	expect(code.uma1).toMatchObject({ outfitId: '100601', speed: 1100, stamina: 900, strategy: 'Senkou', mood: 2, skills: ['100061'], sp: 2700, fastLearner: true });
	// Middle D(4) with 4 pink stars is +2, to B(6); turf stays A(7).
	expect(code.uma1.distanceAptitude).toBe('B');
	expect(code.uma1.surfaceAptitude).toBe('A');
	expect(code.chartSkills).toEqual(['200332', '200512']); // neither the unique skill nor an Other buyable skill
});

it('leaves the budget out when it is unlimited', () => {
	const code = aceBuildCode(pick, card, [], { distance: 2000, ground: 1 }, { ...preset, skillPoints: undefined });
	expect(code.uma1.sp).toBeUndefined();
	expect(code.uma1.fastLearner).toBeUndefined();
});

it('encodes as gzip base64 that decodes back, and makes the base64 safe in the link', async () => {
	const code = aceBuildCode(pick, card, [row('200332')], { distance: 2000, ground: 1 }, preset);
	const encoded = await encodeBuildCode(code);
	expect(encoded.startsWith('H4sI')).toBe(true);
	const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
	const text = await new Response(new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'))).text();
	expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(code)));
	expect(buildOptimizerLink('a+b/c=')).toBe('https://uma.moe/simulator/skills?build=a%2Bb%2Fc%3D');
});
