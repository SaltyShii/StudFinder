import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateData } from './validate-data';

type Tables = Record<string, number>;

// Synthetic fixtures: each table is an array of n placeholders.
function dir(game: Tables | null, extras: Tables | null, meta = true): string {
	const d = mkdtempSync(join(tmpdir(), 'val-'));
	const fill = (t: Tables) => ({
		...(meta ? { meta: { resourceVersion: 'x' } } : {}),
		...Object.fromEntries(Object.entries(t).map(([k, n]) => [k, Array.from({ length: n }, (_, i) => i)])),
	});
	if (game) writeFileSync(join(d, 'game-data.json'), JSON.stringify(fill(game)));
	if (extras) writeFileSync(join(d, 'race-extras.json'), JSON.stringify(fill(extras)));
	return d;
}

// Fixtures that stay valid once skills are checked field by field.
function skillsDir(skills: Record<string, unknown>): string {
	const d = dir(game, extras);
	const file = join(d, 'game-data.json');
	const data = JSON.parse(readFileSync(file, 'utf8'));
	writeFileSync(file, JSON.stringify({ ...data, skills }));
	return d;
}

const game = { charas: 10, cards: 10, skills: 10, factors: 10, saddles: 10, tracks: 10, courses: 10, races: 10, careerGoals: 10 };
const extras = { championsMeetings: 10, courses: 10 };

describe('validateData', () => {
	const committed = dir(game, extras);

	it('accepts valid data', () => {
		expect(validateData(dir(game, extras), committed)).toEqual([]);
	});

	it('accepts growth and small drops', () => {
		expect(validateData(dir({ ...game, skills: 9 }, { ...extras, courses: 30 }), committed)).toEqual([]);
	});

	it('rejects missing meta', () => {
		const errors = validateData(dir(game, extras, false), committed);
		expect(errors.join('\n')).toMatch(/game-data\.json: meta missing/);
	});

	it('rejects an empty required table and a missing file', () => {
		const errors = validateData(dir({ ...game, skills: 0 }, null), committed);
		expect(errors.join('\n')).toMatch(/game-data\.json: skills is empty/);
		expect(errors.join('\n')).toMatch(/race-extras\.json: file missing/);
	});

	it('rejects a sharp count drop versus committed', () => {
		const errors = validateData(dir({ ...game, races: 5 }, extras), committed);
		expect(errors.join('\n')).toMatch(/game-data\.json: races dropped 10 -> 5/);
	});

	describe('skill point costs', () => {
		const white = { id: 1, rarity: 1, groupId: 10, spCost: 90 };
		const gold = { id: 2, rarity: 2, groupId: 10, spCost: 180, replacesId: 1 };
		const unique = { id: 3, rarity: 5, groupId: 11 };
		const cut = { id: 4, rarity: 1, groupId: 12, purchasable: false };
		const ok = { 1: white, 2: gold, 3: unique, 4: cut };
		const run = (skills: Record<string, unknown>) => validateData(skillsDir(skills), skillsDir(ok)).join('\n');

		it('accepts costed white and gold skills, unique and unpurchasable skills without one', () => {
			expect(run(ok)).toBe('');
		});

		it('rejects a white skill missing its cost', () => {
			expect(run({ ...ok, 1: { ...white, spCost: undefined } })).toMatch(/skill 1: spCost/);
		});

		it('rejects a gold skill missing its cost', () => {
			expect(run({ ...ok, 2: { ...gold, spCost: undefined } })).toMatch(/skill 2: spCost/);
		});

		it('rejects a malformed cost', () => {
			expect(run({ ...ok, 1: { ...white, spCost: -5 } })).toMatch(/skill 1: spCost/);
			expect(run({ ...ok, 1: { ...white, spCost: '90' } })).toMatch(/skill 1: spCost/);
			expect(run({ ...ok, 1: { ...white, spCost: 90.5 } })).toMatch(/skill 1: spCost/);
		});

		it('rejects a gold skill without a white version to replace', () => {
			expect(run({ ...ok, 2: { ...gold, replacesId: undefined } })).toMatch(/skill 2: replacesId/);
		});

		it('rejects a gold skill replacing something that is not a white skill', () => {
			expect(run({ ...ok, 2: { ...gold, replacesId: 3 } })).toMatch(/skill 2: replacesId/);
			expect(run({ ...ok, 2: { ...gold, replacesId: 99 } })).toMatch(/skill 2: replacesId/);
		});
	});
});
