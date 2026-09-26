# GSD Handoff And Execution

Use this reference after a plan has an approved execution contract and any
risk-triggered scout findings have been reconciled into the canonical plan, or
when a GSD phase already owns execution.

GSD is an execution handoff route, not the default storage location for a plan.
The normal sequence is: create or update the target repository's canonical
`docs/plans/<slug>.md`, review/reconcile it, obtain the execution contract, then
hand off to GSD when implementation is requested. `agent-planning-loop` alone
does not authorize or perform that handoff. A planning-only request stops at the
canonical plan checkpoint.

## Handoff Decision

`gsd-ingest-docs` and `gsd-plan-phase` are not interchangeable.

- Use `gsd-ingest-docs` for project setup, roadmap changes, requirement merges,
  or conflict detection across multiple ADR/PRD/SPEC/DOC sources.
- Use a manifest when ingesting a selected `docs/plans/<slug>.md`; do not pass
  one markdown file as the ingest scan path.
- Use `gsd-plan-phase` when a GSD roadmap phase already exists and needs an
  executable `PLAN.md`.
- Use `gsd-plan-phase <phase> --prd docs/plans/<slug>.md` when an approved plan
  is the acceptance-criteria source for an existing phase.

Preferred routing:

| Current state | Handoff |
| --- | --- |
| No `.planning/` exists | create manifest -> `gsd-ingest-docs --manifest <manifest> --mode new` -> inspect created phase -> `gsd-plan-phase <created-phase> --prd docs/plans/<slug>.md` |
| `.planning/` exists and accepted plan adds roadmap scope | create manifest -> `gsd-ingest-docs --manifest <manifest> --mode merge` -> inspect created/changed phase -> `gsd-plan-phase <phase> --prd docs/plans/<slug>.md` |
| `.planning/` exists and exactly one phase matches | `gsd-plan-phase <phase> --prd docs/plans/<slug>.md` |
| Many source docs or possible locked-doc conflicts | create manifest including all relevant ADRs/specs/RFCs -> `gsd-ingest-docs --manifest <manifest>` |

Minimal manifest:

```yaml
docs:
  - path: docs/plans/<slug>.md
    type: PRD
```

Add ADRs, specs, or RFCs to the same manifest when they contain locked
decisions the roadmap merge must respect.

If exactly one route matches repo evidence, auto-select it and log the
rationale during a confirmed durable run. Stop only for competing phase matches,
more than one new phase, conflicting locked docs, or a local-dev/destructive
gate.

Use main-session read-only probes to find the route. Follow the
[shared delegation policy](../../_shared/references/delegation.md) for any
worker handoff, including GSD ingest and plan generation. Run sequential work directly; use
a host-approved worker when recovery or context isolation adds value. The main
session inspects created or updated `.planning/`
artifacts before continuing.

This is a real handoff only if the named GSD skill is invoked and its workflow
is followed. If you only recommend the step, say no GSD artifact was generated.

`gsd-plan-phase --prd` generates phase `CONTEXT.md` from the approved plan.
`.planning/` files (`HANDOFF.json`, `STATE.md`, phase files) change only through
GSD tools, because hand edits desynchronize GSD's own state.

## Optional Issues

Use:

```text
to-issues docs/plans/<slug>.md
```

only when work should be split across multiple agents, tracked in GitHub
Issues, or made independently grabbable. Skip it when one GSD phase can hold
the work cleanly. Once GSD execution has started, add issues only if the user
asks for GitHub tracking midstream.

## Committed GSD Phase

Use when `.planning/phases/<phase>/` exists and the user wants implementation.

Default path:

```text
gsd-execute-phase <phase>
$intuitive-refactor changed-code review <changed-scope>
gsd-verify-work <phase>
```

For committed phase execution, choose direct or worker execution using the
shared delegation policy; a stateful phase does not by itself require a
separate worker. The main session owns integration
and must verify any worker output before continuing.

For phase execution that changes local code, carry the commit rhythm into the
runner/worker instructions: after each coherent implementation slice and
focused proof, inspect the diff, stage only owned files, and create a semantic
commit before starting the next slice. If the worker uses a host-local `/goal`,
clear that worker-local goal and exit or stop after writing the handoff. Report
commit ids back to the main session.

When implementation hits a blocker, stay inside the current phase by default.
Record the blocker and either fix it, narrow the phase, or mark the phase
blocked. Create a follow-up phase only when the blocker is a separate coherent
delivery unit with its own acceptance evidence.

Use `tdd` inside individual risky slices:

- new public interfaces
- MCP tools
- parsers and manifests
- scenario scoring
- artifact schemas
- regressions

`tdd` is not a phase planner.

## Changed-Code Cleanup Scope

Run `$intuitive-refactor` in changed-code review mode after implementation
produces code changes and before final verification or final commit.

Pick scope from the actual diff:

- uncommitted changes -> changed-code review with no argument;
- committed slice -> changed-code review against `<base-ref>`;
- focused package/module -> changed-code review on `<path>`;
- docs/plans-only change -> skip unless the user explicitly asks

Changed-code review checks reuse, quality, and efficiency. It is not a broad
architecture discovery tool and does not replace `gsd-verify-work`.

After changed-code cleanup changes code, rerun the relevant tests or
verification gates before declaring work done.
