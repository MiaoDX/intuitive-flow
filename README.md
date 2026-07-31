# intuitive-flow

**An opinionated operating model for agent-written software.**

`intuitive-flow` is a portable workflow kit for Claude Code and Codex. It keeps
the human surface small, puts reusable workflows in skills, and gives each repo
local `CLAUDE.md` / `AGENTS.md` guidance instead of a copied process manual.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Shell](https://img.shields.io/badge/Shell-toolkit-4EAA25.svg)](scripts/)
[![Claude Code](https://img.shields.io/badge/Claude_Code-ready-111827.svg)](CLAUDE.md)
[![Codex](https://img.shields.io/badge/Codex-ready-111827.svg)](AGENTS.md)

<p align="center">
  <img src="docs/assets/hero.png" alt="Human-readable docs guiding AI coding workflows" width="900">
</p>

## Why This Exists

AI agents write all my code, so the repo needs two surfaces.

The human surface should **stay tiny**: `README.md`, `ARCHITECTURE.md`,
`STATUS.md`, and `docs/human/**`. This is where I decide what the project is,
what good means, and what must not break.

Everything else is agent territory: source code, plans, logs, generated
evidence, retrospectives, scratch work, and low-level churn. Humans can inspect
it when something is risky or broken. They should not have to live there.

`intuitive-flow` exists to make the counter-pressure explicit. AI coding changes
the default shape of a repo: agents are good at adding code, tests, plans, logs,
and helper surfaces, but they are less likely to stop and ask whether the repo
became easier to understand.

The first job is **maintenance through entropy reduction**. A repo needs regular
passes that remove stale surfaces, merge duplicate guidance, clean known seams,
realign docs with code, and make the next human or agent less surprised.

The second job is **deliberate feature development**. New work should not jump
straight from idea to implementation when the scope is fuzzy. It should become a
plan, get challenged against the repo's language and boundaries, turn into an
execution contract, and only then be implemented and verified.

See [BELIEFS.md](BELIEFS.md) for the doctrine behind this workflow.

The operating bias is deliberately small:

- Less is more.
- Codex, Claude Code, similar harnesses, and models will keep evolving; refresh
  skills against them.
- Prefer community best practices when they survive local review.

## Choose A Path

Start by choosing the kind of work:

| Work | Route |
| --- | --- |
| Maintain or simplify a repo | `$intuitive-reduce-entropy` in repo entropy mode, then route selected cleanup to the owning skill and verify it |
| Build a feature with unresolved scope or risk | `$intuitive-preflight`, using plan entropy, planning scouts, or grill-batch only when the contract needs them, then `$intuitive-flow` |
| Align multiple planning perspectives | `$agent-planning-loop` -> `$intuitive-preflight` -> `$intuitive-flow` |
| Do a tiny bounded task | `$intuitive-flow` directly, when the change is local and easy to verify |

The rule of thumb is simple: reduce repo entropy when the codebase itself is
getting harder to work in; use a planning path when the next feature is still
unclear; use direct flow only when the task is already bounded.

<p align="center">
  <img src="docs/assets/workflow.svg" alt="Intuitive Flow routes repo entropy reduction and feature development through planning, preflight, execution, and verification" width="820">
</p>

## Selected Skill Sources

The managed portfolio is explicit, not a broad import. This repo assigns
default, routed, on-demand, and host-specific policy to individual skills in
[`scripts/default-skill-allowlist.txt`](scripts/default-skill-allowlist.txt)
and leaves the rest upstream until real use justifies promotion. Default and
routed entries install normally; on-demand entries remain registered without
occupying the normal discovery surface.

| Source | Stars | Selected | Skills used |
| --- | --- | --- | --- |
| [`anthropics/skills`](https://github.com/anthropics/skills) | [![GitHub stars](https://img.shields.io/github/stars/anthropics/skills?style=social)](https://github.com/anthropics/skills) | 1/18 | `skill-creator` |
| [`skills-directory/skill-codex`](https://github.com/skills-directory/skill-codex) | [![GitHub stars](https://img.shields.io/github/stars/skills-directory/skill-codex?style=social)](https://github.com/skills-directory/skill-codex) | 1/1 | `codex` |
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | [![GitHub stars](https://img.shields.io/github/stars/mattpocock/skills?style=social)](https://github.com/mattpocock/skills) | 7/41 | `codebase-design`, `domain-modeling`, `grill-with-docs`, `grilling`, `handoff`, `improve-codebase-architecture`, `tdd` |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | [![GitHub stars](https://img.shields.io/github/stars/DietrichGebert/ponytail?style=social)](https://github.com/DietrichGebert/ponytail) | 5/6 | `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-help`, `ponytail-review` |
| [`garrytan/gstack`](https://github.com/garrytan/gstack) | [![GitHub stars](https://img.shields.io/github/stars/garrytan/gstack?style=social)](https://github.com/garrytan/gstack) | 7/55 | `gstack-autoplan`, `gstack-browse`, `gstack-investigate`, `gstack-open-gstack-browser`, `gstack-plan-eng-review`, `gstack-qa`, `gstack-review` |
| [`open-gsd/gsd-core`](https://github.com/open-gsd/gsd-core) | [![GitHub stars](https://img.shields.io/github/stars/open-gsd/gsd-core?style=social)](https://github.com/open-gsd/gsd-core) | 3/69 | `gsd-pause-work`, `gsd-progress`, `gsd-resume-work` |

Ratios are a current snapshot from the allowlist and upstream skill discovery.

## Optional Tool Install

Clone Intuitive Flow when you want the update scripts and local skill sync:

```bash
git clone --depth=1 <repo-url> ~/intuitive-flow
~/intuitive-flow/scripts/update.sh
```

Install a registered on-demand skill for one update run by naming it explicitly:

```bash
INTUITIVE_FLOW_ON_DEMAND_SKILLS=plan-bakeoff ~/intuitive-flow/scripts/update.sh
```

A later default update removes Intuitive-owned on-demand installs that are no
longer selected. Host-specific external entries install only for their declared
agent host.

For local development in this checkout:

```bash
bun install
bun run setup:hooks
bun run verify
```

## Current Map

- [ARCHITECTURE.md](ARCHITECTURE.md): subsystem contracts, extension points, and proof boundaries
- [STATUS.md](STATUS.md): current state, supported commands, and maintenance focus
- [docs/human/](docs/human/): human-facing detail that should not bloat the root docs
- [Reduce repo entropy](docs/human/reduce-repo-entropy.md): copy/paste prompts for repo maintenance and plan entropy work
- [BELIEFS.md](BELIEFS.md): supporting doctrine behind the workflow

Generated diagrams, vendored tools, planning scratchpads, and implementation
evidence are context, not current truth unless a human doc promotes them.

## Contributing

PRs are welcome from humans and AI agents. The most useful contributions are
sharper shared rules and fixes to workflows that drift as the underlying CLIs
evolve.

## License

MIT - see [LICENSE](LICENSE).
