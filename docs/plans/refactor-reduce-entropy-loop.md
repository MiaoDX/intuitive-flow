---
refactor_scope: reduce-entropy-loop
status: DONE
accepted_severities:
  - P1
  - P2
last_verified: 2026-06-08
---

# Refactor Scope: Reduce Entropy Loop

## Status

DONE

## Target

Run `$intuitive-reduce-entropy` against the current repo until fresh audits no
longer surface P0/P1 or materially useful P2 candidates. Treat requested loop
size as a maximum, not a quota.

## Selected Candidates

- [x] P1 false confidence: `bun run check:skills` promised local skill resource
      reference coverage, but only validated links in each `SKILL.md` entrypoint.
      Links from `references/` or `templates/` Markdown files could drift while
      the normal proof boundary stayed green.
- [x] P1 live source drift: `README.md` listed `$intuitive-preflight` as a
      primary skill row while `ARCHITECTURE.md` and `STATUS.md` define the small
      public surface as flow, refactor, reduce-entropy, and squash, with
      preflight as a routed specialist/pre-execution contract skill.
- [x] P1 live source drift: `skills/intuitive-reduce-entropy/SKILL.md` still
      listed `$intuitive-preflight` in its `Public Entry Model`, while
      `README.md`, `ARCHITECTURE.md`, and `STATUS.md` define preflight as a
      specialist or routed pre-execution contract skill.
- [x] P1 false-red verification: tmux-dependent tests gate on `tmux -V` even
      though restricted agent environments can have the binary available while
      `tmux new-session` is not usable.
- [x] P1 verification isolation: local skill sync tests stub `npx`, but still
      call the real npm registry through `select_npm_registry`, so unit-style
      verification can hang or fail on network availability instead of code
      behavior.
- [x] P2 human-doc tier drift: `BELIEFS.md` was linked as doctrine and included
      in the architecture system map while the active human truth set excluded
      it, forcing future maintainers to rediscover whether it carried current
      commands or only philosophy.
- [x] P2 stale audit coverage: `docs/human/skill-self-improvement-audit.md`
      claimed to cover every repo-owned root skill, but its table missed newer
      root skills from `scripts/local-skill-manifest.txt`.
- [x] P1 live source drift: a new `intuitive-planning-loop` root skill was
      added to the manifest and README primary table, but architecture, status,
      reduce-entropy routing guidance, and the manifest-wide skill audit still
      described the older public skill surface.
- [x] P1 live source drift: fuzzy idea routing still named `office-hours` and
      `grill-me`, but the default installed surfaces expose the repo-owned
      planning loop and `grill-with-docs` semantics rather than those entrypoint
      names.
- [x] P1 live source drift: `BELIEFS.md` still told humans to use
      `office-hours` or `grill-me` for big questions even though README,
      architecture, status, and installed repo-owned skills expose
      `$intuitive-flow` and `$intuitive-planning-loop` for that surface.
- [x] P1 stale surface: retired repo-owned skills listed as `legacy-skill`
      were pruned from Claude/Codex/shared skill install roots, but the
      generated MiMoCode wrapper `~/.config/mimocode/command/<skill>.md` could
      remain reachable after `scripts/update.sh`.
- [x] P2 recurring rediscovery: `docs/human/skill-self-improvement-audit.md`
      still presented removal of runtime `Skill Self-Improvement Rule` blocks
      as an immediate correction even though the runtime blocks were already
      absent from repo-owned skills.
- [x] P2 workflow friction: reduce-entropy routing mentioned
      `$improve-codebase-architecture` as an optional architecture scanner, but
      some routing text omitted the install boundary even though the skill is
      not part of repo-owned or managed external manifests.
- [x] P2 live source drift: loop gate frontmatter listed only P1 accepted
      severities even though the loop target and completed checklist included
      materially useful P2 candidates.
- [x] P2 live source drift: `STATUS.md` remained marked last reviewed on
      2026-06-06 even though it was updated on 2026-06-08 for the current
      public skill surface.
- [x] P1 false confidence: the new `multica-goal-tracker` root skill added a
      public TypeScript script for goal extraction, issue comments, run
      selection, and rendered completion evidence, but the normal proof boundary
      did not run any skill-local behavior tests.
- [x] P1 false confidence: `bun run verify` did not run ShellCheck, so Bash
      orchestration scripts could carry ShellCheck error-level issues while the
      normal verifier stayed green.
- [x] P1 live source drift: multiple reachable utilities wrote Codex hook
      configuration, and `scripts/dev/tmux-richer.sh` replaced
      `~/.codex/hooks.json` instead of preserving other hook owners such as
      Agent Deck.
- [x] P1 false confidence: the GitHub Actions verifier ran `bun run verify`
      after the ShellCheck gate was added, but did not explicitly install the
      ShellCheck binary.
- [x] P1 false confidence: `skills/skill-runner/SKILL.md` documented the
      `summarize_skill_runner_runs.py` batch-review command, but the normal
      `bun run verify` proof boundary only exercised `run_skill_runner.py` and
      could miss summarizer argument parsing, artifact parsing, or JSON output
      drift.
- [x] P2 stale surface: `scripts/tasks/sync-local-commands-skills.sh` still
      synced `.claude/skills/*` directly through the skills CLI even though the
      current canonical repo-owned skill surface is `skills/*` plus
      `scripts/local-skill-manifest.txt`.
- [x] P2 false confidence: GitHub Actions ran the default verifier without
      explicitly installing `tmux`, while several tmux-backed behavior tests are
      skipped when `hasUsableTmux()` cannot create a detached session.
- [x] P2 live source drift: `BELIEFS.md` listed `layout` and
      `tests and harnesses` as part of the human surface, while the live human
      docs define the authoritative human surface as `README.md`,
      `ARCHITECTURE.md`, `STATUS.md`, and `docs/human/**`.
- [x] P1 false confidence: `package.json` used shell-expanded
      `skills/**/*.test.ts` in the default test command, but Bash did not
      expand that glob in this checkout, so skill-local tests such as
      `skills/multica-goal-tracker/scripts/track_goal.test.ts` were omitted
      from `bun run test` and `bun run verify`.
- [x] P1 workflow friction: `multica-goal-tracker` finish evidence attached a
      rendered completion card, but did not make the card visible inline when
      Multica returned an attachment URL and did not preserve the real selected
      session completion output as a first-class issue comment.
- [x] P1 false confidence: `multica-goal-tracker` Codex JSONL completion
      extraction could prefer a later commit-summary turn over the goal's
      completed turn when the goal's final message did not match the result
      template, and the finish evidence omitted Codex goal start/end/duration
      metadata that was already available in session JSONL.
- [x] P2 live source drift: the default managed GStack standard surface pruned
      `gstack-plan-eng-review` / `plan-eng-review` even though repo-owned
      architecture routes require that review gate for architecture-shaped
      refactors.
- [x] P2 false confidence: GitHub Actions pins Bun `1.3.6` while the local
      runtime and lockfile type surface are `1.3.12` / `@types/bun@1.3.13`,
      even though the human docs say CI and local `bun run verify` are aligned.
- [x] P1 false confidence: `multica-goal-tracker` Codex JSONL evidence can
      choose the latest completed follow-up goal instead of the issue's tracked
      `/goal` when one session contains multiple completed goals.
- [x] P1 workflow friction: `multica-goal-tracker` finish evidence treated each
      run as a standalone completion and did not preserve an issue-level
      attempt timeline, so partial or follow-up goal runs could be misread as
      final completion evidence and cumulative issue effort was lost.
- [x] P1 false confidence: `multica-goal-tracker` stored structured attempt
      metadata as raw JSON inside an HTML comment, so real goal or session text
      containing the comment terminator could break timeline parsing and lose
      cumulative attempt evidence.
- [x] P1 workflow friction: `multica-goal-tracker` command examples hard-coded
      this checkout's absolute path, so the installed portable skill could give
      dead commands for the documented `~/intuitive-flow` clone path or any
      other checkout location.
- [x] P1 false confidence: `multica-goal-tracker` accepted partial, blocked,
      and failed attempts but still labelled raw session child comments as
      completion output and only preserved Codex goal timing for `complete`
      goal metadata.

## Saturation Audit

Selected candidates: none.

Current state:

- `bun run verify` passes from current HEAD.
- The repo-owned skill manifest matches the live `skills/*/SKILL.md` surface.
- Human docs now agree on the small public skill surface and specialist routing,
  including `intuitive-planning-loop` as the bounded autonomous planning
  entrypoint.
- The reduce-entropy skill's public entry model now matches the human docs:
  flow, refactor, reduce-entropy, planning-loop, and squash are the user-facing
  choices, while preflight remains a specialist pre-execution contract skill.
- `BELIEFS.md` is consistently marked as supporting doctrine rather than the
  active source for current commands, installed surfaces, or maintenance state.
- `docs/human/skill-self-improvement-audit.md` covers every current root skill
  listed in `scripts/local-skill-manifest.txt`.
- Tests no longer depend on a live npm registry for local skill sync coverage,
  and tmux-dependent tests skip when tmux cannot create a detached session.
- Fuzzy idea routing and supporting doctrine no longer advertise `office-hours`
  or `grill-me` as default entrypoints when they are not part of the repo-owned
  or default managed skill surface.
- `legacy-skill` pruning removes the same retired skill from Claude, Codex,
  shared agent skills, and its generated MiMoCode wrapper.
- The skill self-improvement audit now marks the runtime self-improvement block
  removal as a completed baseline correction, not an outstanding action item.
- Architecture scanner routing consistently treats `improve-codebase-architecture`
  as host-installed optional extra discovery, not a default installed surface.
- The loop gate frontmatter now matches the actual accepted P1/P2 scope.
- `STATUS.md` last-reviewed metadata matches the current 2026-06-08 public
  surface review.
- The new `multica-goal-tracker` root skill is listed in the manifest,
  included in TypeScript/test discovery, covered by focused skill-local tests,
  and represented in the manifest-wide skill self-improvement audit as a
  specialist issue-workflow utility rather than a primary planning/build
  entrypoint.
- `bun run verify` now includes `bun run check:shell`, and ShellCheck
  error-level validation passes for `scripts/update.sh`, `scripts/**/*.sh`, and
  `.githooks/pre-commit`.
- Codex hook ownership is explicit: tmux-agent-status hooks merge into
  `~/.codex/hooks.json` through a tested TypeScript helper, preserving existing
  hook owners such as Agent Deck notify hooks.
- GitHub Actions installs ShellCheck before running `bun run verify`, so the CI
  proof boundary has the same tool dependency as the local verifier.
- The documented `skill-runner` summarizer command is now exercised by the
  default Bun test suite with a CLI smoke over real run artifacts.
- The legacy `.claude/skills/*` sync path is removed; repo-local skill sync now
  ignores that host discovery layout and installs only manifest-owned
  `skills/*` entries.
- GitHub Actions now installs `tmux` alongside ShellCheck before `bun run
  verify`, so tmux-backed tests do not depend on unstated runner image contents.
- `BELIEFS.md` now treats layout choices, tests, and harness quality as human
  responsibilities rather than extra source-of-truth surfaces.
- `bun run test` now asks Bun to discover tests recursively under the
  repo-owned `./scripts` and `./skills` directories, so nested skill-local tests
  are included without relying on Bash `globstar`.
- `multica-goal-tracker` finish comments now keep the overview card, an inline
  image reply when Multica returns an attachment URL, and the raw selected
  session output as a separate code-block child comment.
- `multica-goal-tracker` Codex JSONL evidence now prefers the completed goal
  turn over later session turns and carries Codex goal start/end/duration into
  the rendered card, finish comment, and raw-output comment when available.
- CI now installs Bun `1.3.12`, matching the `packageManager` pin in
  `package.json`; `bun run check:skills` fails if the workflow Bun pin drifts
  from the repo pin or if the repo pin is removed.
- `multica-goal-tracker` Codex JSONL evidence now matches completed goal
  timing back to the issue's tracked `/goal` before falling back, and it does
  not attach matched goal timing to unrelated fallback output.
- `multica-goal-tracker` finish evidence now records hidden structured attempt
  metadata, labels non-complete attempts as execution records rather than
  completion records, derives the next attempt number from the highest existing
  sequence, and renders an issue-level attempt timeline with cumulative
  duration.
- `multica-goal-tracker` attempt metadata is now versioned and base64 encoded
  inside the hidden comment marker, with legacy raw-JSON metadata still readable
  so older finish comments continue to contribute to the timeline.
- `multica-goal-tracker` command examples now run from the Intuitive Flow
  checkout root with relative script paths, and `bun run check:skills` rejects
  the previously leaked machine-local checkout path in skill Markdown.
- `multica-goal-tracker` now treats Codex `complete`, `partial`, `blocked`, and
  `failed` goal updates as terminal attempt timing metadata, and non-complete
  attempts use execution wording in both finish comments and raw session child
  comments.
- No current P0/P1/P2 candidate remains selected after the latest audit.
- Remaining `stale`, `legacy`, `skip`, and `compatibility` search hits are
  intentional policy text, tests, fixtures, completed plan history, or updater
  runtime messages rather than current false confidence or live source drift.
- The only open plan was this loop gate; all other `docs/plans/*.md` gates are
  marked `DONE`.

Parked items:

- Future updater shell coverage remains parked in older done gates until a real
  updater behavior change makes it material.
- Broader qualitative skill evals remain parked until fixture evidence shows a
  recurring failure mode.
- A stricter tmux-required verifier remains parked because `hasUsableTmux()`
  returns true in the main checkout and `bun run verify` currently runs the
  tmux-backed behavior tests instead of skipping them.

## Evidence Ladder

- Materiality gate:
  `node skills/intuitive-reduce-entropy/scripts/materiality-gate.mjs <candidate.json>`
- Narrow proof: `bun test scripts/lib/check-skills.test.ts`
- Contract proof: `bun run check:skills`
- Shell proof: `bun run check:shell`
- Full proof: `bun run verify`

## Stop Condition

Stop when a fresh saturation audit returns `Selected candidates: none`, meaning
the remaining observations are only wording polish, speculative cleanup,
already-covered work, or tiny niceties that would not prevent future surprise.

## Execution Log

- 2026-06-08: Opened the loop gate after the user asked to continue reducing
  entropy and commit each coherent refactor slice until no obvious candidates
  remain.
- 2026-06-08: Selected the skill resource link gate as P1 false confidence.
  The deterministic materiality gate accepted it with one eligible candidate and
  no warnings.
- 2026-06-08: Added a red test proving `checkSkills` missed a broken relative
  link from a skill reference file, then extended the checker to validate
  Markdown links in all skill Markdown files.
- 2026-06-08: Verified with `bun test scripts/lib/check-skills.test.ts`,
  `bun run check:skills`, and `bun run verify`: 74 tests passed across 11 files.
- 2026-06-08: Selected the README primary skill surface drift as P1 live source
  drift and real workflow friction. The deterministic materiality gate accepted
  it with one eligible candidate and no warnings.
- 2026-06-08: Removed `$intuitive-preflight` from the README primary skill table
  while keeping it in the specialist/direct-use paragraph, matching
  `ARCHITECTURE.md` and `STATUS.md`.
- 2026-06-08: Ran a fresh saturation audit after the README slice. Verified the
  manifest/skill surface, human docs, plan statuses, link surfaces, and noisy
  stale/legacy search hits. No remaining observation passed the materiality
  contract, so the loop closed early with `Selected candidates: none`.
- 2026-06-08: Reopened the loop from current `HEAD` for a completion audit.
  Selected the reduce-entropy skill's own public entry drift as P1 live source
  drift and real workflow friction. The deterministic materiality gate accepted
  it with one eligible candidate and no warnings.
- 2026-06-08: Removed `$intuitive-preflight` from the reduce-entropy skill's
  `Public Entry Model` list while keeping it in the specialist skill section.
  Verified with `bun run check:skills` and targeted source-of-truth search.
- 2026-06-08: Selected two remaining P1 verification candidates for later
  slices: tmux capability gating and local skill sync test registry isolation.
- 2026-06-08: Isolated local skill sync tests from live npm registry probes by
  stubbing the expected `npm view <package> version` call next to the existing
  `npx` stub. Verified with
  `bun test scripts/lib/sync-local-commands-skills.test.ts`.
- 2026-06-08: Centralized tmux test capability detection on a real detached
  session probe instead of `tmux -V`, and added regression coverage for a host
  where the binary exists but session creation fails. Verified with
  `bun test scripts/lib/test-capabilities.test.ts scripts/lib/intuitive-flow-stop-gate.test.ts scripts/lib/skill-runner.test.ts scripts/dev/tmux-watchdog.test.ts`
  and `bun run check`.
- 2026-06-08: Clarified `BELIEFS.md` as supporting doctrine rather than the
  active source for current commands, installed surfaces, or maintenance state.
  Refreshed the skill self-improvement audit to cover the current root-skill
  manifest, including `grill-with-docs-batch`, `intuitive-port-worktree`, and
  `intuitive-preflight`. Verified with targeted doc-tier searches,
  manifest-vs-audit coverage, and `bun run verify`.
- 2026-06-08: Ran a fresh saturation audit from `HEAD`. Verified full local
  proof with `bun run verify` (76 tests across 12 files), checked plan statuses,
  confirmed root skill manifest coverage in the self-improvement audit, checked
  `BELIEFS.md` tier wording, and reviewed noisy stale/legacy/skip search hits.
  No remaining observation passed the materiality contract, so the loop is
  closed with `Selected candidates: none`.
- 2026-06-08: Reopened the loop from current `HEAD` after a new
  `intuitive-planning-loop` root skill appeared in the manifest and README.
  Selected public skill surface drift as P1 live source drift and real workflow
  friction. Aligned `ARCHITECTURE.md`, `STATUS.md`, the reduce-entropy public
  entry model, the manifest-wide skill audit, and the public-skill addition
  checklist around the new primary planning entrypoint.
- 2026-06-08: Selected fuzzy idea routing drift as P1 live source drift after
  the post-commit skill-surface audit found `office-hours` and `grill-me`
  references unsupported by the default installed surfaces. Reworded README and
  `$intuitive-flow` planning references to route through inline flow shaping,
  `$intuitive-planning-loop`, and `grill-with-docs` semantics instead.
  Verified no repo-owned `office-hours` / `grill-me` references remain and
  `bun run verify` passes.
- 2026-06-08: Reopened the loop from current `HEAD` after `BELIEFS.md` still
  pointed big-question doctrine at `office-hours` and `grill-me`, while the
  current public surface exposes `$intuitive-flow` and
  `$intuitive-planning-loop`. The deterministic materiality gate accepted the
  candidate as P1 live source drift and real workflow friction. Reworded
  `BELIEFS.md` to route ordinary idea shaping through `intuitive-flow` and
  scout-driven option critique through `intuitive-planning-loop`.
- 2026-06-08: Selected legacy MiMoCode wrapper pruning as P1 stale surface and
  false confidence after the skill-surface audit proved `legacy-skill`
  artifacts were removed from skill install roots but not from the generated
  MiMoCode command wrapper path. Extended `pruneLegacyArtifacts` so
  `legacy-skill <name>` also removes
  `~/.config/mimocode/command/<name>.md`, updated the self-test and
  architecture contract, and verified with
  `bun test scripts/lib/local-skill-manifest.test.ts scripts/lib/sync-local-commands-skills.test.ts`
  plus the manifest helper self-test.
- 2026-06-08: Selected the completed self-improvement audit correction as P2
  recurring rediscovery and false confidence after `rg` showed the
  `Skill Self-Improvement Rule` block existed only in the audit text, not in
  repo-owned runtime skills. Reworded the human audit so the correction is a
  completed baseline result rather than an outstanding action item.
- 2026-06-08: Selected optional architecture scanner routing as P2 workflow
  friction after README and architecture described `improve-codebase-architecture`
  as external/installed-when-available while reduce-entropy prompt and routing
  text omitted that install boundary. Reworded reduce-entropy docs and skill
  routing to say host-installed optional scanner.
- 2026-06-08: Selected reduce-entropy loop severity metadata drift as P2 live
  source drift after the gate frontmatter listed only P1 even though the target
  and selected candidates included materially useful P2 work. Added P2 to the
  accepted severities.
- 2026-06-08: Selected `STATUS.md` last-reviewed drift as P2 live source drift
  after `git log -- STATUS.md` showed a 2026-06-08 public-surface update while
  the file still said it was last reviewed on 2026-06-06. Updated the date.
- 2026-06-08: Reopened the loop from current worktree after a new
  `multica-goal-tracker` root skill appeared in the manifest. The deterministic
  materiality gate accepted the behavior-proof candidate as P1 false confidence
  and real workflow friction. Added the skill-local tracker harness to normal
  `bun run test` discovery, fixed the default `finish` path to reuse the latest
  tracked start comment when the issue description has no goal, made run/comment
  selection timestamp-aware when Multica returns timestamps, escaped code fences
  in finish excerpts, and covered Codex JSONL plus skill-runner artifact
  evidence inputs. Verified with
  `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts` and
  `bun run verify` (76 tests across 12 files).
- 2026-06-08: Selected ShellCheck proof boundary as P1 false confidence after
  `bun run verify` passed but
  `shellcheck scripts/**/*.sh .githooks/pre-commit` failed with SC2261 in
  `scripts/lib/npm-registry.sh` and `scripts/lib/task-runner.sh`. Fixed the
  competing notice redirections, added `bun run check:shell` with
  `--severity=error`, wired it into `bun run verify`, and updated the human
  command/proof docs. Verified with `bun run check:shell` and `bun run verify`.
- 2026-06-08: Selected Codex hook ownership drift as P1 live source drift and
  workflow friction after `tmux-richer.sh` overwrote `~/.codex/hooks.json`
  while Agent Deck also installs Codex notify hooks into that surface. Added
  `scripts/lib/ensure-codex-hooks.ts` with preservation/idempotence tests,
  changed `tmux-richer.sh` to merge tmux-agent-status hooks instead of writing
  a heredoc, and documented the merged hook ownership contract. Verified with
  `bun test scripts/lib/ensure-codex-hooks.test.ts`, `bun run check:shell`, and
  `bun run verify`.
- 2026-06-08: Selected CI ShellCheck provisioning as P1 false confidence after
  the clean-worktree audit showed `.github/workflows/verify.yml` still ran
  `bun run verify` without explicitly installing ShellCheck. Added an
  `apt-get install shellcheck` workflow step and verified the local full proof
  remains green with `bun run verify`.
- 2026-06-08: Reopened the loop from current `HEAD` after read-only
  verification and skill-surface audits. Selected the documented skill-runner
  summarizer proof gap as P1 false confidence and real workflow friction. The
  deterministic materiality gate accepted the candidate with one eligible
  group. Added a default `bun run test` smoke that executes
  `summarize_skill_runner_runs.py --run-root <temp> --json` against minimal run
  artifacts and asserts status, worker mismatch, skill review, skills, and
  owned paths. Verified with `bun test scripts/lib/skill-runner.test.ts` and
  `bun run verify` (80 tests across 13 files).
- 2026-06-08: Selected the legacy `.claude/skills/*` sync branch as P2 stale
  surface and false confidence after the skill-surface audit showed the current
  repo has no `.claude/skills` source while `check:skills` only validates
  `skills/*` and the manifest. The deterministic materiality gate accepted the
  candidate with one eligible group. Removed the legacy direct sync branch and
  added a regression test proving `.claude/skills/*` entries in a fixture are
  ignored while manifest-owned root skills still sync. Verified with
  `bun test scripts/lib/sync-local-commands-skills.test.ts`.
- 2026-06-08: Selected the CI tmux proof dependency as P2 false confidence
  after the verification audit showed GitHub Actions installed Bun and
  ShellCheck but not `tmux`, while `bun run test` includes multiple
  `skipIf(!hasTmux)` behavior tests. The deterministic materiality gate
  accepted the candidate with one eligible group. Added `tmux` to the CI system
  tool install step so CI proof strength does not depend on the base image.
- 2026-06-08: Selected `BELIEFS.md` human-surface wording as P2 live source
  drift and recurring rediscovery after the doc audit showed the doctrine file
  listed layout/tests/harnesses as human surface entries while README,
  architecture, status, and the human-doc index define the authoritative
  surface as the four doc roots. The deterministic materiality gate accepted
  the candidate with one eligible group. Reworded `BELIEFS.md` so layout
  choices, tests, and harness quality remain human-owned responsibilities
  without becoming extra source-of-truth surfaces.
- 2026-06-08: Selected the skill-local test glob as P1 false confidence after
  `printf '<%s>\n' scripts/**/*.test.ts skills/**/*.test.ts` showed Bash left
  `skills/**/*.test.ts` as a literal argument and `bun run test` omitted
  `skills/multica-goal-tracker/scripts/track_goal.test.ts`. The deterministic
  materiality gate accepted the candidate with one eligible group. Changed the
  default test command to `bun test ./scripts ./skills`, which lets Bun
  recursively discover tests under repo-owned script and skill directories
  without entering `vendor/**`.
- 2026-06-08: Selected the Multica finish evidence completeness slice as P1
  workflow friction and false confidence after the current dirty worktree showed
  the tracker could attach a rendered card without making it inline-visible and
  could summarize completion without preserving the exact selected session
  output in the issue timeline. The deterministic materiality gate accepted the
  candidate with one eligible group. Updated generated tracker text to Chinese,
  added inline image child comments when Multica returns an attachment URL, kept
  raw completion output in a separate Markdown code-block child comment,
  tightened card layout, and covered the behavior in the skill-local tracker
  tests.
- 2026-06-08: Selected the Codex JSONL goal-timing evidence slice as P1 false
  confidence after manual review of the dirty tracker diff showed completion
  evidence could select a later completion-shaped turn after the goal had
  already completed, especially when the goal's own final message was not
  template-shaped. Preserved the completed goal turn first, extracted Codex goal
  start/end/duration metadata, rendered the timing in the evidence card and
  finish/raw-output comments, and covered template-shaped and non-template
  completion turns in `track_goal.test.ts`.
- 2026-06-08: Reopened the loop from current `HEAD` for a saturation audit with
  read-only doc, skill-routing, and verification subagents. Selected the GStack
  plan-engineering review surface as P2 live source drift and real workflow
  friction after the routing audit showed `$intuitive-reduce-entropy` and
  `$intuitive-refactor` route architecture-shaped work through
  `$plan-eng-review` / `$gstack-plan-eng-review`, while
  `GSTACK_SKILL_SURFACE=standard` pruned those managed GStack wrappers.
  Extended the default managed GStack surface to keep both Codex and Claude
  plan-engineering review wrappers, updated the pruning regression test, and
  documented the standard surface in `ARCHITECTURE.md`. Verified with
  `bun test scripts/lib/managed-skill-state.test.ts`, `bun run check:skills`,
  and `bun run check`.
- 2026-06-08: Selected CI/local Bun runtime drift as P2 false confidence after
  the verification audit showed `.github/workflows/verify.yml` pinned
  `bun-version: 1.3.6` while the local runtime was `1.3.12` and `bun.lock`
  resolved `@types/bun@1.3.13`. Added `packageManager: bun@1.3.12` as the repo
  toolchain source, updated the GitHub Actions setup pin to `1.3.12`, extended
  `bun run check:skills` to fail on CI/local Bun pin drift or a missing repo
  pin, and updated the human proof-boundary docs. Verified with
  `bun test scripts/lib/check-skills.test.ts`, `bun run check:skills`,
  `bun run check`, and `bun run verify`.
- 2026-06-08: Selected Multica Codex goal matching as P1 false confidence after
  the dirty-worktree audit showed a session with multiple completed goals could
  choose the latest follow-up goal instead of the issue's tracked `/goal`.
  Passed the tracked goal into Codex JSONL session evidence extraction, matched
  completed goals by objective tokens before falling back to latest completion,
  and ensured fallback output does not inherit unrelated matched-goal timing.
  Documented the behavior in the skill and verified with
  `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts`,
  `bun run check:skills`, `bun run check`, and `bun run verify`.
- 2026-06-08: Selected Multica attempt timeline preservation as P1 workflow
  friction and false confidence after the dirty-worktree audit showed repeated
  goal attempts on the same issue could be flattened into standalone finish
  comments, and incomplete attempts could be labelled like completion evidence.
  Added structured hidden attempt metadata, cumulative timeline rendering,
  `--attempt-status` documentation, non-complete execution-record labels, and a
  max-sequence next attempt rule. Verified with
  `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts`,
  `bun run check:skills`, `bun run check`, and `bun run verify`.
- 2026-06-08: Selected Multica attempt metadata encoding as P1 false confidence
  after a saturation audit showed the new hidden attempt JSON lived inside an
  HTML comment delimiter. Encoded attempt metadata as `v1:` base64, retained
  legacy raw-JSON parsing, and added regression coverage for `-->` in real
  goal/session text. Verified with
  `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts`,
  `bun run check`, and `bun run verify`.
- 2026-06-08: Selected portable Multica tracker command examples as P1 workflow
  friction after the docs/skills audit showed installed skill examples
  hard-coded `/home/mi/ws/intuitive-flow`, conflicting with the documented clone
  path and any non-local checkout. Replaced examples with checkout-root-relative
  `bun skills/.../track_goal.ts` commands and added a skill-check regression
  against the leaked machine-local path. Verified with
  `bun test scripts/lib/check-skills.test.ts`, `bun run check:skills`, and
  `bun run check`.
- 2026-06-08: Selected Multica terminal-attempt semantics as P1 false
  confidence after the tracker audit showed non-complete attempts could still
  be presented as completion output and blocked/failed Codex goal timing was
  dropped. Extended Codex JSONL timing extraction to terminal statuses,
  switched non-complete comments and raw-output child comments to execution
  wording, and updated the skill docs. Verified with
  `bun test skills/multica-goal-tracker/scripts/track_goal.test.ts`,
  `bun run check:skills`, and `bun run check`.
