---
name: intuitive-doc
description: Create and maintain an intuitive human documentation surface for AI-agent-developed repos. Use when humans should only need README.md, ARCHITECTURE.md, STATUS.md, and docs/human/** while planning logs, generated docs, retrospectives, ADR detail, and implementation evidence stay in AI-agent-only folders.
---

# Intuitive Doc

Maintain a small human-facing documentation surface and keep it aligned with code.

## Human/Agent Surface Rule

The default human-facing source of truth is intentionally small:

- `README.md`
- `ARCHITECTURE.md`
- `STATUS.md`
- `docs/human/**`

`AGENTS.md` and `CLAUDE.md` are agent-operational docs. Use them for startup
rules, local hazards, command pointers, and skill routing, but do not treat them
as human-authoritative project truth by default.

Agent planning, generated evidence, history, and working notes belong in
explicit agent/process surfaces such as `.planning/**`, `docs/plans/**`,
`docs/retrospectives/**`, `docs/status/active/**`, and `output/**` unless a
human doc intentionally promotes a specific artifact into current truth.

AI coding docs are agent/process-facing docs that help future coding agents but
do not need to be human project truth. Prefer `docs/agents/**` for durable
agent runbooks, repo-specific coding procedures, tool quirks, and long harness
notes. Prefer `.planning/**`, `docs/plans/**`, `docs/retrospectives/**`,
`docs/status/active/**`, and `output/**` for execution state, plans,
retrospectives, generated evidence, and proof artifacts.

When any default human surface is missing, `$intuitive-doc` should make the
next action obvious. In audit/guard output, report the missing file or folder
and give the smallest generation hint that would restore the default surface.
Do not silently create files in audit mode.

Default generation hints:
- Missing `README.md` -> suggest `/intuitive-doc update README.md`
- Missing `ARCHITECTURE.md` -> suggest `/intuitive-doc update ARCHITECTURE.md`
- Missing `STATUS.md` -> suggest `/intuitive-doc update STATUS.md`
- Missing `docs/human/` -> suggest `/intuitive-doc update docs/human/README.md`
- Missing `docs/human/README.md` while `docs/human/` exists -> suggest
  `/intuitive-doc update docs/human/README.md`

## Perspective Levels

Use the right level of abstraction before checking details:

- **L0 Orientation**: `README.md`, `STATUS.md`, and doc indexes. These must tell
  a human what the repo does now, what can be run now, and where the current
  source of truth lives.
- **L1 Architecture / domain map**: `ARCHITECTURE.md`, technical design docs,
  and domain vocabulary. These must name the major subsystems, contracts,
  data flows, extension points, and proof boundaries that exist in the current
  codebase.
- **L2 Runbooks / operator docs**: setup, local development, deployment, model
  matrices, and command guides. These must match real commands, env vars,
  artifacts, ports, and supported combinations.
- **L3 Evidence / implementation detail**: plans, retrospectives, generated
  reports, fixtures, and logs. These are evidence unless explicitly promoted
  into the human surface.

For L0/L1 docs, do a zoom-out pass before claim-by-claim checking: map the
top-level packages, examples, scripts, just recipes, and active status into the
project's domain language. Use any available zoom-out workflow when it improves
the project map, but the durable requirement is perspective: the doc should
explain why the current implementation is shaped this way and where it can
change.

## When to Activate

Use this skill when:
- User invokes `intuitive-doc`, `/intuitive-doc`, or `$intuitive-doc` explicitly
- The repo's human doc surface needs to be created, simplified, or reorganized
- After completing a significant code change (new subsystem, changed interface, new planning mode, etc.)
- When the user asks about documentation freshness or staleness
- When the user asks to clean up, refactor, remove, or move stale docs
- When a phase/milestone completes that may have changed documented behavior

## Modes

### 1. AUDIT mode (default when no args)

Identify the human-facing doc surface, then verify its testable claims against the codebase.

**Steps:**
1. Find the doc orientation surface:
   - Prefer explicit pointers in root `README.md`, `STATUS.md`, `AGENTS.md`, `CLAUDE.md`, or `docs/README.md`
   - Treat `AGENTS.md` and `CLAUDE.md` as pointer sources only unless the user
     explicitly asks to audit agent guidance
   - Then look for architecture indexes such as `ARCHITECTURE.md`, `docs/architecture/README.md`, or similar
2. Classify docs into:
   - **Human-authoritative**: root `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and docs under `docs/human/**`
   - **Stage-authoritative**: docs authoritative only for a workflow stage (`docs/plans/`, `.planning/STATE.md`, ADRs, active status notes)
   - **Evidence/history**: retrospectives, generated reports, proof bundles, logs, screenshots, benchmark output
   - **Implementation detail**: low-level internals, generated API notes, detailed phase implementation references
   - **Agent-operational**: `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.codex/**`, and similar agent runtime guidance
3. Select a small audit set:
   - Include files explicitly named as current human-facing sources
   - Include root `README.md`, `ARCHITECTURE.md`, and `STATUS.md` when present, even if not cross-linked
   - Include `docs/human/**` when present
   - Use ADR indexes, `.planning/**`, and `docs/plans/**` as evidence only unless the user explicitly targets them
   - Exclude `.planning/**`, `docs/plans/**`, `docs/status/active/**`, `docs/retrospectives/**`, `output/**`, generated reports, and archives unless the user targets them or an authoritative doc links one as current truth
4. Detect missing default human surface:
   - Check for `README.md`, `ARCHITECTURE.md`, `STATUS.md`, `docs/human/`, and
     `docs/human/README.md`
   - If `STATUS.md` is missing but `README.md` or `docs/human/README.md`
     clearly covers current focus, next action, and blockers, report
     `STATUS.md` as "missing but covered"; otherwise report missing L0 current
     state
   - If `docs/human/` is missing, report that the repo lacks the default
     human-doc extension folder
   - For each missing piece, include the matching generation hint from
     "Default generation hints"
   - Do not create missing files during AUDIT mode unless the user explicitly
     asked for an update/create action
5. Build a codebase freshness map before detailed claims:
   - Top-level packages and their roles
   - Example/demo entrypoints
   - Script and `just` recipe surfaces
   - Public protocols/contracts, schemas, reports, and artifact outputs
   - Active focus from `STATUS.md` and, as evidence only, `.planning/STATE.md`
   - Any major subsystem present in code but missing or underweighted in L0/L1 docs
6. Report the selected doc set, skipped buckets, and missing-surface hints before
   claim results,
   including agent-operational files skipped as human docs
7. For each **human-authoritative design or runbook doc**:
   a. Read the doc
   b. Extract **testable claims** — statements about interfaces, responsibilities, data flow, extension points, valid/invalid combinations
   c. For L0/L1 docs, also extract **coverage claims by omission**: what major subsystems or run modes the doc implies are the whole project
   d. For each claim, search the codebase to verify it still holds
   e. For each coverage-by-omission claim, check whether the freshness map shows a missing major subsystem, public contract, or runnable mode
   f. Classify each claim as: ✅ VERIFIED, ⚠️ DRIFTED, ❓ UNVERIFIABLE
8. Check agent-operational files only for boundary drift:
   - agent files point to stale or missing human docs
   - agent files duplicate milestone goals, non-goals, review gates, or doc-tier taxonomy that belongs in human docs
   - agent files conflict with the human-authoritative surface
   Report these as agent-guidance drift and prefer `$intuitive-init refresh`.
   Edit agent files here only when the user targeted them or the doc update
   would otherwise leave stale pointers.
9. Report findings as a table:
   ```
   | Doc | Claims | Verified | Drifted | Unverifiable |
   ```
10. For each DRIFTED claim, show: what the doc says or omits vs what the code shows
11. For stale or misplaced docs, show a cleanup recommendation:
   - **Rewrite in place** when the doc is still part of the human truth but its
     claims no longer match the implementation
   - **Move to AI coding docs** when the material is useful mainly to coding
     agents, such as long procedures, tool quirks, migration notes, or harness
     operating detail
   - **Move to planning/history/evidence** when the material is stage state,
     retrospective analysis, old proof output, or generated reports
   - **Remove** when it is obsolete, duplicated elsewhere, and has no unique
     current value after links and consumers are updated

**What counts as a testable claim:**
- "The solver returns a GraspPlan" → grep for the return type
- "WBC runs at 50Hz" → check the frequency constant
- "Three DOF layers" → verify the reduction chain exists
- "Invalid: MotionGen + WBC OFF" → check if guard/warning exists
- Extension point lists → verify the interfaces still match
- "README lists what you can run" → verify examples, scripts, and `just` recipes exist
- "ARCHITECTURE describes the operating modes" → verify top-level modules and current entrypoints are represented, including newer major subsystems
- "Design doc names the platform strategy" → verify the current codebase has not added another platform, contract, or proof path that changes the project map

**What is NOT a testable claim:**
- Design rationale ("we chose X because Y")
- Future plans ("this could be extended to...")
- Diagrams (verify manually)

### 2. UPDATE mode (`/intuitive-doc update <file>`)

Update a specific doc that has drifted.

**Steps:**
1. Read the target doc. If the target is a missing default human-facing doc
   (`README.md`, `ARCHITECTURE.md`, `STATUS.md`, or `docs/human/README.md`),
   create the parent directory as needed and draft the smallest useful doc at
   the correct perspective level.
2. Determine whether it is human-authoritative, stage-authoritative, evidence/history, or implementation detail
3. If the target is generated planning/history/evidence, update it only when the user explicitly requested that file; otherwise update the human-facing doc that points to it
4. Read the README.md documentation standards (if present)
5. Identify which sections have drifted (run mini-audit on this doc)
6. Select the perspective level for the target:
   - L0/L1 docs require a zoom-out freshness check against top-level code, examples, scripts, recipes, and active status before rewriting.
   - L2 docs require concrete command/env/artifact validation.
   - L3 docs should usually remain evidence/history unless explicitly targeted.
7. For each drifted section:
   a. Read the relevant code to understand the current state
   b. Rewrite the section to match reality
   c. **Preserve the doc tier** — if it's a design doc, keep it design-level (contracts, not code). If it's an implementation reference, include specifics.
   d. **Preserve extension framing** — current implementations are instances, not absolutes
   e. **Update diagrams** if the data flow or structure changed
8. When moving or splitting docs, update known path consumers: README links,
   doc indexes, agent guidance pointers, scripts, CI references, and copied
   prompts. Do not leave old doc paths documented unless the user explicitly
   protects them.
9. Before closeout, run the cleanup check from CLEANUP mode on the target doc and
   nearby human surface. If sibling docs now duplicate stale content, point to
   the updated source of truth or move/remove the stale sibling when it is inside
   the requested scope.
10. If the user has not already asked you to implement the update, show the diff before applying. If they explicitly approved the cleanup, apply the scoped doc changes and summarize the diff afterward.

**Rules for updates:**
- Do NOT downgrade a design doc to implementation detail
- Do NOT remove extension points or "future" slots
- Do NOT add function names or line numbers to design docs
- DO create a missing default human-facing target when the user runs
  `/intuitive-doc update <target>` for that path
- DO update interface contracts if they changed
- DO update valid/invalid combination rules if new modes were added
- DO add new extension points if new swappable components emerged
- DO update README, architecture, and technical design when the codebase gains a major subsystem, public contract, runnable mode, or proof boundary, even if the old wording is not strictly false
- DO keep high-level docs human-oriented: name subsystems and contracts, not every helper function
- DO remove or relocate stale human-surface docs when they are no longer current
  human truth and the requested scope includes cleanup

### 3. CLEANUP mode (`/intuitive-doc cleanup [scope]`)

Refactor the documentation surface so current human docs match the current
implementation, and stale docs leave the human surface.

Use this mode when the user asks to clean up docs, align docs to implementation,
remove outdated docs, move docs to AI coding folders, or run documentation
cleanup after a code refactor.

**Steps:**
1. Run the AUDIT selection and freshness-map steps for the requested scope. If
   no scope is provided, use the default human surface plus docs it links as
   current truth.
2. For every human-authoritative doc in scope, classify its current role:
   - **Keep and rewrite**: still belongs in `README.md`, `ARCHITECTURE.md`,
     `STATUS.md`, or `docs/human/**`, but must be rewritten to match the
     current implementation
   - **Move to AI coding docs**: useful to coding agents but not human truth;
     move to `docs/agents/**` or route agent-root updates to
     `$intuitive-init refresh`
   - **Move to process/history/evidence**: stage state, old plans,
     retrospectives, generated analysis, reports, proof bundles, or logs; move
     to `.planning/**`, `docs/plans/**`, `docs/retrospectives/**`,
     `docs/status/active/**`, or `output/**` according to the repo convention
   - **Remove**: obsolete, duplicated, or misleading after the current human
     truth has been rewritten and path consumers are updated
3. Rewrite every kept human doc against live implementation facts. Prefer
   current code behavior over backward-compatibility narratives unless the repo
   has a protected external contract.
4. If a default human-surface doc is stale as a whole, replace it with the
   smallest current version before moving or removing old detail. Do not leave
   the default surface missing unless the user explicitly asked to shrink it.
5. Move agent-only material out of `docs/human/**` into `docs/agents/**` when it
   describes coding-agent procedures, prompt routing, hooks, MCP/harness setup,
   local hazards, or long operational recipes.
6. Remove stale human-surface docs only after:
   - current truth exists elsewhere in the human surface or the content is
     intentionally obsolete
   - README/doc indexes/agent pointers/scripts/CI/copied prompts no longer point
     at the old path
   - `rg` finds no remaining current references to removed paths or stale claims
7. For moves, preserve git history by moving the file path when possible, then
   editing content at the destination. For generated docs, prefer regenerating
   or deleting the generated copy instead of hand-editing it.
8. Verify cleanup with the repo's available checks:
   - `rg` for old paths, old command names, and corrected drift claims
   - doc-generation/build checks when the repo has them
   - targeted command/test validation for runbook claims that changed
9. Report the cleanup as a concise table:
   ```
   | Doc | Action | Destination | Reason | Verification |
   ```

**Cleanup safety rules:**
- A user request for doc cleanup/alignment counts as approval for scoped doc
  rewrites, moves, and removals after you inspect consumers.
- Stop and ask before deleting or moving public docs with ambiguous external
  consumers, legal/compliance docs, release notes the repo treats as canonical,
  or broad doc trees outside the requested scope.
- Do not move implementation truth into `AGENTS.md` or `CLAUDE.md`; those files
  may point to the human surface or `docs/agents/**`, but project truth belongs
  in human docs.
- Do not keep outdated human-facing prose merely by labeling it historical. If
  it is history, move it to a history/process surface or delete it.

### 4. GUARD mode (`/intuitive-doc guard`)

Check which human-facing docs a recent code change might affect.

**Steps:**
1. Run `git diff --name-only HEAD~1` (or user-specified range)
2. Identify the curated doc set using AUDIT mode's selection rules
3. Map changed files to documented subsystems:
   - `planner/` changes → check planning_subsystem.md, configuration_space.md
   - `controller.py` changes → check control_and_execution.md
   - `perception/` changes → check perception_pipeline.md
   - `robot_model/` changes → check robot_model_layers.md
   - New config dimensions → check configuration_space.md
   - `*.yml` config changes → check implementation references
4. Prefer human-facing indexes, architecture docs, dashboards, and runbooks over generated phase/planning docs
5. For each potentially affected doc, run a focused audit on the relevant sections
6. For L0/L1 docs, check whether the diff introduces or removes a major subsystem, command surface, public contract, or report artifact that should change the zoomed-out repo map
7. Include cleanup recommendations for docs that should be rewritten, moved to
   AI coding docs, moved to process/history/evidence, or removed
8. Report: which docs need attention, which sections, severity, and which generated/detail docs were intentionally skipped

## Documentation Standards Awareness

When updating docs, respect the project's documentation standards. Look for these in the orientation and architecture surfaces:

- **Curated set**: A small set of docs humans review at HEAD
- **Two-tier system**: Design docs (durable) vs implementation references (may drift)
- **Design doc rules**: Contracts not code, current = instance, extension points explicit
- **Diagram style**: Mermaid conventions, color coding by subsystem

If no documentation standards are found, apply these defaults:
- Keep design-level docs free of function names, line numbers, and config values
- Frame current implementations as swappable choices
- Include "Adding a New X" sections for extension points
- Treat generated planning, status scratchpads, retrospectives, reports, and archives as evidence/history unless explicitly promoted by an index

## Output Format

Always end audit/guard output with an actionable summary:

```
## Summary
- Authoritative set: [list docs audited]
- Missing default surface: [list missing files/folders, or none]
- Generation hints: [commands to create missing human-facing docs/folders]
- Skipped as generated/detail/history: [list buckets]
- Cleanup recommendations: [rewrite/move/remove actions, or none]
- N docs checked, M have drift
- Critical: [list docs with broken interface claims]
- Minor: [list docs with stale details]
- Suggested: /intuitive-doc update <most-critical-doc> or /intuitive-doc cleanup <scope>
```

## What This Skill Does NOT Do

- Does not create broad new doc suites from scratch; it may create the missing
  default human-facing docs (`README.md`, `ARCHITECTURE.md`, `STATUS.md`, or
  `docs/human/README.md`) only when the user explicitly runs update for that
  target
- Does not sweep every markdown file in the repo
- Does not validate generated planning/history/detail docs by default
- Does not treat implementation references as human-review authoritative just because they exist
- Does not auto-apply unbounded documentation sweeps; cleanup mode may apply
  scoped rewrites, moves, and removals when the user asks for cleanup/alignment
- Does not own `AGENTS.md` or `CLAUDE.md`; it may report agent-guidance drift
  and route cleanup to `$intuitive-init refresh`
- Does not touch code — only reads code, writes docs
