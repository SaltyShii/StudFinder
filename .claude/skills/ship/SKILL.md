---
name: ship
description: Close out a coding session. Spawns the change-triage agent, then follows the commit, merge and deploy flow its docs/light/full verdict calls for. Use after /mattpocock-skills:code-review or /mattpocock-skills:retro, or when the user skips the retro.
---

# Ship

Close out finished work with the smallest flow the change needs.

## Steps

1. Spawn the `change-triage` agent (Agent tool, `subagent_type: change-triage`). Pass the current branch and, for a stacked PR, its base. If that agent type is not registered in the session, spawn a haiku `general-purpose` agent told to follow the body of `.claude/agents/change-triage.md`. Its one-line verdict is the tier; record it in your reply.
2. If `main` moved since the branch started, rebase onto it before the gates. Run the flow for that tier:

| Tier | Gate | Then |
|---|---|---|
| docs | pre-commit hook only | commit; open and merge the PR (steps 3-5) |
| light | `npm run check` | commit |
| full | `npm run check` and `npm run build -w apps/web` | commit; write the PR body with `/mattpocock-skills:pr`; merging to `main` deploys to GitHub Pages (`deploy-pages.yml`); report the Pages URL |

3. Open the PR: ask the user once ("push `<branch>`, open a PR against `<base>` and merge it?"). Invoking `/ship` does not count as approval. On yes, `git push -u origin <branch>`, then `gh pr create --base <base> --title <commit-style title> --body-file <body>` (full uses the `/mattpocock-skills:pr` body; light uses the commit body). If `gh pr create` hits the Projects classic error, fall back to `gh api repos/{owner}/{repo}/pulls`. Add one `Closes #N` per line for resolved issues (`Closes #1, #2` closes only #1). Report the PR URL.
4. The user's yes in step 3 also approves the merge. Wait for the PR's checks with `timeout 120 bash -c 'until ! gh pr checks N | grep -q pending; do sleep 3; done'` (a chained `sleep` is blocked by the harness). Once `gh pr checks N` is green, merge it with `gh api -X PUT repos/{owner}/{repo}/pulls/N/merge -f merge_method=merge`. Merge stacked PRs bottom-up, retargeting the next one to `main` after each. If checks fail or the auto-mode classifier denies the merge ("Merge Without Review"), stop and tell the user; they merge in the browser.
5. After the merge, close the issues the PR resolves, edit or close open tickets whose terms the PR changed, delete merged branches (local and remote), checkout and fast-forward `main`, and run `git worktree prune`. Pull with `timeout 60 git pull -q --ff-only`; on a hang use `git -c credential.helper='!gh auth git-credential' pull -q --ff-only https://github.com/SaltyShii/StudFinder.git main`.

Done when the verdict is stated, its gates are green, the PR is merged and cleaned up, or the blocker is named.
