# Active: Portable Concurrent Status Ownership

Capsule status: ACTIVE
Source plan: `docs/plans/portable-concurrent-status-ownership.md`
Task integrator: current root Codex session
Project-status writer: current root Codex session for this coordinated run
Latest user intent: execute the approved portable skill-contract preflight.

Current slice: run isolated installed-skill product scenarios through Codex and
Claude.

Last proof:
- focused portable-contract and fresh-home sync tests: 13 PASS
- `bun run check:skills` PASS
- `bun run check:shell` PASS
- `bun run check` PASS
- `git diff --check` PASS
- read-only portability review blockers fixed and reverified

Next action: materialize the current repo-owned skills into isolated worker
homes and exercise target repos without project status and with local
equivalent state conventions.

Next proof: inspect Codex and Claude result artifacts, task state, project-status
delta, and target-repo diffs; then run full `bun run verify`.

Stop condition: all source and product-run acceptance criteria in the source
plan pass, then reconcile the plan and remove this capsule from `active/`.

No-touch scope: unrelated workflow behavior, installer semantics, vendored
tools, and target-repository files outside isolated product fixtures.

Parked work: machine schemas, locks, leases, target-side mandatory validators,
and aggregate dashboards.
