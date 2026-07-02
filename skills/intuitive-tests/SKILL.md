---
name: intuitive-tests
description: Use this skill whenever the user asks about unit test best practices, test organization, flat test suites, redundant tests, test refactors, pytest/JUnit/Jest/xUnit layout, test taxonomy, flaky tests, coverage quality, fixtures, mocks, parametrization, pruning existing UTs, or "which tests are worth keeping." It aggressively turns broad testing advice into a clean, behavior-first UT suite by preventing random test growth, pruning low-value tests, consolidating redundant checks, and requiring each retained test to prove a real behavior, failure mode, or public contract. For broad suite refactors, audit first, propose a recommended path across pruning, markers, folder layout, fixtures, and parameterization, then wait for user feedback before applying disruptive changes.
---

# Intuitive Tests

Use this skill to make a test suite easier to understand, faster to run, and
less coupled to implementation details. The goal is not "more tests." The goal
is a smaller, cleaner suite where each test has an obvious reason to exist and
future contributors can tell what behavior the suite protects.

Existing tests are not grandfathered in. If a current unit test cannot name the
project logic, caller-visible behavior, meaningful failure mode, or real contract
it protects, remove it, merge it into a stronger behavior test, or reclassify it
to the correct layer. Treat structure-only, metadata-only, wiring-only,
implementation-shape, and "coverage went up" tests as debt by default, not as
weak tests to tolerate.

The workflow is framework-agnostic, but the examples assume Python/pytest.

## Bounded Proposal Rule

For broad or ambiguous cleanup, audit first and stop after a decision-complete
proposal. Do not move files, delete tests, rewrite guidance, or edit production
code until the target slice, accepted value gate, evidence level, and stop
condition are explicit.

For a precise target where the user asks for implementation, apply one coherent
vertical slice. Keep newly discovered unrelated ideas parked instead of letting
the work expand by drift.

For test-suite cleanup, a good proposal lets the user choose between
conservative, pruning-first, layout-first, or fixture-extraction paths. The
default recommendation should be pruning-first when the suite is full of tiny,
shape-oriented, or redundant UTs. Marker/layout work is a support move, not a
substitute for improving test value.

Verification skips are repo truth, not reusable skill truth. If some tests must
not run because of network, credentials, simulator, hardware, paid APIs, or
local services, derive the skip from the user's prompt and repo instructions,
then report those skipped checks explicitly.

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

## Suite Shaping Rules

Prefer fewer, stronger tests over many narrow assertions. A clean suite should
make architecture easier to change, not freeze incidental implementation shape.

- Consolidate one-field-at-a-time tests into one behavior test when the fields
  are parts of the same observable outcome.
- Delete duplicated checks once a stronger behavior/contract/regression test
  covers the same guarantee.
- Replace brittle internal-call tests with assertions on returned values,
  emitted artifacts, state transitions, errors, logs, or outbound public effects.
- Move artifact/import/registry/config checks out of UT only when they protect a
  documented runtime contract; otherwise delete them.
- Treat net test-count reduction as a good outcome when behavior proof is
  preserved or improved.
- Park speculative edge cases unless the repo has domain evidence, a bug report,
  or a real caller-visible risk.

## Organization Taxonomy

Classify tests by the confidence they provide and the cost to run them.

Recommended layers: `unit`, `contract`, `integration`, `regression`, `local`,
and `slow`. `unit` is the narrowest layer: project logic through a stable
interface. Keep shared helpers under `tests/support/` only after reuse is real.

If the suite is already large and many commands reference exact paths, add
markers first. Move files into directories only after the marker split is green
and path consumers have been updated.

## Modes

| Mode | Use when | Output | Redirect when |
| --- | --- | --- | --- |
| Audit / propose | The test-suite cleanup target is broad or ambiguous. | Inventory, classification, value gate, deletion/consolidation candidates, recommended slice, fallback, verification plan. | The user already selected a precise implementation slice. |
| Marker | The approved path is marker-first or directory movement is risky. | Registered markers, marked touched tests, focused collection/tests. | The suite does not need layer selection. |
| Layout | The approved path moves tests into a layer-based structure. | Moved classified files, updated path consumers, collection/tests proof. | Path consumers are unknown or the user has not approved movement. |
| Prune / consolidate | The target is unnecessary, redundant, randomly accreted, or low-signal tests. | Kept/merged/deleted/reclassified tests with behavior proof and net suite impact. | Deletion would remove the last meaningful behavior check. |
| Fixture / factory | Repeated setup obscures behavior or appears across tests. | Local fixture/factory extraction with focused tests. | Reuse is speculative. |
| Parameterize | Repeated cases differ only by input, expected output, or edge case. | Table-driven tests with readable case ids. | Separate tests give better diagnosis. |

For non-trivial runs, state `Selected mode:`, `Why:`, and `Redirect:` before
auditing or editing. For tiny direct changes, one sentence can carry the same
information. Add a final `Mode note:` only when manual invocation, ambiguity, or
a better owner matters.

### 1. AUDIT / PROPOSE mode

Default for broad or ambiguous test-suite refactors.

Inventory test files and current path consumers, classify the suite, identify
low-signal tests, redundant behavior coverage, and setup/table opportunities,
then recommend one primary path and one fallback. Stop and ask for the slice
unless the prompt already chooses.

Use this decision prompt:

```text
Recommended next slice: <marker-first | layout-first | pruning-first | fixture/factory-first | parametrization-first>
Why: <short reason based on the inventory>
Value gate: <what a test must prove to stay in UT for this slice>
Deletion/consolidation candidates: <shape-only, redundant, or stale tests to remove/merge/reclassify>
Expected changes: <files/config/tests likely touched>
Verification plan: <commands to run, plus any checks skipped because the user/repo said so>
Tradeoff: <main risk or cost>
Please confirm this slice or choose a different one.
```

### 2. MARKER mode

Use when the user approves marker-first migration or when directory movement is
risky.

**Steps:**
1. Register markers in `pyproject.toml` or `pytest.ini`; prefer
   `--strict-markers`.
2. Add explicit markers to touched tests, or add a temporary transparent
   collection hook for legacy flat files.
3. Add runner examples for useful layers such as `pytest -m unit` and
   `pytest -m "contract or regression"`.
4. Run focused collection/tests for the changed layer.

### 3. LAYOUT mode

Use when the user approves a folder layout migration or explicitly asks to move
tests into a layer-based structure.

**Steps:**
1. Confirm the target layer layout and preserve importability.
2. Move only the classified files in the approved slice.
3. Update path consumers found during AUDIT / PROPOSE mode: CI, recipes,
   scripts, docs, hooks, `pytest` config, and imports.
4. Keep `tests/support/` for shared factories and fixtures; avoid making it a
   dumping ground for one-off helpers.
5. Delete stale test path wrappers, aliases, or documented old commands after
   known consumers are updated unless the user explicitly protects an external
   contract.
6. Run collection and relevant layer tests. If a check is skipped, cite the user
   prompt or repo instruction that made it out of scope.

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

### 5. FIXTURE / FACTORY mode

Use when repeated setup is the main problem.

**Steps:**
1. Extract a factory only after repeated dense setup appears in three or more
   tests, or when a single setup block obscures the behavior under test.
2. Prefer local fixtures near the tests until reuse is real.
3. Keep factories readable and domain-named; avoid generic "make dict" helpers.

### 6. PARAMETERIZE mode

Use when repeated tests differ only by input/expected output or edge case.

**Steps:**
1. Convert repeated cases into table-driven tests.
2. Give each case a readable id.
3. Keep separate tests when setup, behavior, or failure diagnosis meaningfully
   differs.

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

## Pytest Implementation Notes

For pytest, register custom markers in `pyproject.toml` or `pytest.ini` and use
`--strict-markers`. If a temporary `pytest_collection_modifyitems` bridge is
needed for legacy flat files, keep it explicit, boring, and marked with a
removal trigger.

## Report Format

When applying this skill, report only what changed or what needs a decision:

```text
Target:
Change type:
Classification / recommended slice:
Low-signal tests changed:
Behavior guarantees preserved:
Net test-count intent:
Entry points preserved:
Commands run:
Residual risk:
Next safe slice:
```
