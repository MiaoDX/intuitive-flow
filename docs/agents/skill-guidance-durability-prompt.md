# Skill Guidance Durability Refactor Prompt

Use this prompt to audit and refactor repo-owned skills so they stay useful as
coding agents become more capable. The goal is not to add more rules. The goal
is to keep each skill small, durable, and clear about why it exists, what
evidence matters, and where the agent may choose a better tactic.

## Prompt

```text
Run a bounded skill guidance durability refactor.

Read first, if present:
- BELIEFS.md
- README.md
- ARCHITECTURE.md
- STATUS.md
- the active `docs/plans/*skill*.md` or `docs/plans/*refactor*.md` gate that
  already covers the target seam

Target:
- One named skill, skill family, or prompt/doc seam. If no bounded target is
  named, stop after a report-only scope gate.
- Repo-owned skill sources and repo-owned skill guidance prompts only.
- For this repo, edit repo-owned skills directly under skills/.
- Edit non-generated repo-owned skills directly.
- Treat third-party, vendored, installed, or system skills as external surfaces
  unless the task is explicitly upstream maintenance.

Source-of-truth boundaries:
- Human docs define current project truth.
- A relevant docs/plans/ refactor gate is the durable stop condition for cleanup
  work. Chat history, generated logs, and temporary artifacts are evidence, not
  the gate.
- Repo-owned skills under skills/ are canonical source and install surface.
- Installed local skills are deployment targets. Sync them only when
  intentionally refreshing user-level tooling.

Core belief:
Models will become more capable. A good skill should explain why the workflow
exists, what source of truth and evidence matter, and which tactics are decent
defaults. It should not trap future agents in a brittle script when a stronger
agent can make a better local choice.

Scope gate:
Before implementation, create or update one persistent refactor gate when the
cleanup is more than advice. The gate should name the target slice, accepted
severities, accepted checklist, parked ideas, evidence ladder, and stop
condition. Execute only the target-local checklist. Record cross-seam ideas
instead of letting the cleanup drift.

Start/stop pressure:
- Start a skill refactor from pressure, not possibility. Valid pressure
  includes a real task failure, repeated friction across runs, active task
  blockage, source-of-truth drift, false-green verification, public-contract
  drift, or a user-named bounded cleanup target.
- On a repeated run, read the existing gate first. If it is `DONE` and evidence
  remains green, stop instead of re-scanning.
- Reopen a `DONE` gate only for a P0/P1 regression, explicit user scope
  expansion, or concrete repeated failure from real usage.
- Park P2-only wording, taste, or "could be cleaner" findings after `DONE`
  unless the user explicitly names that slice for cleanup.

Audit for:
- meta-maintainer notes that do not help the runtime agent perform the skill
- current-tool adapter mechanics embedded in the skill body
- rigid "always invoke X" or "do not edit Y" rules where the durable point is
  provenance, ownership, evidence, or stop condition
- duplicated process that should be a shared fragment, script, or shorter rule
- one-off lessons from a single task encoded as universal guidance
- long lists of mechanics where a principle plus examples would be clearer
- references to chat history, generated logs, or temporary artifacts as if they
  were durable source of truth

Keep or strengthen:
- source-of-truth boundaries
- provenance honesty: say whether an artifact came from this skill, another
  workflow, or inline reasoning
- destructive-action and local-environment gates
- user-owned product, scope, security, privacy, cost, and public-contract stops
- verification expectations and concrete stop conditions
- examples that teach the intended shape without forcing one implementation

Refactor toward:
- "why this matters" before "how to execute"
- suggested paths instead of mandatory mechanics when equivalent evidence is
  acceptable
- small, composable instructions
- scripts for deterministic mechanics
- durable boundaries rather than current-tool caveats
- wording that a different coding agent can follow without knowing this chat

Do not:
- start a refactor from "this could be cleaner" without a bounded target and
  pressure signal
- reopen a green `DONE` gate for P2-only polish unless the user explicitly
  scopes that cleanup
- broaden the product scope of a skill during the cleanup
- remove safety, provenance, or verification rules merely because they are
  written as "do not" rules
- patch external/upstream skills to encode local policy
- create many new docs; prefer one persistent gate or execution note if needed
- leave skill references, manifest entries, or frontmatter stale after editing
  skills

Suggested execution:
1. Create or update one persistent refactor gate under docs/plans/ when needed.
2. If the gate is already `DONE`, stop unless the request has an explicit
   reopen trigger.
3. Search repo-owned skills for brittle/meta phrasing.
4. Read surrounding context before editing; do not do blind keyword deletion.
5. Apply one coherent cleanup slice.
6. Run the repo's verification command.
7. Sync installed local skills only when deliberately refreshing installed
   surfaces.
8. If committing, keep the skill-only cleanup separate from product work.

Evidence to report:
- files changed
- phrases/classes of guidance removed or reframed
- skill validation command
- verification command and result
- remaining parked cleanup ideas
- whether installed skills were synced
```

## Local Commands

For this repo, the usual commands are:

```bash
bun run check:skills
bun run verify
scripts/tasks/sync-local-commands-skills.sh
```

- `bun run check:skills` validates repo-owned skills and default allowlist coverage.
- `bun run verify` is the normal local proof.
- `scripts/tasks/sync-local-commands-skills.sh` refreshes installed local agent
  surfaces; run it only when that side effect is intended.

When committing, keep skill-only cleanup separate from product work and include
the usual AI co-author trailer if an AI agent creates the commit.
