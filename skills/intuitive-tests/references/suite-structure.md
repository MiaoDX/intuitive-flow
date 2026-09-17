# Suite structure

Read for markers, test file moves, fixture extraction, or parameterization.
Choose the applicable section; pytest details apply only to pytest suites.

## Organization Taxonomy

Classify tests by the confidence they provide and the cost to run them.

Recommended layers: `unit`, `contract`, `integration`, `regression`, `local`,
and `slow`. `unit` is the narrowest layer: project logic through a stable
interface. Keep shared helpers under `tests/support/` only after reuse is real.

If the suite is already large and many commands reference exact paths, add
markers first. Move files into directories only after the marker split is green
and path consumers have been updated.

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

## Pytest Implementation Notes

For pytest, register custom markers in `pyproject.toml` or `pytest.ini` and use
`--strict-markers`. If a temporary `pytest_collection_modifyitems` bridge is
needed for legacy flat files, keep it explicit, boring, and marked with a
removal trigger.
