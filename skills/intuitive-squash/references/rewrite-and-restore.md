# Approved rewrite and restoration

Read immediately before executing an approved squash plan.

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
