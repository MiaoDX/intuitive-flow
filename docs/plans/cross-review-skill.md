# Cross Review Skill

## Plan Ledger

- Plan status: DONE
- Session scope: cross-review-skill
- Parent plan: none
- Child plans: none
- Last updated: 2026-08-17
- Current slice: Shipped and verified.
- Next action: none
- Blocked on: none
- Do not touch from this session: unrelated skills, vendor sources, and global installs

## Goal

Create a lightweight post-proposal review skill that challenges an existing
agent proposal through independent perspectives and returns one simpler or more
defensible recommendation.

## Scope

- Add `skills/cross-review/SKILL.md` and `agents/openai.yaml`.
- Default to `ponytail-review` and `intuitive-reduce-entropy` plan mode.
- Honor two to four reviewer skills explicitly named by the user.
- Give every reviewer the same frozen proposal and keep the main session as the
  only judge.
- Run one round by default and at most two rounds when material conflict remains.
- Register the skill as routed and document its public route.
- Forward-test an over-designed proposal, an already-simple proposal, and a
  material reviewer disagreement.

## Non-Goals

- Planning from scratch, implementation, PR or code review, user grilling,
  persistent run state, reviewer registries, or unbounded iteration.
- Changing `agent-planning-loop` or reviewer skill semantics.
- Synchronizing user-level skill installs.

## Acceptance

- A request for a simpler or different view of an existing proposal triggers
  `cross-review` without escalating into a full planning loop.
- Independent reviewer findings are deduplicated and judged into one of
  `keep`, `simplify`, `replace`, or `needs-decision`.
- The output includes the revised proposal, rejected complexity, material
  disagreements, and a stop or routing decision.
- Existing skill routes and the full repository verification gate still pass.

## Verification

```bash
uv run --with pyyaml python \
  "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" \
  skills/cross-review
bun run check:skills
bun run verify
```

Run isolated forward tests from raw proposals without providing expected
verdicts. Do not run `scripts/update.sh`; it mutates installed user tooling.

## Shipped Evidence

- `skills/cross-review/SKILL.md` and `agents/openai.yaml` define the routed
  post-proposal review surface.
- Explicit isolated runs returned `replace`, `keep`, and `needs-decision`
  without editing product or skill files.
- A fresh temporary Codex home triggered `cross-review` from the natural
  language request "is there a simpler approach?" with no explicit skill name.
- The follow-up trigger run reported `Independence: limited inline` after its
  independent-worker probe was unavailable, preserving evidence honesty.
- Skill quick validation, `bun run check:skills`, and two full `bun run verify`
  gates passed; the final suite reported 214 tests passed and zero failed.

## Remaining Work

None. User-level skill synchronization remains outside this plan and will occur
through the repository's normal explicit update workflow.
