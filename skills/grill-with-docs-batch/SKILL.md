---
name: grill-with-docs-batch
description: Resolve material plan or domain questions against repository docs in small batches, then stop when decisions are settled.
disable-model-invocation: true
---

# Grill With Docs Batch

Challenge unresolved plan or domain decisions against the target docs and code.
When asked whether questions remain, answer yes/no first. Implementation
defaults, tests, wording, and settled choices are resolved from evidence, not
asked.

A question earns attention only if its answer changes scope, a public/private
boundary, acceptance or rollout, cost, safety, ownership, or domain meaning.
Use repository evidence to resolve facts before asking the user.

## Supporting Primitives

Use the routed Matt Pocock `grilling` and `domain-modeling` skills as the
supporting primitives for interview mechanics, glossary sharpening, and durable
context/ADR discipline. This skill owns batch pacing, materiality filtering,
convergence, and document handoff. It does not depend on the thin Matt
`grill-with-docs` wrapper, so that optional wrapper is not part of this skill's
runtime dependency closure.

If material questions remain, read [question batches](references/question-batches.md).
After answers, apply accepted updates to the named document, then reassess whether
another question changes the decision. Read [document updates](references/document-updates.md)
when recording answers or cleaning up plans/ADRs; do not load it for a critique
that does not edit documents. Use the user's language.

Stop when an implementer can identify the change, non-goals, boundaries, proof,
and next step, or the user signals process fatigue. Report Plan state:,
Recommended next action:, and Shortcut:. A settled target can need zero questions.

A short approval applies to the single action just proposed. Preserve accepted
scope and execute that action without another approval loop. Ask only if multiple
proposed actions make the reply materially ambiguous.
