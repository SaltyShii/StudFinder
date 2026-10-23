// Gate for regenerated game data: usage `vite-node scripts/ingest/validate-data.ts <candidateDir> <committedDir>`.
// Exits 1 listing every problem, so the refresh workflow opens no PR on a broken fetch.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED: Record<string, string[]> = {
	'game-data.json': ['charas', 'cards', 'skills', 'factors', 'saddles', 'tracks', 'courses', 'races', 'careerGoals'],
	'race-extras.json': ['championsMeetings', 'courses'],
};
// A drop beyond this fraction of the committed count means the source changed shape, not content.
const MAX_DROP = 0.2;

function count(v: unknown): number {
	if (Array.isArray(v)) return v.length;
	return v && typeof v === 'object' ? Object.keys(v).length : 0;
}

function load(path: string): Record<string, unknown> | null {
	if (!existsSync(path)) return null;
	const v: unknown = JSON.parse(readFileSync(path, 'utf8'));
	return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

// Same values as packages/scoring/src/learnable.ts: this gate is a standalone ingest script (node builtins only, run by the refresh workflow), so it does not import from the workspace packages.
const WHITE = 1;
const GOLD = 2;

type SkillRow = { rarity?: unknown; spCost?: unknown; replacesId?: unknown; purchasable?: unknown };

// White and gold skills need a base SP cost and gold needs the white version it replaces, unless the ingest flagged
// them `purchasable: false` (cut skills the game's career mode never sells). Bad costs would silently skew the Ace budget.
function skillCostErrors(skills: unknown): string[] {
	if (!skills || typeof skills !== 'object') return [];
	const rows = new Map<string, SkillRow>();
	for (const [key, v] of Object.entries(skills)) if (v && typeof v === 'object') rows.set(key, v as SkillRow);
	const errors: string[] = [];
	for (const [key, sk] of rows) {
		if ((sk.rarity !== WHITE && sk.rarity !== GOLD) || sk.purchasable === false) continue;
		if (!Number.isInteger(sk.spCost) || (sk.spCost as number) <= 0) errors.push(`game-data.json: skill ${key}: spCost missing or not a positive integer`);
		if (sk.rarity !== GOLD) continue;
		const white = rows.get(String(sk.replacesId));
		if (!white || white.rarity !== WHITE) errors.push(`game-data.json: skill ${key}: replacesId must name a white skill`);
	}
	return errors;
}

export function validateData(candidateDir: string, committedDir: string): string[] {
	const errors: string[] = [];
	for (const [file, tables] of Object.entries(REQUIRED)) {
		const cand = load(join(candidateDir, file));
		if (!cand) {
			errors.push(`${file}: file missing or not an object`);
			continue;
		}
		if (count(cand.meta) === 0) errors.push(`${file}: meta missing`);
		const old = load(join(committedDir, file));
		for (const t of tables) {
			const n = count(cand[t]);
			if (n === 0) {
				errors.push(`${file}: ${t} is empty`);
				continue;
			}
			const was = old ? count(old[t]) : 0;
			if (was > 0 && n < was * (1 - MAX_DROP)) errors.push(`${file}: ${t} dropped ${was} -> ${n}`);
		}
		if (file === 'game-data.json') errors.push(...skillCostErrors(cand.skills));
	}
	return errors;
}

// vite-node drops the script path from argv; skip when imported by tests.
if (!process.env.VITEST) {
	const [cand, committed] = process.argv.slice(2);
	if (!cand || !committed) {
		console.error('usage: validate-data.ts <candidateDir> <committedDir>');
		process.exit(2);
	}
	const errors = validateData(cand, committed);
	if (errors.length) {
		console.error(`Data validation failed:\n- ${errors.join('\n- ')}`);
		process.exit(1);
	}
	console.log('Data validation passed');
}
