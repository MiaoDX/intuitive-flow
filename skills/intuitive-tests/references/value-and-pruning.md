# Test value and pruning

Read for admission decisions, redundant tests, or pruning/consolidation.

## Core Principles

Prefer tests that verify observable behavior through public interfaces.

Do not add or keep a UT just because code exists, a branch changed, or coverage
is desired. A UT earns its place only when it can answer all five admission
questions:

- What behavior or failure mode does this test protect?
- What realistic project bug would make it fail?
- Which public, stable, or intentionally supported local interface exercises it?
- Why is this not already covered by a stronger behavior, contract, or regression
  test?
- Would a harmless refactor keep this test green?

Unit tests should exercise code logic at the right confidence level: parsing,
validation, state transitions, branching, transformations, error handling,
fallbacks, and domain rules. They should not exist just to assert static shape:
repository layout, file names, file presence, import locations, decorator
presence, registration tables, config keys, copied constants, class wiring, or
implementation trivia. Those checks belong outside UTs, and only survive as
contract/regression tests when packaging, runtime discovery, CLI behavior, plugin
registration, schemas, or a documented public artifact actually depends on them.

Delete, merge, or reclassify tests that only prove:

- dataclass/record fields store values
- a private helper was called
- a constant equals a copied constant
- a file has a particular name
- a file exists, unless packaging or runtime discovery depends on it
- a directory contains a hard-coded list of files
- an import path or module location exists after all in-repo consumers have
  migrated to a new layout
- a module imports successfully without exercising behavior
- a decorator, marker, class inheritance edge, registry entry, or config key is
  present but no caller-visible behavior changes
- a CLI command, plugin, or route is listed but not invoked through its public
  interface
- a mock saw an internal call that does not affect caller-visible behavior
- coverage increased without a meaningful assertion

### 4. PRUNE / CONSOLIDATE mode

Use when the user approves pruning low-signal tests, or when the requested slice
is explicitly about unnecessary unit tests. Also prefer this mode when the suite
has grown through random branch coverage, shape checks, over-mocking, copied
constant checks, import smoke tests, or many tests that fail under harmless
refactors.

**Steps:**
1. Start each candidate at **Delete/Merge/Reclassify**. Upgrade it to **Keep**
   only after it passes the admission questions.
2. For each candidate, decide whether it protects code logic, caller-visible
   behavior, a failure mode, or a real public contract.
3. If it protects a real guarantee, identify the stronger
   behavior/contract/regression test that already covers it or should absorb it.
4. Merge one-field-at-a-time tests into behavior tests when that improves
   readability.
5. Delete tests that only assert static shape: file names, file existence,
   directory shape, import smoke, registry membership, decorator presence,
   config keys, language mechanics, copied constants, private-call
   choreography, or stale implementation layout.
6. Reclassify file/artifact checks as contract tests only when they protect
   packaging, runtime discovery, CLI output, schemas, report payloads, or
   documented public artifacts.
7. Keep a short report of what was kept, merged, deleted, or reclassified, plus
   the behavior guarantees preserved.

## Value Gate And Pruning Checklist

For each candidate test, ask. A "no" or unclear answer means the default action
is delete, merge into a stronger behavior test, or reclassify out of UT.

- Would a real bug make this test fail?
- Would a harmless refactor make this test fail?
- Is this assertion already covered by a stronger behavior or contract test?
- Is this testing framework/language mechanics rather than project behavior?
- Does this protect a public API, artifact, or compatibility promise?
- Can the test name the behavior in domain language without mentioning private
  implementation choreography?
- Is this only checking a file name, file existence, directory listing, import
  path, or stale layout?
- Is this only checking static shape, metadata, registration, wiring, decorator
  presence, or private-call choreography?

Actions:

- **Keep** only if it protects safety, parsing, fallback behavior, state
  transition, domain rule, schema, CLI/report compatibility, or a known
  regression through a stable interface.
- **Merge** if several tests assert one behavior one field at a time, or if a
  narrower test is fully subsumed by a stronger behavior test.
- **Delete** if it only asserts language mechanics, duplicated implementation
  shape, static metadata/wiring, file/path/name trivia, or a stale layout/API
  that is no longer canonical.
- **Reclassify** if it is not really a unit test but is valuable as contract or
  regression coverage.
- **Replace** only when deletion would remove the last proof of meaningful
  behavior.
- **Reject new tests** if they do not pass the admission questions; do not leave
  TODO-quality tests in the suite to be cleaned later.
