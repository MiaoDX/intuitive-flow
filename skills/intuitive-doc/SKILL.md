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

Audit mode:

- inspect the human surface and named current source-of-truth files;
- report stale, missing, duplicated, or over-detailed documentation;
- do not edit unless asked.

Update mode:

- update only the docs needed to reflect current truth;
- keep root docs thin and route detail to `docs/human/**`;
- preserve useful existing structure and links.

Cleanup mode:

- move, archive, or remove stale human-facing docs only when current truth has a
  better home;
- do not delete planning or evidence just because it is old;
- prefer reversible moves and clear indexes for historical material.

Guard mode:

- check whether a proposed doc change belongs in human docs, agent docs,
  planning/evidence, ADRs, or code comments.

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
