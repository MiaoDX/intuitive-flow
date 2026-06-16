---
name: intuitive-doc
description: Create and maintain an intuitive human documentation surface for AI-agent-developed repos. Use when humans should only need README.md, ARCHITECTURE.md, STATUS.md, and docs/human/** while planning logs, generated docs, retrospectives, ADR detail, and implementation evidence stay in AI-agent-only folders.
---

# Intuitive Doc

Use this skill to keep the human-facing documentation surface small, current,
and reviewable. The default human surface is:

- `README.md`;
- `ARCHITECTURE.md`;
- `STATUS.md`;
- `docs/human/**`.

Planning logs, generated evidence, retrospectives, ADR detail, execution
artifacts, scratch notes, and agent-only runbooks should stay outside the human
surface unless a human doc intentionally promotes them.

This compact entrypoint preserves full mode-specific guidance in
`references/detailed-guidance.md`. Read it for detailed audit/update/cleanup
criteria, perspective levels, documentation standards, or full output format.

## When To Activate

Use this skill when:

- root docs drift from current code, commands, or active plans;
- humans need a concise orientation after AI-heavy development;
- implementation changed public behavior, command surfaces, setup, architecture,
  or status;
- generated/planning/agent evidence has leaked into human docs;
- the user asks for documentation cleanup, human docs, README/architecture/status
  updates, or post-implementation doc alignment.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Audit | The user asks whether docs are current, bloated, or misplaced. | Findings, recommended changes, parked items, verification. | The issue is agent guidance, tests, or code layout. |
| Update | Current behavior, commands, architecture, or status changed. | Focused doc edits tied to current source evidence. | The requested change is only planning/evidence archival. |
| Cleanup | Human docs contain stale, duplicated, or over-detailed material. | Moved, archived, shortened, or removed docs with links preserved. | The material belongs in agent guidance or execution plans. |
| Guard | A proposed doc change needs placement review. | Placement decision and reason. | The user already selected the doc target and asks to edit. |

For non-trivial runs, state `Selected mode:`, `Why:`, and `Redirect:` before
auditing or editing. For tiny doc edits, one sentence can carry the same
information. Add a final `Mode note:` only when manual invocation, ambiguity, or
a better owner matters.

## Human Surface Rules

- `README.md` orients and points to the current map; it should not become a
  manual.
- `ARCHITECTURE.md` owns subsystem contracts, data flow, extension points, and
  proof boundaries.
- `STATUS.md` owns current state, supported commands, next maintenance focus,
  and known blockers.
- `docs/human/**` owns human-facing detail that would bloat root docs.
- Agent runbooks belong in `docs/agents/**` or skill references unless humans
  need them as project truth.

## Output

For audit/report-only work, return:

```text
Human docs status:
Findings:
Recommended changes:
Parked items:
Verification:
```

For edits, report changed files, the current-truth source used, verification
run, and any docs intentionally left unchanged.

## Stop Conditions

Stop when the small human surface lets a human answer what the project is, how
to run or verify it, what is current, what changed, and where deeper detail
lives. Do not keep polishing wording once routing, truth, and links are correct.
