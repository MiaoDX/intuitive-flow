---
name: intuitive-squash
description: Squash local GSD or agent-generated commit history into a clean, reviewable story while preserving important fixes. Use when the user asks to squash commits, clean git history, compress phase commits, prepare a branch before PR, compare aggressive vs moderate squash options, or preserve hotfix/security commits during squash in Claude Code or Codex.
disable-model-invocation: true
---

# Intuitive Squash

Use this skill to turn noisy local agent history into a small set of meaningful
commits without changing the final tree.

This is a history-rewrite workflow. Do not proceed past the proposed plan until
the user explicitly confirms it.

## Inputs

- Optional base ref from the user.
- If no base is provided, discover the likely integration base from repo state
  and confirm it before building the squash plan. Never silently fall back to
  `origin/main` or `origin/master` just because those refs exist.
- Treat the current branch only as the rewrite target.

## Base Ref Discovery

If the user gives a base ref, verify it exists and use the merge base with that
ref.

If no base is provided, inspect the repository before choosing:

```bash
git fetch --prune --all
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
git remote show origin
git for-each-ref --sort=-committerdate \
  --format='%(refname:short) %(committerdate:short) %(subject)' \
  refs/remotes/origin
git branch -vv
gh pr view --json baseRefName,headRefName,url
```

It is fine if `git fetch` or `gh pr view` is unavailable; continue with local
refs and say which evidence is missing.

Rank base candidates by evidence:

1. The open PR base branch, when `gh pr view` finds one.
2. A user-configured upstream only when it is clearly the integration branch,
   not merely the current branch's remote push target.
3. The remote default branch from `origin/HEAD` or `git remote show origin`,
   unless it appears stale compared with another long-lived remote branch.
4. Active long-lived remote branches such as `origin/dev`, `origin/develop`,
   `origin/trunk`, release branches, or the most recently updated remote branch
   that plausibly contains the branch point.
5. `origin/main` or `origin/master` only after the checks above do not produce a
   better candidate.

For each plausible candidate, compare:

```bash
git merge-base HEAD <candidate>
git rev-list --count "$(git merge-base HEAD <candidate>)"..HEAD
git log -1 --format='%ci %s' <candidate>
```

If `origin/main` or `origin/master` is much older than another plausible
long-lived branch, treat it as ambiguous or stale rather than as the default.

Before commit analysis, show the detected candidates, the recommended base, and
the reason. Ask the user to confirm the base when:

- no single candidate is clearly strongest;
- the best candidate is not the remote default branch;
- the remote default branch looks stale;
- the current branch's upstream is its own remote counterpart; or
- using a different base would materially change the commit count.

Ask: `Use <recommended-base> as the squash base, or should I use another ref?`
Do not build the squash plan until the base is explicit or confirmed.

## Safety Protocol

1. Resolve the base ref using the Base Ref Discovery rules.
2. Check `git status --porcelain`.
3. If the worktree is dirty, stash it with a timestamped name such as
   `intuitive-squash-temp-YYYYMMDD-HHMMSS`.
4. Create a backup branch before rewriting:
   `backup-before-intuitive-squash-YYYYMMDD-HHMMSS`.
5. Tell the user the backup branch name.
6. Analyze commits from base to `HEAD` in chronological order.
7. Present squash plan options and ask for confirmation.
8. Only after confirmation, run the history rewrite.
9. Verify the final tree matches the backup branch.
10. Restore any temporary stash.

If verification fails, stop and restore from the backup branch.

## Preserve Rules

Never squash these commits into a generic milestone:

- Subjects or bodies containing explicit preservation markers:
  - `DO NOT SQUASH`
  - `[PRESERVE]`, `PRESERVE:`, `PRESERVE -`, or `PRESERVE /`
  - `[KEEP]`, `KEEP:`, `KEEP -`, or `KEEP /`
- Subjects or bodies containing explicit high-risk markers:
  `[IMPORTANT]`, `IMPORTANT:`, `[CRITICAL]`, `CRITICAL:`,
  `[SECURITY]`, `SECURITY:`, or `CVE-`.
- Type prefixes such as `hotfix:`, `critical:`, or `security:`.
- Fix commits that reference issues or tickets, such as `fix: #123`,
  `fixes PROJ-456`, or `closes #789`.
- Commits touching safety-critical paths from `.planning/config.json`
  `preserve_paths`, when present.
- Commits from an external author relative to the main local committer.

Preserved commits stay as standalone `pick` commits in every proposed plan.
Follow-up fixups that clearly target a preserved commit may be squashed into
that preserved commit, but not into a milestone group.

Do not treat ordinary words as preserve markers. Subjects such as
`fix: keep the process alive`, `refactor: preserve source frame metadata`, or
`docs: important setup note` are not preserved by this rule unless they use one
of the explicit marker forms above or match another preserve rule.

## Plan Options

Default to two proposed plans unless the user asks for one exact strategy:

- **Aggressive**: compress the branch into the fewest reviewable commits. This
  is useful for agent noise, but it must still keep preserved commits separate
  and avoid mixing unrelated runtime, docs, tests, and dependency changes into
  a vague mega-commit.
- **Moderate**: keep semantic review boundaries while still removing fixup and
  phase-churn noise. This should usually be the recommended plan for large or
  high-risk branches, especially when the history spans multiple subsystems,
  runtime behavior, tests, docs, or dependency changes.

For small stacks, the two plans may differ only slightly. Say that explicitly
instead of inventing artificial splits.

For large stacks, a moderate plan often lands around 12-18 commits. Treat that
as a reviewability target, not a hard rule: use fewer commits for a narrow
feature and more only when the branch genuinely has independent semantic
surfaces.

## Grouping Heuristics

Build commits that a reviewer can understand, test, and revert as a coherent
unit. Prefer semantic commits over purely date-based, phase-number-based, or
prefix-based grouping.

Group squashable commits by:

- phase markers such as `phase-N`, `Phase N:`, `[P N]`, `[Phase N]`
- issue or quick-task markers
- conventional prefixes such as `feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, and `chore:`
- changed paths and conceptual intent

Separate commits when they represent different review or rollback surfaces:

- dependency or environment changes
- public API or contract changes
- runtime behavior changes
- tests, harnesses, and validation gates
- documentation-only truth updates
- mechanical moves or renames
- experimental probes versus promoted production behavior

Merge tiny related phases. Split very large phases into implementation and
tests/docs commits when that makes review clearer. Keep breaking changes
separate when the commit message or config asks for it.

Avoid over-aggressive groups with generic names such as `feat: update project`
or `refactor: cleanup`. If a proposed commit needs several unrelated clauses in
the subject to explain itself, split it in the moderate plan.

## Plan Format

Before rewriting, show:

- base ref, why it was chosen, alternatives considered, and commit count
- backup branch name
- proposed final commits, in order, for both `Aggressive` and `Moderate`
- original commits included in each final commit
- preserved commits with `[PRESERVED]` and the reason
- any dirty-worktree stash that will be restored
- recommended option and why

Ask: `Any other commits you want to preserve or squash?`

## Rewrite And Verify

Use interactive rebase or another git-native rewrite mechanism. Preserved
commits must remain `pick`. Squashed milestone commit messages should be clean
and human-readable, with a concise body describing the included changes.

After the rewrite:

```bash
git diff --exit-code backup-before-intuitive-squash-YYYYMMDD-HHMMSS..HEAD
git diff-tree --quiet backup-before-intuitive-squash-YYYYMMDD-HHMMSS HEAD
```

Also verify preserved commit subjects still appear in `git log --oneline`.

Report the new history, the backup branch, any restored stash, and whether a
force push is needed.
