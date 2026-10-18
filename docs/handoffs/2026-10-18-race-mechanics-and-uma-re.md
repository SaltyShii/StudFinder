<!-- Repo: SaltyShii/StudFinder (stud-finder). Handoff from the race-mechanics verification session, 2026-10-18. -->

# stud-finder handoff: race mechanics verification + uma-re reverse engineering

## Goal
Verify and fix stud-finder's race simulator (`packages/sim`, vendored) against the community doc "Uma Musume Race Mechanics" (KuromiAK), then resolve the doc's unknown mechanics by reverse engineering the Global Steam client with Ghidra + REA (user chose to do this themselves, as a learning exercise).

## State
**stud-finder** (`~/Documents/saltyuma/stud-finder`, branch `main`, uncommitted):
- `docs/race-mechanics.md` written: condensed doc incl. formulas (taken from the PDF at `~/Downloads/Uma Musume Race Mechanics.pdf`, `pdftotext` works; the Google text export drops formulas) plus a "Verification against packages/sim" section. Read it; it holds the drift list. Do not duplicate it here.
- No sim code changed. User trusts the PDF over current sim behaviour.
- Agreed workflow (not started): `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement-spec` → `/code-review` → `/retro` → `/ship`. Grill must settle: patch vendored sim in place vs upstream-first vs override in `packages/scoring`; PDF-over-upstream everywhere or only where stale; scope of unimplemented mechanics (wiz limit break, zenkai, pace up Ex, blocking cap); whether to rebuild conserve power faithfully. Suggested first ticket: downhill accel mode sign bug (`RaceSolver.ts` ~L1215), spot struggle duration missing StrategyProficiency, stamina limit break distance factors (1.5/1.8), pace down 0.945 mid-race, rushed round-up.

**uma-re** (`~/Documents/saltyuma/uma-re`, private, local only, no remote, 1 commit):
- `.gitignore` excludes dumps/, ghidra-projects/, *.dll, *.dat. Only findings (formulas, constants, function names/addresses) go in git; no binaries, dumps or decompiled code.
- JDK 21.0.12 at `~/tools/jdk-21.0.12.1+1`, Ghidra 12.1.4 at `~/tools/ghidra_12.1.4_PUBLIC` (no sudo used; sudo needs a password).
- REA (`rea-agents@6.7.0`, MIT, github.com/morluto/rea) registered at Claude Code **local scope for the uma-re dir only**, env: `GHIDRA_INSTALL_DIR`, `JAVA_HOME`, `REA_ANALYSIS_PROVIDER=ghidra`. `rea doctor` passes all Ghidra checks. Do not run `rea-agents setup` (it would add user-level config).
- Game installs: `~/.local/share/Steam/steamapps/common/UmamusumePrettyDerby` (Global, use this) and `UmamusumePrettyDerby_Jpn` (has a `hachimi` mod dir). Unity IL2CPP: `GameAssembly.dll`, `UnityPlayer.dll`; metadata at `UmamusumePrettyDerby_Data/il2cpp_data/Metadata/global-metadata.dat`.

## Next steps
1. Start a Claude Code session **in `~/Documents/saltyuma/uma-re`** so REA's MCP tools load.
2. Get Il2CppDumper (or Il2CppInspector) to recover method names from `GameAssembly.dll` + `global-metadata.dat`; vet the source with the user before downloading. Dumps stay in git-ignored `dumps/`.
3. Import `GameAssembly.dll` into Ghidra via REA (mind first-query startup deadlines; `REA_GHIDRA_STARTUP_TIMEOUT_MS`).
4. Resolve the doc's unknowns, one note each (doc formula vs binary vs `packages/sim`): stamina limit break random factor and halved-vs-raw stamina input; zenkai spurt acceleration/max speed; pacemaker selection; compete before spurt / secure lead / stamina keep conditions; conserve power exact mechanics.
5. Bring verified findings back to stud-finder as spec input for the grill (notes only, no decompiled code).

## Suggested skills
- In uma-re: `mattpocock-skills:research` (cited findings notes), `mattpocock-skills:domain-modeling` if terms need sharpening.
- In stud-finder: `mattpocock-skills:grill-with-docs` (AGENTS.md: use `AskUserQuestion`, up to 4 questions, recommended first), then `to-spec`, `to-tickets`, `implement-spec`, `tdd`, `code-review`, `ship`.

## Notes
- User preferences: minimal scannable replies, no recaps (memory: user_adhd_low_tokens). Ponytail mode was active.
- Decompiling the game is the user's own call (ToS); keep outputs as notes.
- stud-finder Git rules: branch `fix/…` from main, `npm run check` before commit, no push/PR unless asked.
