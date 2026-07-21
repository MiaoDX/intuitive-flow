# Evidence And Output Contract

Use these shapes as a compact contract. Adapt fields only when the task needs a
more specific schema.

## Research Brief

```markdown
# Research Brief: <topic>

- Question:
- Decision or audience:
- Included:
- Excluded:
- Freshness/date boundary:
- Completion test:
- Constraints: tools, access, time, cost, language, geography
```

## Source Classes

Rank sources by their relationship to the claim, not by visual polish:

1. **Primary:** official documentation, specification, source code, first-party
   API, original dataset, regulator filing, court record, or original paper.
2. **Credible secondary:** independent analysis or practitioner reporting with
   visible methods and citations.
3. **Discovery only:** search snippets, aggregators, unsourced lists, reposts,
   and AI-generated summaries. Use these to find stronger evidence, not as the
   sole support for material claims.

A source can be primary for one claim and secondary for another. A vendor is a
primary source for its release date and documented interface, but not an
independent authority on its benchmark superiority.

## Evidence Ledger

Keep one row per claim-source relationship. Markdown is sufficient for small
research; use CSV or JSON when the comparison is large or programmatic.

| Field | Meaning |
| --- | --- |
| `claim_id` | Stable short identifier used by the report |
| `claim` | One falsifiable factual statement |
| `source` | Canonical URL or repository path |
| `source_class` | Primary, secondary, or discovery |
| `published_or_updated` | Relevant source date, when available |
| `evidence` | Short quotation, field value, or faithful paraphrase |
| `relationship` | Supports, contradicts, or qualifies |
| `confidence` | Verified, supported, or tentative |
| `notes` | Definition, method, access, or scope caveat |

Confidence labels:

- **Verified:** directly established by an authoritative primary source.
- **Supported:** multiple credible sources converge, or a primary source plus
  corroboration supports an interpretation.
- **Tentative:** only indirect, incomplete, stale, or conflicting evidence is
  available.

Do not upgrade confidence merely because several secondary pages repeat the
same upstream claim.

## Contradiction Record

For a material disagreement, capture:

```markdown
### <question or claim>

- Position A and source:
- Position B and source:
- Likely reason: date, definition, sample, method, incentive, or unknown
- Current judgment and confidence:
- Evidence that would resolve it:
```

## Report Shape

```markdown
# <Literal Research Topic>

Research date: <YYYY-MM-DD>
Scope: <one paragraph>

## Executive Summary

<Decision-relevant answer and 3-5 key findings.>

## Findings

<Claims with adjacent citations and clear confidence where it matters.>

## Contradictions And Uncertainty

<Material disagreements, weak evidence, and interpretation boundaries.>

## Gaps

<What was not covered, could not be retrieved, or remains unresolved.>

## Method

<Subquestions, source selection, date boundary, gap pass, and constraints.>
```

Avoid a detached bibliography as the only citation mechanism. Put links next to
the claims they support; include a source appendix only when it improves auditability.
