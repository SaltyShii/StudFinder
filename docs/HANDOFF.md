# Handoff: uma.moe parity and restyle

Written 2026-11-02 on the Windows work PC. Delete this file before merging the branch.

## Resume

```
git fetch origin
git checkout feature/uma-moe-parity
npm install
npm run check
```

`npm run check` passed with 425 tests at the last commit, and `vite build` worked. `npm run dev -w @stud-finder/web` starts the app.

## State

Branch `feature/uma-moe-parity`, based on `main` at d89bc53. Pushed, with no PR and no merge yet. The goal was to look at uma.moe's lineage planner and simulators, then replicate what we could.

| Commit | Change |
|---|---|
| 40ee082 | Gate fixes: Windows file casing (`SupportSettingsPanel.tsx`), Node 25+ `localStorage` in tests, App tests pin the date |
| b91fbf1 | ◎ costs its ○ too, gold costs every white below it, an Ace races only the top skill of a group |
| 92e24e3 | Fast Learner setting |
| db1fb46 | HP debuffs in the Sim assumptions |
| 75d8163 | Link from the selected Ace hero to uma.moe's Build optimizer |
| 54c2014, d167a01 | Viable version suggestions from Hakuraku's CM data, without debuffers |
| cd7d1ac | Build refinement for the shown Aces when a budget leaves something out |
| 86483ca | Planner view (`PlannerView.tsx`, `packages/scoring/src/whatIf.ts`) |
| 9b2ea43 | Dueling distance exit recorded in `docs/race-mechanics.md` (not in the sim) |
| 23dad58 | Restyle (`apps/web/src/styles.css`) |

Terms are in `GLOSSARY.md`, including Build refinement, Fast Learner and What-if tree.

## What was checked

- Browser run on a made-up 8-veteran roster: Recommend, Settings, Planner, suggestions and narrow width (about 490 px). A full run took 11 s.
- The uma.moe link opened in their Build optimizer's import dialog with the right runner, stats, course, conditions and budget. Load was not pressed.
- Not checked: the real roster export. Run time with refinement on a big roster is unknown.

## Next steps

1. Run the app on the real export and check run time and whether the rankings look sensible. Ace scores with a budget shift by design.
2. Review the branch with `/mattpocock-skills:code-review`, then `/ship`. Remove this file first.

## Open decisions

- **Alternate G1 versions:** `sharedG1Saddles` in `packages/lineage/src/compatibility.ts` needs an exact saddle id, while uma.moe's planner groups a race's career versions (for example Takarazuka 14 and 147). Their own research note says the game client does not match them. Compare the affinity shown in-game before changing anything; a match is worth 3 affinity per race.
- **Free skills from sparks:** `runBuilder` in `packages/scoring/src/wholeAce.ts` races every skill whose spark procced, even if the budget did not buy it. This predates the branch, likely overstates Ace scores and may be intended. Changing it moves every score.
- **Spark star and pink odds:** not built. They were in the options table but not the recommended list. Source: uma.moe's `public/notes/spark-generation.md`.

## Known problems

- **`refresh-data` workflow:** it fails daily on GitHub, at least 2026-10-29 to 2026-11-02. Cause not investigated, so game data may not be updating.
- **`main`:** its App tests depend on today's date and should now fail in CI. The branch fixes this.
- **Hakuraku's CM data:** no published terms found. The site's code is MIT and the API allows cross-origin requests. The app reads it only on a click and credits it.
- **uma.moe licensing:** unclear. The frontend's `package.json` and the backend's README say MIT, but neither repo has a LICENSE file. None of their code was copied; keep it that way unless Tunnelblick, their developer, confirms the license.
- **uma.moe's simulator:** private, behind Turnstile or an approved API key. Do not call `/api/sim/*` from our app.

## Windows notes

- `gh` is not installed on the work PC.
- `core.autocrlf=true` there, so git prints LF/CRLF warnings on commit. They are harmless.
