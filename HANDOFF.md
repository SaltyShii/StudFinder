# Handoff: Stud Finder (from saltyuma-tools session, 2026-10-18)

Read [GLOSSARY.md](GLOSSARY.md) first for terms (Uma, Outfit, Veteran, Roster, Parent, Grandparent, Great-grandparent, Core loop, Side loop, Ace).

## Goal
A new standalone app that answers: "which uma should I train next as a great-grandparent / grandparent / parent for the upcoming Champions Meeting (CM)?" Output is a simple ranked top 3-5 of training targets (uma outfit + best slot), one score and one-line reason each, details behind a "why?" expander. The existing tools (saltyuma-tools umalator, SaltyShii/lineageplanner-salty) are too detailed and overwhelm people.

## Settled decisions
- Name: Stud Finder. Licence: GPL-3.0-or-later (sim derives from alpha123/umalator, GPL-3.0). `packages/lineage` stays MIT.
- Architecture: in-browser, one app, Web Workers for sims. Vite + Preact + TypeScript monorepo (npm workspaces). A separate API repo is deferred; keep packages clean so one can wrap them later.
- Skill value: run the simulator on the CM course and style; value = proc % x median lengths gained (bashin). Proc = the skill activates in that run. Show proc %, min/avg/median/max in the "why?" expander. Order-dependent skills use the simulator's existing assumptions and are flagged "assumes position".
- Modes: core loop (great-grandparents: keep high-tier general sparks from the user's configurable tier list, plus dirt sparks for affinity), side loop (grandparents and parents: CM-relevant pink spark + general lineage skills + CM skills), Ace (ignores pink sparks and spark chance; maximizes inherited relevant skills, measured in lengths gained).
- Auto-pick the next CM from the saltyuma-tools presets (`umalator-global/v2/cm-presets.generated.json`, `cm-dates.json`) and rank styles for the course; user can override. Distance aptitude matters more than style aptitude. Hard-to-train umas (e.g. style F needing A) still show up.
- Roster: persisted across sessions (IndexedDB), prepopulated from the UmaExtractor veteran export. Candidate pool = outfits available on Global only; owned ones marked.
- Out of v1: blue sparks (fixable via support cards or a good run), support card pool (later).
- Inheritance rules: Crazyfellow's guide (https://docs.google.com/document/d/1Q3IJKbtkplmuY-PAJMNjYiLtasv0eU0aIBEqp8_C3tg), already encoded in `packages/lineage/src/rules.ts` and documented in lineageplanner-salty `docs/SCORING.md` (https://github.com/SaltyShii/lineageplanner-salty).

## Current state (commit ddc72a9, local only, no remote)
- `packages/sim/src`: copied core files from saltyuma-tools `uma-skill-tools/` (RaceSolver, RaceSolverBuilder, conditions, etc.). Not yet runnable: missing `prando` dependency, `tsconfig.json`, and data (skill_data.json, course_data.json, skillnames) from `saltyuma-tools/umalator-global/`.
- `packages/lineage/src`: planner's `src/domain/*.ts`, unchanged. `goals.ts`, `optimizer.ts`, `loop.ts` score a fixed trainee + goals and need rewriting; the rest (`inheritance`, `compatibility`, `rules`, `sparks`, `tiers`, `gameData`, `importer`, `types`) is meant to be reused. The planner uses React 18; Stud Finder uses Preact (preact/compat).
- `packages/scoring`: empty, vitest configured in package.json.
- `apps/web`: empty.
- Nothing installed, typechecked, tested or run yet.

## Next steps
1. Add dependencies and tsconfig (prando, vitest, typescript), bring over the data files, get one sim running headless.
2. Write the first scoring test: rank skills by proc % x median lengths for one course + style. Reference implementation to start from: saltyuma-tools `umalator-global/v2/roster/roster-analysis-runner.ts` and `simulator.worker.ts`.
3. Build the slot-mode scoring (core / side / Ace) with marginal gain over the user's current best lineage.
4. Scaffold `apps/web` and the roster persistence.

## Notes
- Do not push or create the GitHub repo without asking the user.
- The user prefers the interactive question popup (AskUserQuestion) over big text dumps.
- Do not add Co-Authored-By trailers if the saltyuma-tools convention applies here (user instruction in that repo's CLAUDE.md); confirm with the user.
- saltyuma-tools `SAMPLEdata.json` is the user's real roster export (test data); never copy it into a repo that gets pushed.
