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
