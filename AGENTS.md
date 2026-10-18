# Project Development Guide

## Project Overview

Stud Finder answers one question: which uma should I train next as a great-grandparent, grandparent or parent for the upcoming Champions Meeting? In-browser only (Vite + Preact + TypeScript), no backend; Web Workers run the race simulations. Vocabulary and design notes: `GLOSSARY.md`. Update this file when the stack or architecture changes.

## Layout

npm workspaces:
- `packages/sim`: race simulator, vendored from saltyuma-tools `uma-skill-tools/` (GPL-3.0). Sync manually; keep local patches small (sim is not strict-clean, so it is type-checked non-strict via `packages/scoring/tsconfig.json`).
- `packages/lineage`: inheritance, affinity, rules, vendored from lineageplanner-salty (MIT). `goals.ts`, `optimizer.ts`, `loop.ts` score a fixed trainee and are unused; slot-mode scoring in `packages/scoring` replaces them.
- `packages/scoring`: `recommend()` ranks outfits per slot mode; skill value = proc % x median lengths gained (median over runs where the skill activated).
- `apps/web`: UI (not yet created).

## Tooling

- Gate before every commit: `npm run check` (lint, typecheck, test). `npm install` points git at `.githooks/pre-commit`, which runs it; CI runs it too
- Tests sit next to source as `*.test.ts`
- Root `tsconfig.json` is `strict` (lineage, web); `packages/scoring/tsconfig.json` is non-strict because it pulls in the vendored sim

## Code Standards

- TypeScript; no `any` in new code (use `unknown` and narrow). Keep `packages/*` free of DOM and UI imports so an API could wrap them later
- Validate external data (UmaExtractor exports, uma.moe responses) at the boundary
- Top-level functions use the `function` keyword; comments explain why, not what
- Use `GLOSSARY.md` terms in code, comments and UI copy where a term has an `_Avoid_` list

## Safety Rules

- Never copy `saltyuma-tools/SAMPLEdata.json` (the user's real roster export) into this repo, or any file with personal roster data
- uma.moe API keys stay in the browser; never commit or log them
- Do not push or create the GitHub remote without asking

## Git Workflow

1. Branch from `main`: `git checkout -b <type>/name` (`feature/`, `fix/`, `chore/`, `docs/`)
2. One logical change per commit; when in doubt, go smaller
3. Run `npm run check` before committing
4. Commit format: `<type>(<scope>): <short summary>` plus a body on what and why
5. Push, PRs (`/mattpocock-skills:pr` for the body) and merges only when asked

## Preferences

Report concisely.

For grilling workflows, ask with the native `AskUserQuestion` tool (rounds of up to 4 questions); fall back to concise plain text only if it is unavailable.
