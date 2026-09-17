---
name: intuitive-squash
description: Safely rewrite noisy local history into reviewable commits when the user explicitly asks to squash.
disable-model-invocation: true
---

# Intuitive Squash

Turn noisy local history into reviewable commits without changing the final tree.
Read [planning](references/planning.md) to resolve the base, run the bundled
read-only preflight, identify preserved commits, and propose the commit map.
Do not mutate branches or the worktree during planning.

Keep marked, security/hotfix, configured-path, and other-author commits standalone
as the preflight requires. Disclose publication, merge, signature, and tag risks;
record the original-to-final mapping, planned HEAD, backup, and stash strategy.
Never rewrite until the user approves the exact plan and applicable risk gates.

Once approved, read [rewrite and restore](references/rewrite-and-restore.md).
Recheck planned state, back up before rewriting, verify final tree equality and
preserved commit mappings, then restore dirty work. Keep the backup; retain the
stash on verification failure or restoration conflict. Report proof and recovery
state. Push only when separately authorized, with an explicit expected-old-OID
lease if rewriting published history.
