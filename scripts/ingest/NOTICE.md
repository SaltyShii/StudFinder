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

Images land in `apps/web/public/img/{cards,cm,races}`; only missing files are fetched (1 request per second).
