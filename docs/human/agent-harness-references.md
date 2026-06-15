# Agent Harness References

Last reviewed: 2026-06-06

This page is the human-facing source for external references that shape
Intuitive Flow's agent harness: root instructions, layered local guidance,
skills, hooks, plugins, MCP, subagents, verification, and maintenance cadence.

Use it when updating `AGENTS.md`, `CLAUDE.md`, `skills/**`, `docs/agents/**`,
hooks, MCP config, or repo automation. Add new links here before spreading
their lessons into skills. Skills should carry the smallest operational rule;
this page should preserve the source and rationale.

## Working Principles

- Harness quality matters as much as model choice. Treat instructions, skills,
  hooks, MCP, LSP, plugins, and subagents as one designed system.
- Keep always-loaded files lean and layered. Root guidance should give the map,
  critical hazards, and routing rules; local files and skills carry detail.
- Put deterministic checks in tools. Use scripts, tests, CI, hooks, and MCP
  tools for repeatable enforcement instead of asking agents to remember lint,
  format, or generated-output rules.
- Use skills for on-demand expertise. Repeated task workflows belong in skills
  so they do not bloat every session.
- Keep skill activation precise. Put the concrete trigger in the first sentence
  of `description`, add compact `when_to_use` examples only when they improve
  selection, and avoid broad descriptions that make every task look relevant.
- Treat `SKILL.md` as the entrypoint, not the whole manual. Store long
  references, examples, templates, and deterministic scripts beside it and have
  the skill load them only when needed.
- Separate source layout from install/discovery layout. In this repo,
  `skills/` remains the canonical source; sync scripts fan those skills out to
  Claude Code, Codex, and shared agent install surfaces.
- Treat third-party skills as supply-chain inputs. Make external sources and
  default allowlists explicit before syncing them into user-level agent tooling;
  do not default to broad upstream `all` installs.
- Package shared multi-component capabilities as plugins. A standalone skill is
  enough for one reusable workflow; use a plugin when distributing skills
  together with subagents, hooks, MCP servers, binaries, settings, or other
  agent capabilities.
- Make improvement explicit. When a source changes how the harness should work,
  update this page, then update shared skill fragments or targeted skills.
- Review the harness on a cadence. Do a meaningful review after major
  model/tool releases and at least every three to six months.

## Skill Self-Improvement Lens

Use this as a maintainer review lens, not as text to paste into every skill's
runtime instructions. Runtime skill text should help the agent perform the
current task. Meta-guidance about maintaining the skill belongs here, in a
planning gate, or in a targeted skill-maintenance run.

When reviewing a skill, preserve a compact WHY / WHAT / HOW contract:

- WHY: the user problem, failure mode, or workflow drift the skill prevents.
- WHAT: the repo surfaces, artifacts, and decisions the skill owns, plus nearby
  surfaces it deliberately does not own.
- HOW: the default workflow, decision gates, evidence ladder, stop condition,
  and handoff artifact that let a future agent improve the skill safely.

Route new guidance to the smallest effective harness layer:

- shared rule across repo-owned skills -> the shortest duplicated invariant in
  each relevant `SKILL.md`, or an on-demand `references/` file when the detail
  does not need to be always loaded
- durable source or doctrine lesson -> this reference page
- repo-specific operational runbook -> `docs/agents/**`
- deterministic enforcement -> scripts, tests, CI, hooks, or MCP tools
- reusable task workflow -> a skill, not a root agent file

Do not add task-specific preferences, product-specific style rules, or one-off
agent mistakes as permanent skill policy. Prefer deleting, shortening, or moving
instructions before adding new runtime rules.

## Current Skill Authoring Baseline

Use this baseline when creating or revising repo-owned skills:

- `description` is the main selection surface. Start with the task, trigger, or
  user phrase that should activate the skill; keep prose tight enough to fit
  listing budgets.
- Use `when_to_use` only for extra trigger examples or boundary cases. Do not
  duplicate the description.
- Use `disable-model-invocation: true` for side-effecting, deployment,
  publishing, commit, messaging, or timing-sensitive workflows that should run
  only after explicit user invocation.
- Use path or scope gates where supported to keep automatic activation local to
  relevant files or packages.
- Keep `SKILL.md` short and progressive: route, invariants, key steps, stop
  condition, and pointers to supporting files. Long source material belongs in
  `references/`; reusable output shapes in `templates/`; deterministic
  operations in `scripts/`.
- Prefer scripts for repeatable transformations, validation, and data gathering.
  Skill instructions should explain when and why to run the script, not
  reimplement the script in prose.
- Use isolated subagent or forked context for research-heavy, log-heavy, or
  parallel verification skills only when the host supports it reliably and the
  task has a clear standalone output. For Codex, follow
  `skills/skill-runner/references/codex-delegation.md`: prefer main-session
  probes, Paseo subagents when the host-provided subagent tool is available and probed, or
  tmux/`skill-runner` workers, and keep native subagents disabled until local
  revalidation proves the installed release is stable.
- Treat tool preapproval as a convenience, not a security boundary.
  `allowed-tools` can reduce prompts while a skill is active; blocking sensitive
  actions still needs deny rules, hooks, sandboxing, or explicit review gates.
- Keep side-effect and supply-chain trust visible. Third-party skills,
  plugin-provided scripts, dynamic shell injection, MCP servers, and hook logic
  should be reviewed before syncing into user-level surfaces.
- Do not copy broad official best practices into runtime skills. Distill them
  into the smallest local invariant, or keep them here as rationale.

## Official References

| Source | What It Teaches This Repo |
| --- | --- |
| [How Claude Code works in large codebases](https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start) | Treat the harness as the performance layer: `CLAUDE.md`, hooks, skills, plugins, MCP, LSP, and subagents each have different jobs. Keep context layered, scope commands by subdirectory, use hooks for deterministic checks and fresh learnings, and assign ownership for ongoing harness maintenance. |
| [Claude Code best practices](https://code.claude.com/docs/en/best-practices) | Use `/init` as a starting point, keep `CLAUDE.md` useful for project memory, and prefer workflows that let Claude inspect the live codebase instead of relying on stale summaries. |
| [Claude Code memory docs](https://code.claude.com/docs/en/memory) | `CLAUDE.md` files are loaded as project memory. Root and nested memory should be scoped so broad guidance stays broad and local conventions stay local. |
| [Claude Code docs map](https://code.claude.com/docs/en/claude_code_docs_map) | Use the docs map as the canonical starting point when checking whether Claude Code feature guidance has moved or expanded. |
| [Claude Code skills](https://code.claude.com/docs/en/skills) | Skills are the on-demand workflow layer. Custom commands now share the skills path, `description` and optional `when_to_use` drive selection, side-effecting workflows can disable model invocation, supporting files carry long detail, and `context: fork` is available for isolated task skills. Treat bundled `/run` and `/verify` as app-level validation candidates, not replacements for repo proof commands. |
| [Anthropic: Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) | Agent Skills are folder-based capabilities with instructions, scripts, and resources that load only when relevant. The Dec. 18, 2025 update introduced the open standard and organization-wide management, reinforcing this repo's progressive-disclosure and supply-chain review model. |
| [Claude Code goals](https://code.claude.com/docs/en/goal) | Goal mode can keep a long session pointed at measurable completion criteria, but the repo still needs explicit source-of-truth gates and deterministic verification. For `intuitive-flow`, use goals on bounded worker sub-phases rather than the main supervision session. |
| [Claude Code hooks](https://code.claude.com/docs/en/hooks) | Lifecycle automation belongs in hooks when it is deterministic and repeatable, especially formatting, generated-output checks, notification, and policy gates. |
| [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) | Use subagents for context-isolated work with clear ownership and handoff expectations; do not let agent fanout replace the main session's source-of-truth decisions. |
| [Claude Code plugins](https://code.claude.com/docs/en/plugins) | Plugins are the distribution layer for skills, subagents, hooks, MCP servers, commands, binaries, and limited settings. Shared plugin adoption should be handled as harness packaging with trust review, not copied into runtime skill text. |
| [Claude Help: CLAUDE.md and better prompts](https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts) | Project memory should brief a capable new teammate: what matters, what to avoid, where important pieces live, and how to start safely. |
| [Claude blog: using CLAUDE.md files](https://claude.com/blog/using-claude-md-files) | Keep project guidance practical and repo-specific; let it capture conventions, repeated commands, and project context that should survive across sessions. |
| [Codex best practices](https://developers.openai.com/codex/learn/best-practices) | Treat Codex as a coding agent that needs clear environment setup, precise task framing, and verification commands tied to the repo. |
| [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) | `AGENTS.md` is Codex's project instruction surface. Keep it local, operational, and aligned with actual repo commands and constraints. |
| [Codex advanced configuration](https://developers.openai.com/codex/config-advanced) | Advanced config such as project root markers and doc byte limits affects how Codex discovers and loads project guidance; repo harness design should account for those knobs. |
| [Codex skills](https://developers.openai.com/codex/skills) | Skills are reusable workflow packages for Codex. Their descriptions control discovery within a limited listing budget, so trigger text should be specific and concise; keep large references outside the entrypoint and use scripts for deterministic mechanics. |
| [Codex plugins](https://developers.openai.com/codex/plugins) | Plugins package reusable agent capabilities beyond a single workflow. Prefer explicit source manifests, validation, and trust review before syncing plugin or skill sources into local user-level tooling. |
| [Codex hooks](https://developers.openai.com/codex/hooks) | Hooks provide deterministic automation around agent lifecycle events; use them for repeatable checks rather than relying on prompt memory. |
| [Codex subagents](https://developers.openai.com/codex/subagents) | Treat Codex native subagents as an unstable surface in this harness until local revalidation proves spawn, completion, parent result delivery, clean exit, file ownership, sandboxing, and model behavior. Use `skills/skill-runner/references/codex-delegation.md`: prefer host-provided Paseo subagents for parallel short/read-heavy Codex delegation when available and probed, and tmux/`skill-runner` workers for fallback, durable, stateful, mutating, or artifact-sensitive work. Skills must not call `paseo run` or `paseo agent run` directly because those commands create separate user-visible sessions/tabs. |
| [Codex changelog](https://developers.openai.com/codex/changelog) | Re-check release notes after major CLI changes. Goal mode and skill/plugin behavior can shift normal workflow boundaries and should be tested before becoming default runtime rules. When goal mode is used in Codex, keep it worker-local unless a direct main-session task is tiny. |
| [AGENTS.md open format](https://agents.md/) | `AGENTS.md` is a cross-agent convention supported by multiple coding tools. Prefer it for shared repo rules, with tool-specific deltas kept in tool-specific files. |

## Community And Field Reports

| Source | What It Teaches This Repo |
| --- | --- |
| [HumanLayer: Writing a good CLAUDE.md](https://www.hlyr.dev/blog/writing-a-good-claude-md) | The WHY / WHAT / HOW shape is a useful review lens: explain project purpose, repo shape, and how to build/test/change safely. Keep root guidance short enough to remain useful. |
| [HumanLayer: Skill Issue, harness engineering for coding agents](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents) | Skills should be evaluated as part of the harness, not treated as static prompts. Prefer narrow, tested workflows over broad instruction dumps. |
| [Vercel agent skills](https://github.com/vercel-labs/agent-skills) and [skills CLI](https://github.com/vercel-labs/skills) | High-signal community practice favors narrow, reusable skills with supporting files and toolable installation. This is useful as a pattern source, but individual skills still need local validation before adoption. |
| [Claude Code issue #11450: Prompt Review Agent](https://github.com/anthropics/claude-code/issues/11450) | Preflight prompt review should happen before executor context is polluted. `$intuitive-preflight` carries this lesson by making missing context, clarifying questions, and the approval-ready context package explicit before `$intuitive-flow` or `skill-runner` starts implementation. |
| [Serena MCP](https://github.com/oraios/serena) | A language-aware MCP server that exposes symbol-level LSP operations (find/rename symbol, find referencing symbols, document symbols, diagnostics) to coding agents through one connection, covering Python, TypeScript, Rust, Go, and other stacks via underlying language servers. Useful when an agent needs symbol navigation in a repo whose host CLI does not already provide a working LSP path, and when the same setup should work for both Claude Code and Codex (Serena ships a Codex-specific `--context codex` mode). Treat as one option among several; checked-in repo-local language-server config still wins when the project already has one. |
| [CoEvoSkills](https://arxiv.org/abs/2604.01687) | Verifier-guided skill evolution is promising for improving skill quality across Claude Code and Codex, but should enter this repo through fixture-based A/B tests before changing runtime skills. |
| [Under the Hood of SKILL.md](https://arxiv.org/abs/2605.11418) | Skill metadata and natural-language instructions influence discovery, selection, and governance. External skill sources should be explicit, reviewable, and validated before sync. |

## Repo Upgrade Checklist

When this page gains a source that changes repo practice:

1. Add the link and the lesson here first.
2. Decide the right harness layer: root guidance, nested guidance, shared skill
   fragment, targeted skill, hook, script, MCP config, plugin, or human doc.
3. Update `skills/**` only when the lesson changes runtime agent behavior, not
   merely how maintainers should review the skill.
4. For skill changes, keep the repo-owned source under `skills/`, then let the
   sync pipeline project it into Claude Code, Codex, and shared install
   surfaces. Do not change source layout merely because a host exposes another
   discovery path.
5. Keep default skill installs in `scripts/default-skill-allowlist.txt`; use
   `bun run audit:skill-upstreams` to inspect upstream candidates before adding
   anything outside the current list.
6. Run `bun run check:skills` after skill or allowlist edits.
7. Run `bun run verify`.
8. Update `STATUS.md` or `ARCHITECTURE.md` only when the repo's supported
   commands, public contracts, or proof boundaries changed.

## Parked Questions

- Which skill-quality evals should run against fixture repos before a release?
- Which hook patterns are mature enough to install by default instead of only
  recommending in guidance?
- Which skill frontmatter checks should `bun run check:skills` add next:
  description budget parity with host listings, side-effect skill markers,
  path-scope checks, or plugin-readiness checks?
- Should `$intuitive-flow` workers use native goal mode by default after their
  bounded sub-phase prompt, or only when the user explicitly asks for it?
- Should Claude `/run` and `/verify` become recommended app-level validation
  steps in repos where they generate stable project recipes?
- Should CoEvoSkills-style verifier loops become a maintained skill QA workflow
  after fixture-based A/B tests prove better completion quality?
- LSP setup now offers at least two recorded paths: checked-in repo-local
  language-server config (the default) and a Serena MCP connection that exposes
  symbol operations to both Claude Code and Codex. Open question: when should
  `$intuitive-init` prefer one over the other by default, and how should that
  default change as Claude Code's native LSP plugin surface stabilizes?
