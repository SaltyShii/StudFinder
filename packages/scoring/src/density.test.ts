import { expect, test } from 'vitest';
import { effectStretches, isFixedSpot, rowEffect, spotDensity } from './density';

test('density bins the spots over the whole course and sums to 1', () => {
	const d = spotDensity([100, 105, 110, 900], 1200, { binWidth: 10, smooth: 0 });
	expect(d.binWidth).toBe(10);
	expect(d.bins).toHaveLength(120);
	expect(d.bins.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
	// 3 of 4 spots fall in bins 10 and 11.
	expect(d.bins[10] + d.bins[11]).toBeCloseTo(0.75);
	expect(d.bins[90]).toBeCloseTo(0.25);
});

test('smoothing spreads a lone spot to its neighbours without changing the total', () => {
	const d = spotDensity([500], 1000, { binWidth: 10, smooth: 2 });
	expect(d.bins[49]).toBeGreaterThan(0);
	expect(d.bins[49]).toBeLessThan(d.bins[50]);
	expect(d.bins[40]).toBe(0);
	expect(d.bins.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
});

test('no spots give an empty density', () => {
	expect(spotDensity([], 1000).bins).toEqual([]);
});

test('a spread of about zero is a fixed spot', () => {
	expect(isFixedSpot({ min: 1200, max: 1200 })).toBe(true);
	expect(isFixedSpot({ min: 1200, max: 1203 })).toBe(true);
	expect(isFixedSpot({ min: 1200, max: 1500 })).toBe(false);
});

// Speed climbs to 20 m/s by 200 m, cruises at 20 until 800 m, then climbs again (last spurt) to 22 at 1000 m.
const curve = [
	...[0, 50, 100, 150, 200].map((pos, i) => ({ pos, speed: 12 + i * 2 })),
	...[300, 400, 500, 600, 700, 800].map((pos) => ({ pos, speed: 20 })),
	...[850, 900, 950, 1000].map((pos, i) => ({ pos, speed: 20.5 + i * 0.5 })),
];

test('effect stretches follow the Baseline speed curve: green while accelerating, blue at cruise, grey once the effect ended', () => {
	const s = effectStretches(curve, 100, 900, 1000);
	expect(s).toEqual([
		{ start: 100, end: 200, kind: 'accelerating' },
		{ start: 200, end: 800, kind: 'cruise' },
		{ start: 800, end: 900, kind: 'accelerating' },
		{ start: 900, end: 1000, kind: 'ended' },
	]);
});

test('effect stretches are clipped to the Activation spots reach and the course', () => {
	expect(effectStretches(curve, 300, 400, 1000)).toEqual([
		{ start: 300, end: 400, kind: 'cruise' },
		{ start: 400, end: 1000, kind: 'ended' },
	]);
	expect(effectStretches(curve, 950, 1200, 1000)).toEqual([{ start: 950, end: 1000, kind: 'accelerating' }]);
});

test('a row reaches to the median end of its spots, never before the floor', () => {
	const spots = [{ end: 350 }, { end: 400 }, { end: 450 }];
	expect(rowEffect(curve, spots, 300, 1000).reach).toBe(400);
	expect(rowEffect(curve, spots, 300, 1000, 500).reach).toBe(500);
	expect(rowEffect(curve, spots, 300, 1000).stretches).toEqual(effectStretches(curve, 300, 400, 1000));
});
