---
name: intuitive-squash
description: Safely rewrite noisy local history into reviewable commits, with aggressive or moderate plan choices, when the user explicitly asks to squash.
disable-model-invocation: true
---

# Intuitive Squash

Turn noisy local history into reviewable commits without changing the final tree.
Read [planning](references/planning.md) to resolve the base, run the bundled
read-only preflight, identify preserved commits, and propose the commit map.
Do not mutate branches or the worktree during planning.

## Modes

Offer both modes by default, unless the user requests one exact strategy:

| Mode | Commit shape |
| --- | --- |
| **Aggressive** | The fewest coherent reviewable commits, while keeping preserved commits and unrelated change surfaces separate. |
| **Moderate** | Semantic review and rollback boundaries with phase and fixup churn removed; prefer this for large or high-risk branches. |

State the recommended mode and why, then use the mode the user approves for the
commit map. For a small stack, the plans may differ only slightly; do not invent
splits to make them look different.

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
