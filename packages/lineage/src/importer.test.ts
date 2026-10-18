import { describe, expect, it } from "vitest";
import { GameData } from "./gameData";
import { ImportError, parseExport } from "./importer";
import type { RawGameData } from "./types";

const data = new GameData({
  meta: {},
  charas: {},
  cards: { 100101: { id: 100101, charaId: 1001, name: "Synth", title: "Test" } },
  skills: {},
  factors: {},
  relations: { points: {}, members: {}, ranks: [] },
  saddles: {},
  tracks: {},
  courses: {},
  races: [],
} as unknown as RawGameData);

const vet = (id: number, extra: object = {}) => ({
  trained_chara_id: id,
  card_id: 100101,
  speed: 1000,
  rank_score: 5000,
  factor_info_array: [{ factor_id: 101 }],
  skill_array: [{ skill_id: 200012 }],
  succession_chara_array: [
    { position_id: 10, card_id: 100101 },
    { position_id: 20, card_id: 100101 },
  ],
  ...extra,
});

describe("parseExport", () => {
  it("parses a valid export into veterans", () => {
    const r = parseExport({ trained_chara_array: [vet(1), vet(2)] }, data);
    expect(r.veterans.map((v) => v.trainedId)).toEqual([1, 2]);
    expect(r.veterans[0].stats.speed).toBe(1000);
    expect(r.veterans[0].skillIds).toEqual([200012]);
    expect(r.veterans[0].factorIds).toEqual([101]);
  });

  it.each([
    ["not a list", { foo: 1 }],
    ["empty list", []],
    ["non-object entry", [vet(1), "junk"]],
    ["entry without ids", [vet(1), { speed: 5 }]],
  ])("rejects %s with no partial roster", (_n, input) => {
    expect(() => parseExport(input, data)).toThrow(ImportError);
  });
});
