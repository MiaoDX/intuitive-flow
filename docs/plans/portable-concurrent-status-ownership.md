# Portable Concurrent Status Ownership

## Plan Ledger

- Plan status: ACTIVE
- Session scope: portable-concurrent-status-ownership
- Parent plan: none
- Child plans: none
- Last updated: 2026-07-17
- Current slice: portable source contract and installation checks complete
- Next action: run real Codex and Claude target-repository product scenarios
- Blocked on: none
- Do not touch from this session: unrelated workflow, installer, or documentation cleanup

## Goal

Make concurrent status maintenance safe in every repository that uses the
installed Intuitive skills without imposing this source repository's file
layout, package manager, validation commands, or status artifacts.

## Scope

- Define project integrator, task control plane, and worker write authority in
  the portable installed skill contract.
- Discover and respect target-repository project-status and task-resume
  conventions before using Intuitive defaults.
- Make project-status integration conditional and materiality-based.
- Define ownership-conflict, handoff, checkpoint, and terminal-capsule rules.
- Align Flow, Refactor, Skill Runner, Init, and closeout wording that consumes
  the shared contract.
- Add source-repository contract, sync, and target-scenario fixtures without
  making their toolchain a target-repository dependency.
- Run installed-skill product scenarios through Codex and Claude.
- Reconcile this repository's closed campaign capsule as a separate dogfood
  migration.

## Non-Goals

- No universal `STATUS.md`, mandatory status directory, machine schema, lock,
  lease, database, or aggregate dashboard.
- No target-repository mutation during skill installation.
- No mandatory Bun, Node, Python, hook, package manifest, or CI dependency in
  target repositories.
- No general concurrent code-edit ownership system.

## Accepted Contract

- Existing target-repository guidance and equivalent status paths win.
- A missing project-status surface is skipped, not created or treated as an
  error.
- Durable task state uses a repo-defined path, an already adopted active path,
  or `docs/status/active/<task-slug>.md` when artifact creation is allowed. If
  repository artifacts are forbidden, host/session persistence is allowed with
  the reduced cross-session durability reported explicitly.
- The task control plane is the sole writer of its capsule and canonical task
  state. Workers return evidence and handoffs only unless explicitly promoted.
- Only an explicit umbrella/project integrator writes shared project status.
  Other task sessions return `project-status delta: none|material`.
- Terminal state leaves the active namespace after canonical reconciliation.
  Deletion is the default; an existing local audit/history policy may override
  the destination.
- Existing target artifacts migrate only when touched by resume, closeout, or
  an explicit initializer refresh.

## Acceptance Criteria

- Installed Flow and Refactor expose the same ownership, path-selection, and
  terminal-lifecycle contract.
- Targets without `STATUS.md`, `docs/status/active/`, `package.json`, Bun, or a
  local validator still run normally.
- Coordinated launches assign one task control plane before workers start, and
  visible ownership conflicts stop status mutation. Independent tasks keep
  separate capsules. This cooperative contract does not claim lock-level
  exclusion for simultaneous uncoordinated processes.
- Project status changes only for material project truth and only through an
  explicit project integrator.
- Canonical evidence and remaining work are reconciled before terminal active
  state is removed.
- Skill installation updates packages only and never migrates target repos.
- Source-repository dogfood cleanup is visibly separate from portable behavior.

## Verification

- Source contract and exact stale-guidance searches across shared, Flow,
  Refactor, Skill Runner, Init, and closeout surfaces.
- Target scenario fixtures for missing project status, missing/default/custom
  capsule paths, artifact-forbidden repos, two concurrent tasks, ownership
  conflict, blocked closeout, and terminal cleanup.
- Installed mirror verification for root skills and `_shared` resources.
- Focused Bun tests, `bun run check:skills`, `bun run verify`, and
  `git diff --check` in this source repository only.
- Real installed-skill product runs through Codex and Claude against temporary
  target repositories; inspect the resulting artifacts and handoffs.

## Shipped Evidence

- Portable ownership, path selection, lifecycle, closeout, Refactor, Runner,
  and conditional Init adoption contracts implemented in the repo-owned skill
  sources.
- Fresh-home skill sync now creates host skill roots before mirroring root and
  `_shared` resources; it does not touch target repositories.
- Focused portable-contract and sync tests: 13 passed.
- `bun run check:skills`, `bun run check:shell`, and `bun run check` passed.
- Read-only changed-code review found two P1 portability gaps; both were fixed:
  Hot Resume now respects host/session persistence, and the plan now states the
  cooperative ownership limit instead of claiming lock-level exclusion.

## Stop Gates

- Stop rather than mutate shared status when project or task ownership is
  ambiguous.
- Stop completion if required Codex or Claude product-run evidence is missing.
- Ask for re-approval before adding a machine schema, mandatory runtime,
  installer-side target migration, locking, or a new canonical status surface.

## Unknown-Unknown Review

Completed by the approved agent planning loop. Entropy and document-grill
scouts converged on the contract above; source-repo-only enforcement, universal
status creation, archives by default, locks, and dashboards were rejected.
