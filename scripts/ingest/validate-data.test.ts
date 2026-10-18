import { mkdtempSync, writeFileSync } from 'node:fs';
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
});
