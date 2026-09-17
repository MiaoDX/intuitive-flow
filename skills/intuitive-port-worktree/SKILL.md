---
name: intuitive-port-worktree
description: Port commits or patches between worktrees when explicitly requested; preserve the target branch and unrelated edits.
disable-model-invocation: true
---

# Intuitive Port Worktree

Port selected commits or patches into the target checkout's current branch.
Do not switch it to the source branch. Resolve source, target, and payload from
the request; ask only if ambiguity risks moving the wrong work.

Inspect target status before editing, preserve unrelated changes, and stop for
unclear overlapping edits. Create a backup-before-port-<timestamp> branch before
applying. Never use destructive cleanup or remove remote folders.

Read [application](references/application.md) to select the payload and choose
cherry-pick, patch, or manual reconstruction. Resolve mechanical drift while
preserving intent; ask when source/target differences require a new contract,
private-data, safety, or scope decision.

## Verification

After applying changes:

Run `git diff --stat`, `git diff --check`, and `git status --short` in the
target.

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

A verified port finishes as a local commit. Pushing or merging requires explicit
user authorization; read [upstream sync](references/upstream-sync.md) only then.
Report source/target, method, commit, changed paths, verification, skipped source
changes, and sync outcome or the local state left for handoff.
