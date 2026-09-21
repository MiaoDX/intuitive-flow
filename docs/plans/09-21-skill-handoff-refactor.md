# Skill Handoff Refactor

## Plan Ledger

- Plan status: DONE
- Session scope: skill-handoff-refactor
- Last updated: 2026-09-21
- Current slice: Six accepted handoff corrections implemented and verified.
- Next action: none
- Blocked on: none
- Do not touch from this session: unrelated tooling, historical plans, user configuration

## Accepted Contract

The user approved all six findings, requested restoring `gsd-verify-work`, and
prefers date-prefixed new plans while preserving existing repo conventions.

- Restore the GSD verification skill to the normal managed install.
- Route unsettled product bets to Shape and preserve its downstream constraints.
- Give plan selection one shared owner with `docs/plans/MM-DD-<slug>.md` as
  the fallback recommendation; preserve existing canonical sources.
- Replace conflicting evidence levels with concrete proof requirements.
- Choose main-session or worker execution by task needs.
- Resolve runner scripts from the loaded skill rather than the target repo.

The prior review supplies the architecture packet: callers are Flow and routed
specialists; shared plan selection and proof selection own the cross-skill
contracts; the allowlist owns installed dependencies. Keep existing specialist
roles and remove duplicate policy instead of adding an orchestration layer.

## Acceptance And Proof

- Normal GSD selection and pruning retain `gsd-verify-work`.
- Shape routes raw product decisions, with settled fixes and approved execution
  continuing through their existing owners.
- Existing plans retain their paths; a repo without conventions gets a dated
  recommendation without a new approval gate.
- Refactor handoffs name proof commands, observed behavior, and success criteria.
- A bounded sequential multi-step task may execute directly with durable state
  when needed; worker use names its concrete benefit.
- A runner copied outside the target repo supports help and dry-run from that repo.
- Run focused installation/runner tests, `bun run verify`, stale-rule searches,
  and manual routing scenarios against the changed instructions.

## Scope And Stop

Update owning human docs and existing tests with the skill contracts. Do not
add dependencies, run the global updater, migrate existing target-repo plans,
or launch paid agent runs. Commit the verified owned slice; stop when the six
accepted fixes and proof are complete.

## Verification Evidence

- Focused installation and runner tests: 42 passed. Both host install layouts
  reject a current-version installation missing verification, then retain the
  restored wrapper during pruning.
- Runner proof copies scripts outside a separate target Git repo, exercises
  both help commands and dry-run, and checks the recorded working directory.
  The target has no `skills/` directory; no worker process starts.
- `bun run verify`: 172 passed, zero failures; shellcheck, TypeScript, and
  skill-resource checks passed. `git diff --check` passed.
- Manual instruction walkthrough: an unsettled bet routes to Shape; a typo
  and an approved plan bypass shaping; existing plan paths are preserved;
  a repo without conventions receives a dated recommendation; a sequential
  multi-step task can stay in the main session; proof names distinguish mock
  checks from real-runtime checks. This is static review, not live model evaluation.
- Scope addition: the GSD current-version check now detects missing selected
  wrappers so restoring an allowlist entry actually takes effect on update.
- Installed user tooling was not updated. No remaining in-scope work or parked
  follow-ups; this change makes no new live-model quality claim.
