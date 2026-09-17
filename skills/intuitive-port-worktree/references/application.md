# Applying a selected payload

Read before applying commits or patches; use the method suited to target divergence.

## Discovery

Collect this before editing:

- status, root path, branch, recent commits, and target worktree list;
- whether source and target share `rev-parse --path-format=absolute --git-common-dir`.

If they do not share a git common dir, the workflow can still use patches, but
commit refs from the source may not resolve in the target.

## Payload Selection

Prefer the smallest faithful payload:

1. If the user names commit hashes, use those commits.
2. If the source branch has local commits not in target, inspect the range from
   the merge base to source `HEAD`.
3. If the source worktree is dirty, include staged and unstaged diffs only after
   confirming they are intentional from `git status` and `git diff --stat`.
4. If both commits and dirty changes exist, port commits first, then dirty diffs.

Inspect commit ranges and dirty diffs with `git log --oneline --reverse` and
`git diff --stat` before selecting the payload.

## Application Strategy

Choose the least manual method that preserves intent.

### Direct Cherry-Pick

Use when the source commits are clean, relevant as commits, and likely to apply
to the target branch. Use `git cherry-pick --no-commit <commit-or-range>` first
so verification can happen before creating a new commit.

If conflicts show the target code has materially diverged, abort and move to
manual patch port.

### Patch Apply

Use when the source and target share history but a direct cherry-pick is too
broad or the user wants tree changes rather than commit history. Generate a
binary patch from source, run `git apply --check --3way`, then apply. For dirty
source changes, handle staged and unstaged patches separately.

### Manual Patch Port

Use when paths, APIs, package layout, generated files, or ownership boundaries
changed between source and target.

1. Read the source diff and target canonical files.
2. Map the behavior into the target's current modules and tests.
3. Avoid copying obsolete wrappers or stale paths when the target already has a
   newer canonical location.
4. Do not recreate compatibility shims unless the target branch explicitly
   treats them as current contracts.
5. Preserve user-facing behavior and tests from the source change, not the old
   file layout.

## Semantic Conflict Policy

Classify conflicts by whether they require a durable meaning decision, not by
whether Git printed conflict markers.

Treat these as **not semantically large** and continue autonomously:

- clean cherry-picks or patch applies;
- context-line drift, adjacent documentation edits, import/order churn, or
  formatter-only changes where the source intent is unchanged;
- manual ports where the target has a newer canonical location but the behavior,
  public contract, private-data boundary, and verification gate stay equivalent.

Treat these as **semantically large** and stop before committing:

- public API, command surface, MCP/tool contract, file layout, or data-schema
  changes that have diverged between source and target;
- safety, security, credential, private-data, cost, or external-infrastructure
  boundaries that are different on the target;
- acceptance criteria, rollout gates, or verification gates that contradict the
  source change;
- source and target implementations that solve the same problem differently and
  choosing one would discard meaningful behavior;
- overlapping target-local edits where it is unclear whether the user wanted
  those edits included in the port.

When a conflict is not semantically large, resolve it, verify it, and proceed to
the auto-commit policy below. When it is semantically large, leave the target in
a clean or clearly paused state, report the decision needed, and do not commit.
