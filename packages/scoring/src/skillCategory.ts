import skillData from '@stud-finder/sim/src/data/skill_data.json';

export type SkillCategory = 'speed' | 'acceleration' | 'recovery' | 'other';

/** Tab order of the Ace skill table. */
export const SKILL_CATEGORIES: { key: SkillCategory; label: string }[] = [
	{ key: 'speed', label: 'Speed' },
	{ key: 'acceleration', label: 'Acceleration' },
	{ key: 'recovery', label: 'Recovery' },
	{ key: 'other', label: 'Other' },
];

// Effect types of skill_data.json (see SkillType in the sim's RaceSolver):
//   27 target speed, 21 current speed, 22 current speed with natural deceleration -> Speed
//   31 acceleration                                                               -> Acceleration
//   9 recovery                                                                    -> Recovery
// Everything else (stat boosts 1-5, lane movement 28/35, start delay 10/14, ...)  -> Other.
// A skill with effects from several groups goes in the first group of that list that it touches
// (speed, then acceleration, then recovery), so each skill sits in exactly one tab.
const SPEED = new Set([27, 21, 22]);
const ACCELERATION = new Set([31]);
const RECOVERY = new Set([9]);

/** The one tab a skill belongs in, read from the effect types in the skill data; skills the sim does not know are Other. */
export function skillCategory(id: string): SkillCategory {
	const skill: unknown = (skillData as Record<string, unknown>)[id];
	const alts = typeof skill === 'object' && skill !== null ? (skill as { alternatives?: unknown }).alternatives : undefined;
	if (!Array.isArray(alts)) return 'other';
	const types = new Set<number>();
	for (const alt of alts) {
		const effects: unknown = typeof alt === 'object' && alt !== null ? (alt as { effects?: unknown }).effects : undefined;
		if (!Array.isArray(effects)) continue;
		for (const e of effects) if (typeof e === 'object' && e !== null && typeof (e as { type?: unknown }).type === 'number') types.add((e as { type: number }).type);
	}
	const has = (group: Set<number>) => [...types].some((t) => group.has(t));
	if (has(SPEED)) return 'speed';
	if (has(ACCELERATION)) return 'acceleration';
	if (has(RECOVERY)) return 'recovery';
	return 'other';
}
