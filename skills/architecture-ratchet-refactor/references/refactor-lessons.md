# Ratchet Refactor Lessons

Use this reference when a ratchet cleanup starts to become mechanical.

## Effective Patterns

- A repo-local quality signal creates useful pressure. Examples: top oversized
  modules, complexity rows, stale imports, duplicate command surfaces.
- Small verified commits work well for multi-agent checkouts. Stage only owned
  files and keep each slice reviewable.
- Splits are valuable when they name an owner: report section renderer,
  runtime-map contract, visual-candidate policy, backend evidence packet,
  scenario factory, fixture builder.
- Compact active-plan plus completed-ledger docs prevent repeated rediscovery.
  Record effect, metric delta, and proof class; avoid command-log dumps.
- Focused tests are better than full-suite reflexes when the slice has a clear
  contract. Run broader gates only when the claim is broader.

## Ineffective Patterns

- Pure line-count chasing can hide that architecture is still a large facade
  plus private aliases.
- Keeping every wrapper for compatibility turns extraction into concept
  multiplication.
- Moving helper functions without migrating callers or deleting stale surfaces
  often creates a helper junk drawer.
- Splitting tests by line count leaves the real problem if duplicated setup and
  assertion vocabulary remain.
- Re-reading all orientation docs on every resume wastes time. Prefer a hot
  resume from status, recent commits, active plan, and the ratchet summary.

## Necessary Friction

- Public contracts need proof: command shape, artifact schema, report output,
  public/private evaluation boundaries, and user-visible behavior.
- Internal contracts should be challenged. Private helpers, legacy aliases, and
  test-only import paths are not architecture goals.
- Every new module needs an owner layer. If no layer fits, update the
  architecture decision before adding the module.
- Stop gates matter for public behavior, destructive deletes, paid/live
  infrastructure, hardware, security, and privacy.

## Useful Review Questions

- Did this slice delete or consolidate a concept, or only move code?
- Are old callers migrated to the new owner?
- Can future agents find the canonical owner without reading commit history?
- Did tests become more domain-focused, or more coupled to private helpers?
- Does the plan ledger say why the architecture is simpler?
