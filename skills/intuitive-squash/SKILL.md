---
name: intuitive-squash
description: Squash local GSD or agent-generated commit history into a clean, reviewable story while preserving important fixes. Use when the user asks to squash commits, clean git history, compress phase commits, prepare a branch before PR, compare aggressive vs moderate squash options, or preserve hotfix/security commits during squash in Claude Code or Codex.
disable-model-invocation: true
---

# Intuitive Squash

Turn noisy local agent history into a small set of meaningful commits without
changing the final tree. After an optional fetch, keep planning free of
worktree and local-branch mutations. Never rewrite history until the user
approves the exact plan and its risk gates.

## Resolve The Base

If the user gives a base ref, verify it and use its merge base with `HEAD`.
Otherwise inspect:

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

Continue with local evidence if fetch or GitHub CLI access is unavailable, and
say what is missing. Rank candidates by:

1. the open PR base;
2. a configured upstream only when it is an integration branch rather than the
   current branch's push target;
3. the remote default branch, unless stale;
4. active long-lived branches such as `dev`, `develop`, `trunk`, or a release
   branch that plausibly contains the branch point;
5. `main` or `master` only when no stronger evidence exists.

For plausible candidates compare merge base, branch commit count, and latest
commit date. Ask `Use <recommended-base> as the squash base, or should I use
another ref?` when the evidence is ambiguous, the recommendation is not the
remote default, the default looks stale, the upstream is the branch's own
remote counterpart, or the commit count changes materially. Do not analyze or
plan groups until the base is explicit.

## Run Read-Only Preflight

After resolving the base, run:

```bash
bun <intuitive-squash-skill-root>/scripts/preflight.ts <base-ref> \
  --remote-default <remote/default-branch>
```

The report inventories the exact merge base and `HEAD`, dirty and untracked
state, upstream divergence, remote publication, merges, signatures, tags,
authors, changed paths, and deterministic preservation reasons. Treat the
reported `HEAD` as the planned head; rerun preflight if it changes before
execution. Omit `--remote-default` only when discovery could not identify one;
the script otherwise falls back to a local `origin/HEAD` symbolic ref. Exit 3
means the report contains a hard stop, not that its read-only probes failed.

Stop instead of planning when:

- `HEAD` is detached, the range is empty, or the current branch is the detected
  remote default branch;
- the base cannot be resolved or no merge base exists;
- repository state makes the rewrite target unclear.

Resolve these decision gates before approval:

- **Published history:** disclose affected remote refs and PR review impact.
  Rewriting requires explicit user consent. Never push as part of squash unless
  separately requested; use an expected-old-OID lease rather than plain force.
- **Merge commits:** recommend preserving topology with `--rebase-merges`.
  Flatten only when the user explicitly accepts topology loss.
- **Signed commits:** explain that rewriting changes commit identities and
  invalidates signatures. Preserve or re-sign only through an agreed strategy.
- **Tags:** do not move or recreate tags implicitly. Ask how each tag pointing
  into the rewritten range should be handled.

## Preserve Commits

Keep commits standalone when preflight marks them for any of these reasons:

- explicit markers: `DO NOT SQUASH`, `[PRESERVE]`, `PRESERVE:`,
  `PRESERVE -`, `PRESERVE /`, `[KEEP]`, `KEEP:`, `KEEP -`, or `KEEP /`;
- high-risk markers: `[IMPORTANT]`, `IMPORTANT:`, `[CRITICAL]`, `CRITICAL:`,
  `[SECURITY]`, `SECURITY:`, or `CVE-`;
- `hotfix:`, `critical:`, or `security:` type prefixes;
- issue-closing fixes such as `fix: #123`, `fixes PROJ-456`, or
  `closes #789`;
- paths matched by `.planning/config.json` `preserve_paths`;
- an author email different from the configured local author after mailmap
  normalization.

Do not infer markers from ordinary prose such as `keep the process alive`,
`preserve source metadata`, or `important setup note`. A follow-up fixup may be
squashed into its preserved commit when the plan names that mapping, but never
into a generic milestone.

Record each preserved commit's original OID, author, full message, and planned
new commit. If no fixup joins it, verify its stable patch ID after rewriting. If
fixups join it, verify the planned mapping, author, full message, and standalone
position instead of pretending its patch ID can stay unchanged.

## Build The Plan

Default to two options unless the user requests one strategy:

- **Aggressive:** the fewest coherent, reviewable commits without absorbing
  preserved commits or mixing unrelated runtime, docs, tests, and dependency
  work into a vague mega-commit.
- **Moderate:** semantic review and rollback boundaries with phase/fixup churn
  removed. Recommend this for large or high-risk branches.

Group by intent, phase or issue marker, conventional prefix, and changed paths.
Separate dependencies, public contracts, runtime behavior, tests, docs-only
truth, mechanical moves, and experiments when they are independent review or
rollback surfaces. The two options may differ only slightly for a small stack;
do not invent splits. Treat 12-18 moderate commits for a large stack as a
reviewability signal, not a quota.

Before changing repository state, show:

- base ref, merge base, planned `HEAD`, alternatives, and commit count;
- publication, merge, signature, tag, branch, and dirty-worktree risks;
- proposed final commits in order for both options;
- every original commit mapped to a final commit;
- preserved commits marked `[PRESERVED]` with reason and verification method;
- the planned backup branch and stash names;
- the recommended option and why.

Ask: `Any other commits you want to preserve or squash?` Proceed only after the
user explicitly chooses a plan and accepts every applicable decision gate.

## Execute After Approval

Immediately before rewriting:

1. Rerun preflight and stop if `HEAD`, base, branch, publication, tags, or dirty
   state differs materially from the approved report.
2. If dirty, run `git stash push --include-untracked --message
   intuitive-squash-temp-YYYYMMDD-HHMMSS`. Record the resulting stash OID and
   confirm the worktree is clean. Do not include ignored files unless the user
   explicitly asks.
3. Create `backup-before-intuitive-squash-YYYYMMDD-HHMMSS` at the planned
   `HEAD`, confirm its OID, and report the name.
4. Use interactive rebase or another Git-native rewrite. Keep preserved commits
   as `pick`; use `--rebase-merges` when the approved plan preserves topology.
5. If rebase conflicts change the approved grouping or preserved patch intent,
   stop for review rather than improvising a different history.

Do not delete the backup branch or temporary stash during this workflow.

## Verify And Restore

Require all of the following before restoring dirty work:

```bash
test "$(git rev-parse HEAD^{tree})" = \
  "$(git rev-parse backup-before-intuitive-squash-YYYYMMDD-HHMMSS^{tree})"
git diff --exit-code backup-before-intuitive-squash-YYYYMMDD-HHMMSS HEAD --
git status --porcelain
```

- Verify the final commit map and count against the approved plan.
- Verify preserved commits using the recorded author, full message, standalone
  mapping, and patch-ID rule above; a subject-only search is insufficient.
- Run focused repository tests when conflict resolution or manual reconstruction
  occurred, even when tree OIDs match.
- Inspect `git range-diff <merge-base>..backup-branch
  <merge-base>..HEAD` as review evidence, not as an automatic pass/fail gate.

If committed-tree verification fails, abort any active rebase, leave the stash
intact, restore the target branch to the backup OID, and report the failure. Do
not continue with a partially verified history.

If verification passes, restore the recorded stash with `git stash apply
--index <stash-oid>`. Confirm restoration and only then drop the matching stash
entry. If apply conflicts, stop, keep the stash entry, and report the conflict.

Report the new history, verification evidence, backup branch, stash outcome,
preserved mappings, and whether a separately requested push would require
`git push --force-with-lease=refs/heads/<branch>:<expected-old-oid> <remote>
HEAD:<branch>`.
