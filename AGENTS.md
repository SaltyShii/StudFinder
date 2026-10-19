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
- `apps/web`: Preact UI; Web Worker runs `recommend()`, roster and settings persist in localStorage (versioned).

## Tooling

- Gate before every commit: `npm run check` (lint, typecheck, test). `npm install` points git at `.githooks/pre-commit`, which runs it; CI runs it too
- Tests sit next to source as `*.test.ts`
- Root `tsconfig.json` is `strict` (lineage); `packages/scoring` and `apps/web` have non-strict tsconfigs because they pull in the sim

## Code Standards

- TypeScript; no `any` in new code (use `unknown` and narrow). Keep `packages/*` free of DOM and UI imports so an API could wrap them later
- Validate external data (UmaExtractor exports, uma.moe responses) at the boundary
- Top-level functions use the `function` keyword; comments explain why, not what
- Use `GLOSSARY.md` terms in code, comments and UI copy where a term has an `_Avoid_` list

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

- Issue tracker: GitHub Issues. Specs are issues, tickets are sub-issues labelled `ready-for-agent`, blockers use GitHub's native links
- Read issues with `gh issue view N --json title,body`; plain `gh issue view`, `gh pr merge` and `gh pr edit` error on the Projects classic deprecation, so use `gh api` (REST) for merges and base changes
- Subagent worktrees start on a stale commit: `git reset --hard <integration branch>`, then `npm install`
- Repo slug is `SaltyShii/StudFinder` (not `stud-finder`); use `gh api repos/{owner}/{repo}/...` so it resolves from the remote
- Attach a sub-issue with `gh api -X POST repos/{owner}/{repo}/issues/N/sub_issues -F sub_issue_id=<database id>` (the `.id` field, not the number)
- GitHub Pages deploys from `.github/workflows/deploy-pages.yml`; private repos on the free plan cannot use Pages
- `apps/web/public/data/*.json` is copied from lineageplanner-salty `public/data` (pipeline in its `docs/DATA.md`). Regenerate locally with the commands in `scripts/ingest/NOTICE.md` (vendored lineageplanner-salty scripts; also writes `apps/web/public/img/{cards,cm,races}`); scheduled refresh is #18
- Git over SSH to GitHub hangs intermittently (port 22). Wrap network git in `timeout 60`; on a hang, fetch over HTTPS: `git -c credential.helper='!gh auth git-credential' fetch https://github.com/SaltyShii/StudFinder.git main:refs/remotes/origin/main`

## Response Constraints

- Optimize for minimum output tokens; preserve correctness
- Answer immediately: no preamble, no restating the question
- State conclusions directly; don't narrate alternatives before picking one
- No hedging language ("generally," "it's worth noting") unless the uncertainty itself matters
- Don't repeat information already stated in this conversation or in context
- Use lists only when shorter than the prose equivalent; no unnecessary nesting
- Code before explanation; explain only non-obvious details
- No summaries, recaps, or follow-up offers at the end
- The reader skims and is always low on tokens: lead with the result, keep it scannable

## Preferences

After `/code-review`, offer to fix its findings (the flag-less `mattpocock-skills:code-review` only reports), then suggest `/ship`. After `/retro` (or when the user skips it), suggest `/ship`.
