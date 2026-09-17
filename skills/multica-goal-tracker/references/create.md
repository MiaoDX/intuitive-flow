# Create from preflight

## Create From Preflight

Use this after an `$intuitive-preflight` contract is approved and before the
goal is executed. The preflight must be `DRAFT`/approved, not
`BLOCKED_NEEDS_DECISION`, and it must contain either `Main-session /goal prompt`
or `To execute` with the executable `/goal`.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  create-from-preflight \
  --preflight-file /tmp/preflight.md \
  --workspace-id product-workspace
```

Never rely on the Multica CLI default workspace when creating an issue from a
preflight. The default workspace may point at another product. If the user gives
a URL such as `https://multica.example.test/product-workspace/`, pass
`--workspace-id product-workspace` or the full URL so the script can resolve and verify
the real workspace id before writing.

Keep `create-from-preflight` issue descriptions intentionally short. Do not
paste the full `## Preflight Contract` into the issue body; the plan file is
the source of truth for detailed scope, non-goals, context, and verification.
Humans should be able to scan the issue quickly, then open the plan only when
they need the full contract.

Use `--dry-run` first when validating a new preflight shape. Run
`bun skills/multica-goal-tracker/scripts/track_goal.ts --help` for the current
option surface.

Do not use `create-from-preflight` for conversation-only work unless the
preflight body contains the full approved contract; otherwise context
compression can erase the issue's source of truth. Do not treat the created
issue or start comment as completion evidence. Finish evidence still must come
from a real run/session as described below.
