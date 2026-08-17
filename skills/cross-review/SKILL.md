---
name: cross-review
description: |
  Challenge an existing agent proposal through a small bounded set of
  independent review perspectives, then judge the findings into one simpler or
  more defensible recommendation. Use immediately after an agent proposes a
  solution when the user asks whether there is a simpler approach, wants a
  second opinion or other perspectives, asks for cross review or multiple
  review rounds, or names reviewer skills such as ponytail-review and
  intuitive-reduce-entropy. This is a lightweight post-proposal review, not a
  planning loop, implementation workflow, or code/PR review.
---

# Cross Review

Review an existing proposal without turning the request into a full planning
exercise. Preserve the original problem and constraints, let independent
reviewers challenge the same proposal, and keep the main session as the only
judge.

## Boundary

Own:

- finding the proposal already present in the conversation or named artifact;
- selecting two to four relevant reviewer skills;
- keeping reviewer inputs independent;
- deduplicating and judging findings;
- returning one `keep`, `simplify`, `replace`, or `needs-decision` verdict;
- running one review round by default and at most two when revision matters.

Do not own:

- inventing a plan when no proposal exists;
- implementing or editing the proposal under review;
- correctness-focused code, diff, or PR review;
- user grilling, full planning alignment, or execution preflight;
- persistent review state, reviewer registries, or unbounded iteration.

Route missing or still-fuzzy proposals to `$agent-planning-loop` or the
appropriate planning skill. Route an accepted but execution-incomplete proposal
to `$intuitive-preflight`. Route code or PR findings to the relevant code-review
skill.

## Freeze The Input

Identify the exact proposal, the problem it claims to solve, and any explicit
constraints or non-goals. Prefer the latest assistant proposal when the user
says "this" or "that proposal." Ask one concise question only when multiple
candidate proposals make the target materially ambiguous.

Freeze that input for the review round. Do not revise it between reviewers or
show one reviewer's findings to another reviewer in the same round.

## Select Reviewers

When the user names reviewer skills, use exactly those skills unless one cannot
apply within its own boundary. Use two to four reviewers. Record an inapplicable
reviewer instead of stretching its semantics, and ask only when fewer than two
useful perspectives remain.

When the user does not name reviewers, default to:

- `$ponytail-review` for removable abstractions, dependencies, flexibility, and
  implementation-shaped complexity;
- `$intuitive-reduce-entropy` in plan entropy mode with quick-scan intensity for
  duplicate ownership, scope leakage, weak assumptions, and proof gaps.

Add one specialist perspective only when the proposal's central claim would
otherwise go unreviewed, such as an architecture or test-design boundary. State
why it was added. Do not add reviewers to fill a quota.

Read every selected reviewer's instructions and preserve its native scope. The
reviewer supplies findings; this skill owns comparison and judgment.

## Run Independent Passes

Use the host-approved delegation route when independent read-only reviewers are
available. Give each reviewer only:

- the frozen problem and proposal;
- the minimum repository context needed to assess it;
- its named skill and native output contract;
- a read-only instruction with no expected verdict or prior reviewer findings.

Reviewers must not edit files, expand the objective, ask the user questions, or
decide another reviewer's concerns. If independent workers are unavailable, run
the passes inline from the frozen input and label independence as limited.

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
