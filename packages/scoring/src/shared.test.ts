import { expect, test } from 'vitest';
import { greedyRank, type Candidate, type CandidatePick, type Supplied } from './shared';

function cand(id: string): Candidate {
	return { id, name: id, horses: [] };
}
function pick(c: Candidate, score: number): CandidatePick {
	return { candidateId: c.id, score, reason: '', detail: [] };
}

test('ranks best score first and breaks ties by candidate id', () => {
	const scores: Record<string, number> = { b: 1, a: 1, c: 5 };
	const out = greedyRank([cand('b'), cand('a'), cand('c')], 3, new Map(), (c) => ({ pick: pick(c, scores[c.id]), supply: new Map() }));
	expect(out.map((p) => p.candidateId)).toEqual(['c', 'a', 'b']);
});

test('stops at top, and rescores the rest against what earlier picks supply', () => {
	const out = greedyRank([cand('x'), cand('y'), cand('z')], 2, new Map(), (c, supplied: Supplied) => ({
		pick: pick(c, c.id === 'x' ? 3 : supplied.has('s') ? 0 : 2),
		supply: new Map([['s', 3]]),
	}));
	expect(out.map((p) => [p.candidateId, p.score])).toEqual([['x', 3], ['y', 0]]);
});
