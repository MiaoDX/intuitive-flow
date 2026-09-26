Always include these four sections (write `none` when empty):

What changed:
- <change>

Proof:
- Claim level: <complete | partial | blocked | not-run>
- Gates run: <commands/checks and pass/fail summary>
- Gates skipped/blocked: <gate - reason - impact on the completion claim>
- Evidence: <paths/URLs/log summaries, when useful>

Scope changes:
- <accepted changes from review, reconciliation, handoff, or execution discoveries>

Parked todos:
- <item> - parked because <reason>; unpark when <trigger>

Include the following only when they carry information for this run:

Commits:
- <commit id(s) | blocker with the exact instruction/policy/overlap>

Docs:
- <human docs updated, or checked and intentionally left unchanged>

Source plan:
- <canonical plan/issue/gate status after this run, with remaining gates>

Task state:
- <capsule path and ACTIVE/PARKED/BLOCKED | terminal state reconciled then removed | host/session persistence with reduced durability>

Project status:
- Role: <project integrator | task control plane only>
- Delta: <none | material: concise project-level change>
- Integration: <updated existing path | handed off to project integrator | not present/not adopted | blocked by ambiguous ownership>
