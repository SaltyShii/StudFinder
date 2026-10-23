import { expect, test } from 'vitest';
import { buyableSkillIds, poolSkillIds, whiteUniqueIds, skillsAceCanMeet } from './learnable';

const skills = new Map([[1, { rarity: 1, gradeValue: 129 }], [2, { rarity: 2, gradeValue: 461 }], [3, { rarity: 1, gradeValue: -129 }], [4, { rarity: 3, gradeValue: 240 }], [5, { rarity: 1, gradeValue: 217 }]]);

test('the buyable pool is the white and gold skills on the card list, without penalty or unique skills and ones off the list', () => {
	expect(buyableSkillIds([1, 2, 3, 4, 99], skills)).toEqual(['1', '2']);
});

const ctx = { style: 'nige', category: 'long', surface: 'turf' } as const;

test('skills conditioned on another running style, distance or surface are dropped; generic and matching ones stay', () => {
	// 200532 front runner, 201232 long, 201672 dirt, 202482 long pace chaser, 200162 ground condition only, last one unknown to the sim
	const kept = skillsAceCanMeet(['200532', '201232', '201672', '202482', '200162', '99999999'], ctx);
	expect(kept).toEqual(['200532', '201232', '200162']);
});

test('the pool is the white and gold skills, one per group (the strongest), without penalty skills', () => {
	const s = (id: number, rarity: number, groupId: number, gradeValue: number) => ({ id, rarity, groupId, gradeValue });
	expect(poolSkillIds([s(1, 1, 10, 129), s(2, 1, 10, 174), s(3, 1, 10, -129), s(4, 2, 10, 461), s(5, 1, 11, 217), s(6, 3, 12, 240), s(7, 1, 13, -5)]).sort()).toEqual(['4', '5']);
});

test('white unique variants, which only a parent makes buyable, are left out of the pool', () => {
	const s = (id: number, rarity: number, groupId: number, gradeValue: number) => ({ id, rarity, groupId, gradeValue });
	const skills = [s(900061, 1, 90006, 180), s(5, 1, 11, 217)];
	expect(poolSkillIds(skills, whiteUniqueIds([{ type: 3, skillId: 900061 }, { type: 4, skillId: 5 }, { type: 2, skillId: null }]))).toEqual(['5']);
});
