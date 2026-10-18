# How to Approach Work in This Repo

Match the effort to the task. Most work does not need heavy orchestration — reach for structure only when the task earns it. When in doubt, ask: *does this really need more compute?*

## Match the tool to the task

| The work is… | Do this |
|---|---|
| A small, obvious change (one-liner, rename, clear fix) | Just do it, then verify. No pipeline. |
| Substantial delivery (a feature, an issue, a migration) | The mattpocock-skills flow: `/mattpocock-skills:grill-with-docs` → `/mattpocock-skills:to-spec` → `/mattpocock-skills:to-tickets` (`implement-spec` needs tickets) → `/mattpocock-skills:implement-spec`, then `/mattpocock-skills:code-review`; `/mattpocock-skills:ask-matt` picks the skill |
| A spec whose work is one obvious ticket (small refactor) | Skip `to-tickets` and `implement-spec`: implement on a branch, then `/mattpocock-skills:code-review` and `/ship` |
| A hard end-state you want reached without prompting each turn | Set a **`/goal`** (measurable end state + stated check + a turn bound). An evaluator checks after every turn. |
| Recurring or monitoring work (triage a queue, poll a build, periodic scan) | **`/loop`** on an interval, optionally paired with a `/goal` |
| Large multi-part research or audit | Spawn parallel `investigator` subagents (Agent tool), one question each, then synthesize their reports |

Don't force everything through one pipeline. A rigid always-on orchestration adds tokens and generic-ness; pick the smallest structure per task.

## Reusable building blocks

- **`investigator` agent** — spawn (via the Agent tool) to research one thing in its own context and report back: bug root cause, feature approach, chore scope, or a research question.
- **`/mattpocock-skills:code-review`** — standards and spec review of a diff; prefer it over a bespoke verifier agent.
- **`/mattpocock-skills:diagnosing-bugs`** — when something is broken; confirm behavior in the running app with the `run` skill.

Subagents matter because they keep work in **separate context windows**, which structurally counters agentic laziness ("done" at 35/50), self-preferential bias (trusting your own output when verifying), and goal drift over many turns.

## Baseline hygiene

Branch, commit, verify and PR rules live in `AGENTS.md` (Git Workflow); one concern per commit. Verify with the quality gates and `/mattpocock-skills:code-review` before shipping, and fix pre-existing lint and type errors you meet.

## Don't over-engineer

Parallel subagents are for *complex, high-value* tasks and can use significantly more tokens. Most coding tasks do not need a panel of reviewers or a fan-out of agents. Start simple; escalate only when the task’s scope or risk demands it.
