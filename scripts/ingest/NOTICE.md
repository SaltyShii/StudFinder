# Notice

The Python scripts in this directory are vendored as-is from
[lineageplanner-salty](https://github.com/SaltyGamedev/lineageplanner-salty)
(MIT, Copyright (c) 2026 SaltyGamedev), source commit 7cc6c5ec9e7c64cba225dd84543a6e8a62a9f19b.

- `fetch_master.py` is an independent implementation. Its download protocol was learned by reading
  [UmaTools](https://github.com/daftuyda/UmaTools) (GPL-3.0); no code was copied.
- Game data and images are (c) Cygames. Race extras and images come from GameTora's public files; GameTora publishes no data licence.

## Regenerate locally (from the repo root)

    pip install -r scripts/ingest/requirements.txt
    python3 scripts/ingest/fetch_master.py /tmp/master.mdb   # prints the resource version
    python3 scripts/ingest/build_data.py /tmp/master.mdb apps/web/public/data/game-data.json --resource-version <v>
    python3 scripts/ingest/fetch_gametora.py apps/web/public/data/race-extras.json
    python3 scripts/ingest/fetch_images.py apps/web/public/data/game-data.json apps/web/public/data/race-extras.json apps/web/public/img

`build_data.py` also writes each white and gold skill's base SP cost (`spCost`, from `single_mode_skill_need_point`) and, for a gold skill, `replacesId`: the white version just below it in its group (highest positive `group_rate` under the gold's). Skills with no positive cost, and golds with no white in their group, get `purchasable: false` and neither field. Check a regeneration with the validator, which rejects a purchasable white or gold skill missing a cost, or a gold skill whose `replacesId` is not a white skill:

    mkdir -p /tmp/cand && cp apps/web/public/data/race-extras.json /tmp/cand/ && python3 scripts/ingest/build_data.py /tmp/master.mdb /tmp/cand/game-data.json --resource-version <v>
    npx vite-node scripts/ingest/validate-data.ts /tmp/cand apps/web/public/data

Images land in `apps/web/public/img/{cards,cm,races}`; only missing files are fetched (1 request per second).

## Support cards

`build_data.py` writes `supportCards` (id, charaId, name, title, rarity, type, `pool`, `hintFrequency`, `hintLevelBonus`) for every stat or friend support card with a skill hint pool; group cards are left out. `pool` is the skill ids of `single_mode_hint_gain` rows with `hint_gain_type` 0 (1 Hint level each). `hintFrequency` and `hintLevelBonus` hold 5 values, one per limit break level 0 to 4. The validator rejects a card with an empty pool, an unknown type, or a missing or malformed frequency or bonus array. The regeneration commands above cover it, no extra step. Checked on master.mdb resource version 10008320 (250 cards: 54 speed, 49 stamina, 51 power, 49 guts, 47 wit, no friend).

Outcome of the unverified facts from spec #136:

- **Effect types**: confirmed by value ranges and by the numbering shared with `support_card_unique_effect`: 17 = Hint level bonus (integers 1 to 4), 18 = Hint Frequency (5 to 60). Not provable from the data alone (no text names the types); 19 (up to 80) looks like specialty priority and is unused.
- **Stat command ids**: `command_id` 101 speed, 105 stamina, 102 power, 103 guts, 106 wit, checked on known cards (Kitasan Black, Super Creek, Mejiro McQueen, Vodka, Oguri Cap, Special Week, Winning Ticket, Fine Motion, Air Shakur). Correction to the usual guess: stamina is 105, not 104 (unused). `support_card_type` 1 = stat card, 2 = friend, 3 = group.
- **Limit break to card level**: `support_card_limit` per rarity: R 20/25/30/35/40, SR 25/30/35/40/45, SSR 30/35/40/45/50 for limit break 0 to 4.
- **Effect table shape**: values sit at card levels 0, 5, ... 50, `-1` for none. We interpolate linearly between listed levels (rounded down), 0 below the first listed level, flat after the last. Inferred from repeated plateau values, not confirmed against the game.
- **Unique effects**: a unique effect can also grant Hint Frequency (type 18, mostly +20 from card level 25 to 40, on 15 unique effects). Correction: it is included in `hintFrequency`, since leaving it out would under-count those cards. No unique effect grants a Hint level bonus. Other unique effects are ignored.
- **Conditional hint rows**: correction, there are 3 rows (not 5) with a `condition_set_id`, all on card 30098, all `hint_gain_type` 1 (stat or skill point rewards, no skill). They never touch a skill pool and are ignored.
- **Cards without a pool**: friend cards (10 of them) and three stat cards (10020, 30019, 30098) have no skill hint rows, only stat rewards. They are left out of `supportCards`, so no friend card can be shortlisted yet. 90 stat cards have no Hint Frequency row and 91 no Hint level bonus row: both are 0 for them.
- **Base hint chance (about 7%)**: not in master.mdb (no table holds it; it lives in game logic), so it stays an assumption for the roll.
