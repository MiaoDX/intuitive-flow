---
name: intuitive-tests
description: Use this skill whenever the user asks about unit test best practices, test organization, flat test suites, redundant tests, test refactors, pytest/JUnit/Jest/xUnit layout, test taxonomy, flaky tests, coverage quality, fixtures, mocks, parametrization, pruning existing UTs, or "which tests are worth keeping." It turns broad testing advice into a practical, behavior-first cleanup workflow. For broad suite refactors, audit first, propose a recommended path across markers, folder layout, pruning, fixtures, and parameterization, then wait for user feedback before applying disruptive changes.
---

# Intuitive Tests

Use this skill to make a test suite easier to understand, faster to run, and
less coupled to implementation details. The goal is not "more tests." The goal
is a suite where each test has an obvious reason to exist.

Existing tests are not grandfathered in. If a current unit test does not prove
project logic, caller-visible behavior, a meaningful failure mode, or a real
contract, remove it, merge it into a stronger behavior test, or reclassify it to
the correct layer. Treat structure-only, metadata-only, wiring-only, and
implementation-shape tests as deletion candidates by default.

The workflow is framework-agnostic, but the examples assume Python/pytest.

## Bounded Proposal Rule

For broad or ambiguous cleanup, audit first and stop after a decision-complete
proposal. Do not move files, delete tests, rewrite guidance, or edit production
code until the target slice, accepted checklist, evidence level, and stop
condition are explicit.

For a precise target where the user asks for implementation, apply one coherent
vertical slice. Keep newly discovered unrelated ideas parked instead of letting
the work expand by drift.

For test-suite cleanup, a good proposal lets the user choose between
conservative, layout-first, pruning-first, or fixture-extraction paths.

Verification skips are repo truth, not reusable skill truth. If some tests must
not run because of network, credentials, simulator, hardware, paid APIs, or
local services, derive the skip from the user's prompt and repo instructions,
then report those skipped checks explicitly.

## Core Principles

Prefer tests that verify observable behavior through public interfaces.

Unit tests should exercise code logic at the right confidence level: parsing,
validation, state transitions, branching, transformations, error handling,
fallbacks, and domain rules. They should not exist just to assert static shape:
repository layout, file names, file presence, import locations, decorator
presence, registration tables, config keys, copied constants, class wiring, or
implementation trivia. Those checks belong in contract tests only when
packaging, runtime discovery, CLI behavior, plugin registration, schemas, or a
documented public artifact actually depends on them.

Avoid tests that only prove:

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

## Organization Taxonomy

Classify tests by the confidence they provide and the cost to run them.

Recommended layers: `unit`, `contract`, `integration`, `regression`, `local`,
and `slow`. Keep shared helpers under `tests/support/` only after reuse is real.

If the suite is already large and many commands reference exact paths, add
markers first. Move files into directories only after the marker split is green
and path consumers have been updated.

## Modes

### 1. AUDIT / PROPOSE mode

Default for broad or ambiguous test-suite refactors.

Inventory test files and current path consumers, classify the suite, identify
low-signal tests and setup/table opportunities, then recommend one primary path
and one fallback. Stop and ask for the slice unless the prompt already chooses.

Use this decision prompt:

```text
Recommended next slice: <marker-first | layout-first | pruning-first | fixture/factory-first | parametrization-first>
Why: <short reason based on the inventory>
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
is explicitly about unnecessary unit tests.

**Steps:**
1. For each candidate, decide whether it protects code logic, caller-visible
   behavior, a failure mode, or a real public contract.
2. If it protects a real guarantee, identify the stronger
   behavior/contract/regression test that already covers it or should absorb it.
3. Merge one-field-at-a-time tests into behavior tests when that improves
   readability.
4. Delete tests that only assert static shape: file names, file existence,
   directory shape, import smoke, registry membership, decorator presence,
   config keys, language mechanics, copied constants, private-call
   choreography, or stale implementation layout.
5. Reclassify file/artifact checks as contract tests only when they protect
   packaging, runtime discovery, CLI output, schemas, report payloads, or
   documented public artifacts.
6. Keep a short report of what was kept, merged, deleted, or reclassified.

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

## Low-Signal Pruning Checklist

For each candidate test, ask:

- Would a real bug make this test fail?
- Would a harmless refactor make this test fail?
- Is this assertion already covered by a stronger behavior or contract test?
- Is this testing framework/language mechanics rather than project behavior?
- Does this protect a public API, artifact, or compatibility promise?
- Is this only checking a file name, file existence, directory listing, import
  path, or stale layout?
- Is this only checking static shape, metadata, registration, wiring, decorator
  presence, or private-call choreography?

Actions:

- **Keep** if it protects safety, parsing, fallback behavior, schema, CLI/report compatibility, or a known regression.
- **Merge** if several tests assert one behavior one field at a time.
- **Delete** if it only asserts language mechanics, duplicated implementation
  shape, static metadata/wiring, file/path/name trivia, or a stale layout/API
  that is no longer canonical.
- **Reclassify** if it is not really a unit test but is valuable as contract or
  regression coverage.
- **Replace** only when deletion would remove the last proof of meaningful
  behavior.

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
Entry points preserved:
Commands run:
Residual risk:
Next safe slice:
```
