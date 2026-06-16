# High-Noise And Materiality

## High-Noise Surface Budget

Do not solve a large repo by reading every historical or generated artifact.
Those surfaces often matter, but their cleanup value comes from current
confusion, live references, false confidence, or stale reachable entrypoints,
not from their size.

Apply this default budget before deep-reading:

- `.planning/**`, `docs/plans/**`, `tasks/**`, `.scratch/**`, retrospectives,
  and issue workspaces: index filenames, statuses, dates, owners, and current
  doc/code references first. Deep-read only the files needed to prove stale
  backlog drift, duplicated source-of-truth, or a live workflow trap.
- `tmp/**`, `output/**`, `logs/**`, generated evidence, snapshots, manifests,
  and local artifacts: check whether they are tracked, published, referenced by
  current docs/tests/scripts, or used as fixtures. If not, park them as local
  residue instead of expanding them.
- Very large tests, profile registries, generated constants, or data tables:
  inspect names, counts, ownership, import/caller references, and failing or
  false-green gates before reading long bodies. Deep-read only around a
  candidate seam.
- Vendored dependencies, submodules, virtualenvs, caches, egg-info, and build
  outputs: skip by default unless the repo explicitly owns that surface or a
  live command depends on it.

Useful first-pass commands are bounded `find`, `git ls-files`, `git status`,
`rg --files`, `rg -n <specific token> <specific paths>`, `git log -n`, and
small `sed` windows. Bound both the command and the printed result:

- For default broad discovery, run the bundled high-noise summary script before
  ad hoc directory scans:

  ```bash
  node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/high-noise-summary.mjs"
  ```

  When working inside this source repo, this equivalent path is also valid:

  ```bash
  node skills/intuitive-reduce-entropy/scripts/high-noise-summary.mjs
  ```

  Run it from the target repository root. The script includes common historical
  and generated surfaces plus large `tests`/`test` and `profiles` surfaces when
  present. Use `--surface <path>` for a narrowed probe and `--examples N` when
  fewer examples are enough. If the script is not available, produce the same
  summary shape manually; do not substitute a long custom `find`,
  `git ls-files`, or `rg --files` listing.
- Do not include high-noise roots in broad path-listing commands such as
  `rg --files gr00t_manipulation scripts tests docs .planning .scratch specs`
  or `find .planning docs/plans ...`. Use the summary script for those roots,
  then run targeted `rg -n <specific token> <specific paths>` or a small `sed`
  window only after a candidate needs proof.
- prefer counts, grouped summaries, and 5-20 representative examples over long
  path lists;
- print at most the first screen of any index, then switch to targeted
  reference searches;
- for large markdown or tests, read headings/status/top matter first, then only
  the narrow window around the candidate evidence;
- if a command reports `Broken pipe`, truncates a huge list, or produces mostly
  filenames without a candidate, treat that as a budget signal and stop the
  scan.

Avoid broad `rg` or `cat` commands whose output is mostly old plans, generated
data, or full test/profile bodies. If the next probe would mostly increase
transcript size instead of candidate confidence, stop and report the candidate,
parked observation, or saturation reason.

Exploratory verification commands can be high-noise too. For full test
collection, broad `pytest -q`, wide linters, generated-report checks, or any
command likely to print many test IDs, paths, warnings, or JSON rows, save the
full output to a temp log and print only a bounded summary. Prefer the bundled
summary runner over hand-written shell snippets:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/bounded-command-summary.mjs" \
  --kind generic --timeout 180 -- \
  <command> <args...>
```

Use the full temp log only for targeted follow-up. Do not paste hundreds of
collected test names, generated rows, or repeated warnings into the transcript
when the candidate only needs failure type, count, and a few representative
lines.

For `pytest --collect-only`, use the pytest-specific mode. It omits the raw
tail because the tail often still contains many node IDs:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/bounded-command-summary.mjs" \
  --kind pytest-collect --timeout 180 -- \
  env PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 <pytest collect command>
```

If a tiny sample of collected node IDs is relevant, print at most 10 with a
purpose-specific grep. Never print the full collection list.

When using `bash -lc`, quote search patterns for the shell that will run `rg`.
Backticks inside double quotes are still command substitutions; prefer fixed
string probes such as `rg -n -F -e 'sonic_native' -- docs .planning` or single
quoted regex patterns. Do not put markdown-code tokens like `` `name` `` inside
double-quoted `rg` patterns.

When a high-noise surface produces a candidate, include the evidence chain:

```text
Surface:
Why this surface is live:
Small evidence sampled:
Deep-read trigger:
Candidate or parked reason:
```

## Materiality Contract

Treat a candidate as eligible only when it prevents future surprise in a way a
reasonable maintainer would notice and when the requested change itself passes
the demand sanity gate. At least one of these must be true:

- **False confidence**: a gate, test, script, link check, build, or report can
  pass while hiding a current broken or misleading state.
- **Live source drift**: two current sources of truth disagree about a live
  command, route, owner, public surface, or workflow.
- **Stale surface**: a live API, wrapper, command, generated output, index, or
  path remains reachable even though known in-repo consumers have moved.
- **Real workflow friction**: a future human or agent following current docs,
  commands, or scripts would likely hit an error, dead end, or rediscovery loop.
- **Recurring rediscovery**: the repo repeatedly forces agents to infer the same
  non-obvious rule because it is not encoded in docs, tests, gates, or structure.

Before applying those reasons, classify the change intent:

- `add_feature` or `add_surface`: the candidate creates a new command, doc
  surface, workflow step, API, abstraction, test layer, script, generated
  artifact, or user-visible behavior.
- `remove_feature` or `reduce_scope`: the candidate deletes, hides, prunes, or
  narrows behavior, commands, docs, tests, APIs, compatibility paths, or
  workflow affordances.
- `cleanup_existing`: the candidate clarifies, fixes, or consolidates an
  existing surface without materially adding or removing behavior.

For `add_feature` / `add_surface`, require a `Demand gate:` answer showing the
new entity is better than the reduce-entropy defaults: delete stale surface,
merge duplicate guidance, narrow scope, reuse an existing route, or document
current truth. If the answer is only "user asked", "could be useful", or
"consistent", park it.

For `remove_feature` / `reduce_scope`, require a `Demand gate:` answer showing
why the behavior should no longer exist. Evidence can be stale consumers,
source drift, false confidence, unsupported workflow, explicit product intent,
or a replacement that known in-repo callers already use. If current users or
agents may still rely on it and the evidence is uncertain, push back and route
the question to `$grill-with-docs-batch`, `$intuitive-preflight`, or the
relevant owner instead of proposing deletion.

For `cleanup_existing`, the demand gate may be brief, but still state why doing
this cleanup now beats leaving the existing behavior alone.

These are not eligible by themselves:

- wording polish, punctuation, ordering, numbering, or formatting;
- a tiny index or route tweak that is only nicer, not less misleading;
- a test-only or documentation-only follow-up that merely supports a just-made
  implementation change;
- splitting helper tests, README notes, or report wording into their own
  "group" after the behavioral slice has already been counted;
- another possible refactor whose benefit is "cleaner" but not tied to a
  current surprise, false-green, stale surface, or repeated rediscovery.
- an added feature/surface whose demand gate does not explain why reuse,
  narrowing, documentation, or deletion is insufficient;
- a deleted or reduced feature whose demand gate does not explain why the
  behavior is no longer valuable enough to keep.

Group supporting work with its parent slice. If a route parser changes, its
regression test belongs to the route-parser candidate. If a gate is strengthened,
the doc command update belongs to the gate candidate. Do not count supporting
tests or docs as separate entropy groups unless they independently satisfy the
eligible list above.

### Commit-Worthiness Gate

Materiality alone is not enough for an autonomous loop. A candidate also needs
enough impact to justify a standalone commit:

- `P0` and `P1` candidates are usually commit-worthy when they have current repo
  evidence and bounded risk.
- `P2` candidates are eligible only when they remove recurring rediscovery,
  unblock a real workflow, or are bundled with a higher-impact parent slice.
- Reject isolated P2 work whose main scope is a single-file metadata correction,
  starter template polish, route/index neatness, wording alignment, small date
  or status text cleanup, or a gate extension that only protects the change just
  made.
- A P2 candidate must include `Impact radius:` and `Maintainer test:`. If the
  maintainer test cannot explain the review value in one sentence without
  relying on "consistency" or "cleanup", park it.
- Prefer one no-change report with parked observations over a series of tiny
  commits. The skill succeeds when it stops correctly.

### Loop Deterministic Gate

When validating an open-ended discovery loop, write the candidate groups to JSON
and run [scripts/materiality-gate.mjs](../scripts/materiality-gate.mjs) before
adding another group to the selection packet. Resolve the script relative to
this `SKILL.md`, not relative to the target repository. In Codex that is
usually:

```bash
node "$HOME/.codex/skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs" candidates.json
```

When working inside this source repo, this equivalent path is also valid:

```bash
node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs candidates.json
```

The gate is intentionally small: it cannot replace engineering judgment, but it
catches quota-filling, polish-only candidates, and supporting work counted as
standalone groups. If Node or the bundled script is unavailable, apply the same
candidate fields manually and explicitly say the deterministic gate was skipped.

Example:

```json
{
  "requested_groups": 5,
  "candidates": [
    {
      "id": "link-placeholder-gate",
      "title": "Reject placeholder links in scoped docs",
      "severity": "P1",
      "change_type": "add_surface",
      "demand_gate": "A docs gate already claims scoped links are trustworthy; adding this check is justified because reuse cannot expose placeholder links.",
      "materiality": ["false_confidence"],
      "impact_radius": "workflow",
      "maintainer_test": "The docs gate can pass while publishing placeholder links, so reviewers need this protection before trusting link checks.",
      "evidence": ["link:check currently ignores [text](#) in scoped docs"]
    }
  ]
}
```

Run from this source repo:

```bash
node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs candidates.json
```

If it returns `stop_recommended: true`, stop before the requested count is
exhausted and report why the discovery loop saturated.
