import { expect, test } from 'vitest';
import { buyableSkillIds, skillsAceCanMeet } from './learnable';

function s(id: number, rarity: number, groupId: number, gradeValue: number) { return { id, rarity, groupId, gradeValue }; }

test('the buyable pool is the white and gold skills, one per group (the strongest), without penalty skills', () => {
	const pool = buyableSkillIds([s(1, 1, 10, 129), s(2, 1, 10, 174), s(3, 1, 10, -129), s(4, 2, 10, 461), s(5, 1, 11, 217), s(6, 3, 12, 240), s(7, 5, 13, 500)]);
	expect(pool.sort()).toEqual(['4', '5']);
});

test('a group whose only skill is a penalty keeps nothing', () => {
	expect(buyableSkillIds([s(1, 1, 10, -129)])).toEqual([]);
});

const ctx = { style: 'nige', category: 'long', surface: 'turf' } as const;

test('skills conditioned on another running style, distance or surface are dropped; generic and matching ones stay', () => {
	// 200532 front runner, 201232 long, 201672 dirt, 202482 long pace chaser, 200162 ground condition only, last one unknown to the sim
	const kept = skillsAceCanMeet(['200532', '201232', '201672', '202482', '200162', '99999999'], ctx);
	expect(kept).toEqual(['200532', '201232', '200162']);
});
