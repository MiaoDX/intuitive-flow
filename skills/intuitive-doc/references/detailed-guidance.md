# Intuitive Doc: Detailed Guidance

Maintain a small human-facing documentation surface and keep it aligned with
code. For plan paths, follow [plan selection](../../_shared/references/plan-paths.md);
paths below are defaults and existing repo conventions win.

## Surfaces

Human-authoritative truth is `README.md`, `ARCHITECTURE.md`, `STATUS.md`, and
`docs/human/**`. `AGENTS.md` and `CLAUDE.md` are agent-operational and are
owned by `$intuitive-init`. Agent runbooks, tool quirks, and long harness notes
go in `docs/agents/**`. Plans (`docs/plans/<slug>.md`), task state
(`docs/status/active/**`), retrospectives, GSD `.planning/**`, generated
reports, and `output/**` are stage state or evidence unless a human doc
promotes a specific artifact.

When a default human surface is missing, audit and guard output name it with
the smallest command that restores it (for example
`/intuitive-doc update STATUS.md` or `/intuitive-doc update docs/human/README.md`).
Audit never creates files; `update <path>` creates a missing default doc. A
missing `STATUS.md` whose content is clearly covered elsewhere is reported as
"missing but covered."

## Perspective Levels

- **L0 Orientation** (`README.md`, `STATUS.md`, indexes): what the repo does
  now, what can be run, where truth lives.
- **L1 Architecture/domain** (`ARCHITECTURE.md`, design docs, vocabulary):
  subsystems, contracts, data flows, extension points, proof boundaries.
- **L2 Runbooks**: real commands, env vars, artifacts, ports, supported
  combinations.
- **L3 Evidence**: plans, retrospectives, reports, fixtures, logs.

For L0/L1, zoom out before checking claims: map top-level packages, examples,
scripts, and recipes into the project's language, because the most common drift
is omission (a new subsystem, runnable mode, or contract the docs never
mention), not a false sentence.

## Audit

1. Find the orientation surface from explicit pointers (root docs,
   `docs/README.md`); agent files are pointer sources only.
2. Classify docs as human-authoritative, stage-authoritative, evidence/history,
   implementation detail, or agent-operational, and select a small audit set:
   root docs and `docs/human/**`, plus anything they link as current truth.
   Planning, status, retrospective, output, and generated trees are evidence
   unless targeted.
3. Report missing default surfaces with restore hints.
4. Build a freshness map: top-level packages and roles, entrypoints, scripts
   and recipes, public contracts and artifacts, current focus.
5. For each human-authoritative doc, extract testable claims (interfaces,
   responsibilities, data flow, extension points, valid/invalid combinations,
   "what you can run") and coverage-by-omission claims, check them against
   code and the freshness map, and mark each verified, drifted, or
   unverifiable. Rationale, future plans, and diagrams are not testable claims.
6. Check agent files only for boundary drift (stale pointers, copied milestone
   or taxonomy content, conflicts) and route fixes to `$intuitive-init refresh`.
7. For each stale or misplaced doc, recommend: rewrite in place, move to
   `docs/agents/**`, move to process/history, or remove.

## Update (`/intuitive-doc update <file>`)

Read the target, confirm its tier, and mini-audit it. L0/L1 targets need the
zoom-out check; L2 targets need command, env, and artifact validation; L3
targets change only when explicitly requested. Rewrite drifted sections from
current code while preserving the doc's tier: design docs describe contracts
and extension points, not function names or line numbers, and present current
implementations as instances rather than absolutes. Add new subsystems,
contracts, modes, or extension points when the code gained them, even if the
old wording is not strictly false. Update diagrams when structure changed.

When moving or splitting docs, update every path consumer (links, indexes,
agent pointers, scripts, CI, prompts). Finish with the cleanup check on nearby
docs. Show the diff first unless the user already asked for the change.

## Cleanup (`/intuitive-doc cleanup [scope]`)

Run the audit selection and freshness map for the scope (default: the human
surface and what it links as current). Classify each human doc as keep and
rewrite, move to agent docs, move to process/history, or remove. Rewrite kept
docs from live behavior; replace a wholly stale default doc with the smallest
current version rather than leaving the surface missing.

Remove a doc only after current truth lives elsewhere (or the content is
intentionally obsolete) and `rg` shows no remaining consumers. Prefer `git mv`
for moves, and regenerate or delete generated docs rather than hand-editing
them. Labeling stale prose "historical" does not keep it on the human surface;
move it or delete it. Verify with `rg` for old paths and claims, any doc build,
and targeted checks for changed runbook commands. Report
`| Doc | Action | Destination | Reason | Verification |`.

A cleanup request approves scoped rewrites, moves, and removals after consumers
are checked. Ask first for public docs with unclear external consumers,
legal/compliance docs, canonical release notes, or trees outside the scope.

## Guard (`/intuitive-doc guard`)

Take the changed files (`git diff --name-only HEAD~1` or a given range), map
them to the documented subsystems in the curated set, and run a focused audit
on the affected sections. For L0/L1 docs, check whether the diff adds or
removes a subsystem, command surface, public contract, or artifact that changes
the repo map. Report affected docs and sections with severity, plus cleanup
recommendations and skipped generated or detail docs.

## Standards

Follow the repo's documentation standards when present (curated set, design
versus implementation tiers, diagram conventions). Otherwise: design docs stay
free of function names, line numbers, and config values; current
implementations are framed as swappable; extension points get "Adding a New X"
sections; generated planning, reports, and archives are evidence unless an
index promotes them.

## Output

End audit and guard runs with the audited set, missing surfaces and restore
hints, skipped buckets, cleanup recommendations, drift counts split into
critical (broken interface claims) and minor, and the single most useful next
command.

This skill reads code but writes only docs, does not sweep every markdown file,
and does not own `AGENTS.md` or `CLAUDE.md`.
