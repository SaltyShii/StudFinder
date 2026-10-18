---
name: ship
description: Close out a coding session. Spawns the change-triage agent, then follows the commit, merge and deploy flow its docs/light/full verdict calls for. Use after /code-review or /retro, or when the user skips the retro.
---

# Ship

Close out finished work with the smallest flow the change needs.

## Steps

1. Spawn the `change-triage` agent (Agent tool, `subagent_type: change-triage`). Pass the current branch and, for a stacked PR, its base. If that agent type is not registered in the session, spawn a haiku `general-purpose` agent told to follow the body of `.claude/agents/change-triage.md`. Its one-line verdict is the tier; record it in your reply.
2. Run the flow for that tier:

| Tier | Gate | Then |
|---|---|---|
| docs | pre-commit hook only | commit |
| light | `npm run check` | commit |
| full | `npm run check` and `npm run build -w apps/web` | commit; write the PR body with `/mattpocock-skills:pr`; no deploy target exists yet, so say so |

3. List every outward action still pending: push, PR, merge, closing issues. Merge stacked PRs bottom-up, retargeting the next one to `main` after each. Do each only after the user says to, per `AGENTS.md`.
4. After a merge, close the issues the PR resolves, delete merged branches, and run `git worktree prune`.

Done when the verdict is stated, its gates are green, and each outward action is either done with approval or listed as pending.
