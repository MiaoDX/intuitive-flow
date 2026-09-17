# Authorized upstream sync

Read only when the user has requested pushing or landing the verified port.

## Sync Policy

After a successful auto-commit, stop with the local commit unless the user has
explicitly authorized pushing or landing the result upstream in this request.
Porting into the default checkout does not imply publication.

"Sync" means two layers — do both when they apply:

1. **Land upstream**: get the ported commit(s) onto the remote default branch
   (e.g. `origin/main`). Push the commit, and integrate it via the route the
   remote actually allows.
2. **Fast-forward local**: bring the target checkout's default branch up to the
   integrated remote state so local and remote match.

Stop at the committed-but-unpushed state and report when any of these hold:

- the auto-commit gate did not pass, so there is no clean commit to sync;
- verification failed, was skipped, or only partially ran;
- the port required a semantically large decision;
- the target branch is not the remote default branch, or the user did not ask to
  land on the default branch;
- a backup or unrelated local branch would also be pushed by a broad push — push
  only the intended ref;
- the remote integration would require force-push, history rewrite, or bypassing
  a failing required check.

### How to sync

Discover the remote and default branch before acting; never assume `origin/main`.

Pick the integration route by branch shape and remote policy:

- **Target branch IS the remote default branch, fast-forward only** (the common
  clean-port case where the port sits directly on top of the default branch):
  push `HEAD:<default-branch>` directly.

- **Target is a topic branch the user wants merged into the default branch**:
  push the branch, open one PR, inspect checks, then merge via the route the
  repo allows. Probe allowed merge methods rather than hardcoding one.

  Use `--auto` so the merge waits on required checks. If required checks are
  pending or a protection rule blocks the merge, leave auto-merge armed and
  report that it will land when checks pass — do not bypass the gate.

After integration, fast-forward the local default branch and confirm
`origin/<default>` vs `HEAD` parity.

A local post-merge hook may already fast-forward the checkout during the merge;
verify the actual `origin/<default>` vs `HEAD` state rather than assuming either
that it did or did not run.

The outward-facing merge into a shared default branch is hard to reverse. Only
push or merge after the user authorizes that action in the current request.
