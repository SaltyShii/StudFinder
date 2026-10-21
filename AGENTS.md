# Project Development Guide

## Project Overview

Stud Finder answers one question: which uma should I train next as a great-grandparent, grandparent or parent for the upcoming Champions Meeting? In-browser only (Vite + Preact + TypeScript), no backend; Web Workers run the race simulations. Vocabulary and design notes: `GLOSSARY.md`. Update this file when the stack or architecture changes.

## Grilling

Any grill skill (`grill-with-docs`, `grilling`): call `AskUserQuestion` for every round, up to 4 questions, recommended option first. The skill's ❓/➡️ text format is the fallback if the tool errors.

## Layout

npm workspaces:
- `packages/sim`: race simulator, ours to change: forked from saltyuma-tools `uma-skill-tools/` (GPL-3.0), no longer synced. Mechanics follow `docs/race-mechanics.md` (sim is not strict-clean, so it is type-checked non-strict via `packages/scoring/tsconfig.json`).
- `packages/lineage`: inheritance, affinity, rules, vendored from lineageplanner-salty (MIT). `goals.ts`, `optimizer.ts`, `loop.ts` score a fixed trainee and are unused; slot-mode scoring in `packages/scoring` replaces them.
- `packages/scoring`: `recommend()` ranks veterans per slot mode; skill value = proc % x median lengths gained (median over runs where the skill activated).
- `apps/web`: Preact UI; `recommend.worker.ts` runs the ranking and asks the page (a `call`, see `jobRunner.ts`) to run its skill sims on a pool of 4 `jobs.worker.ts` workers, which also score the Veterans job one veteran each (workers never start workers: Firefox stalls such a nested pool after a few seconds); roster and settings persist in localStorage (versioned).

## Tooling

- Gate before every commit: `npm run check` (lint, typecheck, test). `npm install` points git at `.githooks/pre-commit`, which runs it; CI runs it too
- Tests sit next to source as `*.test.ts`
- Root `tsconfig.json` is `strict` (lineage); `packages/scoring` and `apps/web` have non-strict tsconfigs because they pull in the sim

## Code Standards

- TypeScript; no `any` in new code (use `unknown` and narrow). Keep `packages/*` free of DOM and UI imports so an API could wrap them later
- Validate external data (UmaExtractor exports, uma.moe responses) at the boundary
- Top-level functions use the `function` keyword; comments explain why, not what
- Use `GLOSSARY.md` terms in code, comments and UI copy where a term has an `_Avoid_` list

## Review Standards

Read during review.

- Check a suspected defect against the existing tests, `GLOSSARY.md` and code comments before reporting it; documented design decisions (for example the Ace run ignoring spark chance) are not defects.
- A refactor keeps behaviour: memo dependency granularity, fallbacks and ordering stay unless the commit body says otherwise. Review it by comparing old and new path by path with `git show main:<file>`, including state transitions and error order.

## Safety Rules

- Never copy `saltyuma-tools/SAMPLEdata.json` (the user's real roster export) into this repo, or any file with personal roster data
- uma.moe API keys stay in the browser; never commit or log them

## Git Workflow

1. Branch from `main`: `git checkout -b <type>/name` (`feature/`, `fix/`, `chore/`, `docs/`)
2. One logical change per commit; when in doubt, go smaller
3. The pre-commit hook runs `npm run check` and prints only on failure; run it yourself only to iterate
4. Commit format: `<type>(<scope>): <short summary>` plus a body on what and why
5. Push, PRs (`/mattpocock-skills:pr` for the body) and merges only when asked; approving a PR in `/ship` also approves its merge once checks are green

## Gotchas

- Handoffs: newest file in `~/.claude/projects/-home-stijn-Documents-saltyuma-stud-finder/handoffs/`; the global `/handoff` skill writes there and keeps the last 7

- Issue tracker: GitHub Issues. Specs are issues, tickets are sub-issues labelled `ready-for-agent`, blockers use GitHub's native links
- Read issues with `gh issue view N --json title,body`; plain `gh issue view`, `gh pr merge` and `gh pr edit` error on the Projects classic deprecation, so use `gh api` (REST) for merges and base changes
- Subagent worktrees start on a stale commit: `git reset --hard <integration branch>`, then `npm install`
- Repo slug is `SaltyShii/StudFinder` (not `stud-finder`); use `gh api repos/{owner}/{repo}/...` so it resolves from the remote
- Attach a sub-issue with `gh api -X POST repos/{owner}/{repo}/issues/N/sub_issues -F sub_issue_id=<database id>` (the `.id` field, not the number)
- GitHub Pages deploys from `.github/workflows/deploy-pages.yml`; live at https://saltyshii.github.io/StudFinder/, every merge to `main` redeploys
- `apps/web/public/data/*.json` is copied from lineageplanner-salty `public/data` (pipeline in its `docs/DATA.md`). Regenerate locally with the commands in `scripts/ingest/NOTICE.md` (vendored lineageplanner-salty scripts; also writes `apps/web/public/img/{cards,cm,races}`); scheduled refresh is #18
- Git over SSH to GitHub hangs intermittently (port 22). Wrap network git in `timeout 60`; on a hang, fetch over HTTPS: `git -c credential.helper='!gh auth git-credential' fetch https://github.com/SaltyShii/StudFinder.git main:refs/remotes/origin/main`
- Stopping a process: `pkill -f "[v]ite --port"` (the bracket keeps the pattern from matching the shell's own command line, which kills the Bash tool with exit 144), or kill by PID
- Profiling: `node --cpu-prof --cpu-prof-dir=<dir> node_modules/vite-node/vite-node.mjs <script>` with the script outside the repo; `packages/scoring/bench/recommend.ts` is the synthetic-roster loop. Read a real export from its own path, never copy it in. A perf change must give the same `recommend()` result as `main` (compare a hash of the JSON)
- `playwright-cli`: refs change after a reload, and `upload` only works right after clicking the file chooser

## Preferences

After `/mattpocock-skills:code-review`, offer to fix its findings (it only reports), then suggest `/ship`. After `/mattpocock-skills:retro` (or when the user skips it), suggest `/ship`. Always write the full `mattpocock-skills:` name; the bare `/code-review` is a different, built-in command.
