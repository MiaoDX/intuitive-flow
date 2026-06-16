# Handoff And Reporting

## Default Route

Use this route unless the user already names a specific entropy source.

1. **Orient**: launch parallel bounded probes for root guidance, human docs,
   package/test config, automation, top-level layout, and the current
   verification command when two or more surfaces need inspection. Use the
   current host's approved delegation policy for those probes; do not imply
   Codex native subagents are the default. For tiny repos or precise prompts,
   inspect the relevant surface directly. For broad prompts, run the high-noise
   summary preflight before searching `.planning`, `docs/plans`, `.scratch`,
   generated/log/tmp surfaces, large tests, or profile registries. For
   high-noise surfaces, orient with indexes and references rather than
   full-body reads.
2. **Classify**: map observed friction to the entropy sources above.
3. **Choose discovery intensity**: classify the pass as `quick scan`,
   `selection scan`, or `saturation scan`. For repo-wide, unknown-unknown, or
   saturation language, run discovery-loop mode and record the rounds in one
   artifact when the repo convention allows it. Each round should name the
   surface, bounded probes used, candidate-level evidence found, parked
   observations, and why deeper reading did or did not continue.
4. **Recommend packet**: present the complete ranked candidate packet. Include a
   suggested review order and attach `Demand gate:`, `Zen hint:`, `Pattern hint:`,
   affected paths, owner skill, proof commands, and execution risk to each
   candidate. If only one candidate passes the No-Change Outcome Rule, present a
   packet of one and briefly say why other observations were parked. If no
   candidate passes, report `Selected candidates: none` and stop.
5. **Architecture sequence**: when any candidate direction is
   architecture/deepening,
   public-contract cleanup, MCP/tool boundary cleanup, lifecycle gates, or an
   unclear target seam, run `$zoom-out` and `$plan-eng-review` before
   presenting it as decision-ready.
   If no target seam has been accepted after that, optionally route to
   `$improve-codebase-architecture` in report-only mode. Treat all discovery
   output as candidate evidence, not execution approval, and keep it in the
   ranked packet unless the user already selected the architecture candidate.
6. **Selection packet**: when the user selects all or part of the packet,
   preserve the selected candidates, suggested review order, likely specialist owners,
   proof commands, execution risks, parked items, and stop condition. Do not
   silently narrow the selected set to one small slice.
7. **Handoff**: end with `Recommended next action:` and `Shortcut:`. If a plan
   document exists, state whether it was updated or should be updated by the
   next action. Do not list many equally weighted next options unless the user
   explicitly asked to compare routes.

When the user asks for a compact selected-candidates packet, use this shape so
the next stage does not repeat the whole audit:

```text
Selected candidates:
Entropy source:
Demand gate:
Zen hint:
Pattern hint:
Zoom-out map (architecture-shaped slices only):
Eng-review recommendation (architecture-shaped slices only):
Evidence:
Affected paths:
Discovery skill:
Architecture packet (architecture-shaped slices only):
Owner skills:
Proof commands:
Parked items:
Stop condition:
```

The user may route the selected packet to implementation, `$grill-with-docs-batch`,
`$intuitive-preflight`, another planning loop, or simply keep it as a backlog.
Do not assume which route they will choose.

## User Input Routing

If the user names a likely area, route directly:

- "docs", "README", "ARCHITECTURE.md", "architecture docs", "status",
  "human docs" ->
  `$intuitive-doc`.
- "AGENTS", "CLAUDE", "harness", "init", "MCP", "hooks", "skills setup" ->
  `$intuitive-init`.
- "tests", "pytest", "coverage", "fixtures", "flaky", "markers" ->
  `$intuitive-tests`.
- "improve architecture", "architecture cleanup", "deepening", "shallow
  module", "hard to test", "hard to navigate", "find refactoring
  opportunities", "public contract", "MCP", "tool surface", "lifecycle gate" ->
  run the Architecture Review Sequence first. Use
  `$improve-codebase-architecture` only when extra report-only candidate
  discovery is still needed after `$zoom-out` and `$plan-eng-review`.
- "module", "API", "compatibility", "seam", "stale wrapper", "known
  architecture target" ->
  `$intuitive-refactor`.
- "layout", "folders", "scripts", "examples", "repo structure" -> inspect the
  object first, then route through Layout Routing.

If the user gives no area, do not guess silently. Return a ranked packet:

```text
Recommended packet:
1. <candidate> — <severity>, <owner>, <why now>
2. <candidate> — <severity>, <owner>, <why now>
3. <candidate> — <severity>, <owner>, <why now>

Suggested review order:
- <candidate ids, with reason>

Parked items:
- <speculative or lower-value observations>

Suggested proof:
- <commands/searches>

Select all, select specific candidate ids, discuss selected candidates further,
or park the packet.
```

## Decision Policy

Suggest a review order only when repo evidence makes the ordering clear. Do not
auto-select the subset to implement. Pause for the user when a
decision would materially change:

- runtime behavior or public APIs
- externally documented command/import paths
- broad file moves, deletes, or test pruning
- user-requested temporary compatibility bridges or broad migration removals
- paid, slow, Docker, hardware, simulator, or local-provider verification gates
- product intent, audience, or scope

If the user asks for "choose defaults," interpret that as permission to choose
mechanical defaults, not permission to cross these pause points silently.

## Stop Condition

Stop when all of these are true:

- either a ranked candidate packet was delivered for selection, or a discovery
  loop saturated with `Selected candidates: none`
- specialist skills were used for their owned surfaces instead of duplicating
  their full procedures here
- verification commands pass, or skipped gates are documented with a concrete
  reason when verification was part of the discovery task
- the agent can state the next safe task without starting another broad cleanup
  sweep
- no-change runs explicitly say `Selected candidates: none` and do not create a
  gate, commit, or follow-up refactor proposal

## Report Format

End with:

```text
Entropy source:
Recommended packet:
Selected candidates:
Specialist owners:
Discovery artifact:
Demand gate:
Zen hint:
Pattern hint:
Architecture packet (architecture-shaped slices only):
Changes:
Verification:
Parked items:
Next options:
```

For no-change runs, use:

```text
Entropy source:
Selected candidates: none
Why no change:
Verification:
Parked items:
Next safe task:
```
