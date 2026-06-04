---
name: intuitive-port-worktree
description: Port changes from one git worktree or checkout into the default repository folder's current branch, then by default sync the result to the remote default branch when everything is clean. Use when the user asks to move, copy, transfer, transplant, cherry-pick, apply a patch, or port worktree changes into the main/default repo checkout without changing the target branch.
---

# Intuitive Port Worktree

Use this skill to move a change set from a source worktree into the target
default repo checkout while preserving the target checkout's current branch.

The operation name depends on the method:

- **cherry-pick**: replay one or more source commits directly.
- **apply a patch**: apply a diff generated from the source.
- **manual patch port** or **manual cherry-pick**: map the same intent into a
  target branch whose files or APIs have diverged.
- **port changes** or **transplant changes**: generic phrasing for this workflow.

## Operating Rule

Do not switch the target repo to the source branch unless the user explicitly
asks. The target repo's current branch is the destination.

If source and target paths are explicit, execute autonomously. Ask only when the
source payload or target repo is ambiguous enough that the wrong choice would
overwrite unrelated work.

## Discovery

Collect this before editing:

```bash
git -C <source> status --short --branch
git -C <target> status --short --branch
git -C <source> rev-parse --show-toplevel
git -C <target> rev-parse --show-toplevel
git -C <target> worktree list --porcelain
git -C <source> log --oneline --decorate -10
git -C <target> log --oneline --decorate -10
```

Confirm whether the source and target share a git object database:

```bash
git -C <source> rev-parse --path-format=absolute --git-common-dir
git -C <target> rev-parse --path-format=absolute --git-common-dir
```

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

Useful inspection commands:

```bash
base=$(git -C <target> merge-base HEAD <source-ref>)
git -C <target> log --oneline --reverse "$base..<source-ref>"
git -C <target> diff --stat "$base..<source-ref>"
git -C <source> diff --stat
git -C <source> diff --cached --stat
```

## Safety Gate

Before modifying the target:

- Read the target status. Do not overwrite unrelated target changes.
- If target is dirty, check whether changed paths overlap the port. If they do,
  stop and ask; otherwise keep the edits separate.
- Create a lightweight backup branch in the target:

```bash
git -C <target> branch backup-before-port-$(date +%Y%m%d-%H%M%S) HEAD
```

Never run destructive cleanup commands. Do not remove remote folders.

## Application Strategy

Choose the least manual method that preserves intent.

### Direct Cherry-Pick

Use when the source commits are clean, relevant as commits, and likely to apply
to the target branch:

```bash
git -C <target> cherry-pick --no-commit <commit-or-range>
```

Use `--no-commit` first so verification can happen before creating a new commit.
If conflicts show the target code has materially diverged, abort and move to
manual patch port:

```bash
git -C <target> cherry-pick --abort
```

### Patch Apply

Use when the source and target share history but a direct cherry-pick is too
broad or the user wants tree changes rather than commit history:

```bash
git -C <target> diff --binary <base>..<source-ref> > /tmp/worktree-port.patch
git -C <target> apply --check --3way /tmp/worktree-port.patch
git -C <target> apply --3way /tmp/worktree-port.patch
```

For dirty source changes:

```bash
git -C <source> diff --binary > /tmp/worktree-port-unstaged.patch
git -C <source> diff --cached --binary > /tmp/worktree-port-staged.patch
git -C <target> apply --check --3way /tmp/worktree-port-staged.patch
git -C <target> apply --3way /tmp/worktree-port-staged.patch
git -C <target> apply --check --3way /tmp/worktree-port-unstaged.patch
git -C <target> apply --3way /tmp/worktree-port-unstaged.patch
```

### Manual Patch Port

Use when paths, APIs, package layout, generated files, or ownership boundaries
changed between source and target.

1. Read the source diff and target canonical files.
2. Map the behavior into the target's current modules and tests.
3. Avoid copying obsolete wrappers or stale paths when the target already has a
   newer canonical location.
4. Keep compatibility shims only if they still exist as target contracts.
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

## Verification

After applying changes:

```bash
git -C <target> diff --stat
git -C <target> diff --check
git -C <target> status --short
```

Run the smallest relevant project verification. Prefer repo-native commands
from docs, Makefile, or AGENTS.md. If the target is a Python worktree that uses
`activate.sh`, `uv_run.sh`, or `make`, use those rather than bare `uv run`.

If the source operation had known runtime evidence, rerun or cite the closest
target-side equivalent. Do not mark complete without some verification signal.

## Commit Policy

Auto-commit successful ports by default after verification passes when there was
no semantically large conflict. The user asked for a port, so the normal complete
state is a focused target commit, not merely staged changes.

Use one focused commit in the target. The message should describe the result,
not the transport mechanism, unless the port itself is the point.

Do not auto-commit when:

- verification failed or was skipped for reasons that make the port unsafe to
  claim complete;
- the target had overlapping local changes or unrelated staged changes that
  could be swept into the commit;
- the port required a semantically large decision as defined above;
- the user explicitly asked not to commit.

If the target has unrelated dirty changes on non-overlapping paths, commit only
the ported paths and leave unrelated work untouched.

## Auto-Sync Policy

After a successful auto-commit, sync the result to the remote by default. The
user who ports into the default checkout almost always wants that work to land
upstream, not sit as a local-only commit. Treat sync as the normal completion
state of a clean port.

"Sync" means two layers — do both when they apply:

1. **Land upstream**: get the ported commit(s) onto the remote default branch
   (e.g. `origin/main`). Push the commit, and integrate it via the route the
   remote actually allows.
2. **Fast-forward local**: bring the target checkout's default branch up to the
   integrated remote state so local and remote match.

Do NOT auto-sync — stop at the committed-but-unpushed state and report — when
any of these hold (they mirror and extend the auto-commit gate):

- the auto-commit gate did not pass, so there is no clean commit to sync;
- verification failed, was skipped, or only partially ran;
- the port required a semantically large decision;
- the target branch is not the remote default branch, OR the user did not ask to
  land on the default branch — pushing a feature/topic branch is fine, but
  merging into the default branch is the outward-facing, hard-to-reverse step;
- a backup or unrelated local branch would also be pushed by a broad push — push
  only the intended ref;
- the remote integration would require force-push, history rewrite, or bypassing
  a failing required check.

### How to sync

Discover the remote and its rules before acting — never assume:

```bash
git -C <target> remote -v                       # which remote is the GitHub/default origin
gh repo view --json nameWithOwner,defaultBranchRef
```

Pick the integration route by branch shape and remote policy:

- **Target branch IS the remote default branch, fast-forward only** (the common
  clean-port case where the port sits directly on top of the default branch):
  push directly.

  ```bash
  git -C <target> push origin HEAD:<default-branch>
  ```

- **Target is a topic branch the user wants merged into the default branch**:
  push the branch, open one PR, then merge via the route the repo allows. Probe
  which merge methods are enabled rather than hardcoding — repos disable squash
  or merge-commit and may allow only rebase:

  ```bash
  git -C <target> push -u origin <branch>
  gh pr create --base <default-branch> --head <branch> --title "<result>" --body "..."
  gh pr checks <n>                                # surface CI/required-check state
  # try the allowed method; fall back on "not allowed" errors:
  gh pr merge <n> --squash --auto --delete-branch \
    || gh pr merge <n> --merge --auto --delete-branch \
    || gh pr merge <n> --rebase --auto --delete-branch
  ```

  Use `--auto` so the merge waits on required checks. If required checks are
  pending or a protection rule blocks the merge, leave auto-merge armed and
  report that it will land when checks pass — do not bypass the gate.

After integration, fast-forward the local default branch and confirm parity:

```bash
git -C <target> pull --ff-only           # or fetch + reset to origin/<default> if detached
git -C <target> rev-list --left-right --count origin/<default-branch>...HEAD
```

A local post-merge hook may already fast-forward the checkout during the merge;
verify the actual `origin/<default>` vs `HEAD` state rather than assuming either
that it did or did not run.

Even with auto-sync on, the outward-facing merge into a shared default branch is
hard to reverse. Proceed without re-asking when the user has authorized landing
upstream in this request; otherwise push the branch and ask before merging.

## Final Report

Report:

- source path/ref and target path/branch
- method used: cherry-pick, patch apply, or manual patch port
- target commit hash if committed
- main files changed
- verification commands and outcomes
- sync outcome: pushed ref, PR number + merge method if opened, the resulting
  remote default-branch commit, and local-vs-remote parity — or, if auto-sync
  was withheld, which gate stopped it and the safe state left behind
- any residual risk, skipped checks, or source changes intentionally not ported

If the user asks what the operation is called, answer with the precise method
used and the generic name "porting changes between worktrees."
