---
name: cross-review
description: Give an existing proposal an independent second opinion when requested; return one judged recommendation.
---

# Cross Review

Challenge an existing proposal when the user requests a second opinion. Return
one keep, simplify, replace, or needs-decision verdict; do not edit the proposal,
implement changes, or invent a plan. Use the appropriate code-review skill for PRs.

## Freeze The Input

Identify the exact proposal, the problem it claims to solve, and any explicit
constraints or non-goals. Prefer the latest assistant proposal when the user
says "this" or "that proposal." Ask one concise question only when multiple
candidate proposals make the target materially ambiguous.

Freeze that input for the review round. Do not revise it between reviewers or
show one reviewer's findings to another reviewer in the same round.

Read [reviewers](references/reviewers.md) when choosing and dispatching independent
perspectives. Preserve the scope of each selected skill.

## Judge Findings

The main session classifies each material finding:

- `accept`: changes the recommendation;
- `merge`: duplicates or strengthens another accepted finding;
- `reject`: weak evidence, wrong scope, taste, or reviewer-boundary leakage;
- `park`: plausible but outside the stated problem;
- `needs-decision`: changes product intent, a public contract, safety, privacy,
  cost, dependency policy, or another user-owned boundary.

Choose the verdict:

- `keep`: no material finding justifies changing the proposal;
- `simplify`: preserve the approach but remove or narrow real complexity;
- `replace`: another approach better satisfies the same goal and constraints;
- `needs-decision`: no honest recommendation exists without user direction.

Do not average reviewer opinions or preserve alternatives merely because they
were proposed. Prefer the smallest recommendation that satisfies the original
goal and proof needs.

## Converge

Stop after one round unless accepted findings materially revise the proposal
and another pass could change the verdict. In round two, send the revised
proposal only to reviewers whose concerns were affected. Never run a third
round unless the user explicitly requests a broader planning exercise; route
that request to `$agent-planning-loop`.

Stop when the proposal is kept, the revision resolves material findings, the
same verdict repeats, remaining items are implementation details, or a
`needs-decision` item blocks judgment.

## Output

Return a compact decision packet rather than reviewer transcripts:

```text
Cross-review verdict: <keep | simplify | replace | needs-decision>
Proposal reviewed: <one sentence>
Reviewers: <skill and applicability>
Independence: <independent workers | limited inline; reason>
Accepted findings: <material findings or none>
Rejected or parked: <brief items or none>
Recommended proposal: <revised proposal, or original when kept>
Material disagreement: <decision needed or none>
Round: <1 | 2>; stop reason: <why review converged>
Recommended next action: <stop | preflight | planning route | named review route>
```

If the proposal is already lean, say so and stop. Do not manufacture a revised
proposal, extra plan, or follow-up review to make the run look productive.
