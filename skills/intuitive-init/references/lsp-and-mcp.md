# LSP And MCP Setup

Use this reference when `$intuitive-init` is applying, refreshing, or auditing
target-repo language-server setup, Serena, or another agent-facing MCP symbol
surface.

## Target-Repo LSP Setup

Set up language server support as part of repo harness initialization, not as a
separate optional cleanup. Agents refactor and navigate more safely when
definition, reference, rename, diagnostics, and hover signals work for the
project's real language stack.

Default action in Apply, Refresh, and Symlink Migration modes: detect the
target repo's primary languages and configure a two-layer LSP setup
automatically when the setup is recognized, repo-local, and safe to apply:

1. A repo-local language-server config that makes the underlying language
   server accurate for editors, CI, and MCP servers.
2. An agent-facing MCP LSP surface, preferably Serena, so Claude/Codex can use
   symbol search, references, rename, outline, hover, and diagnostics directly.

Do not treat a working Pyright, TypeScript, Rust, Go, or other repo-local
language-server config as complete agent-facing LSP setup by itself. It is the
foundation that makes Serena accurate, not a substitute for MCP symbol tools.

Use repo evidence before choosing an LSP path:

- JavaScript/TypeScript: `package.json`, lockfiles, `tsconfig*.json`, framework
  config, existing `typescript` or language-server dev dependencies.
- Python: `pyproject.toml`, `uv.lock`, `.python-version`, `.venv`, `pyright` or
  `basedpyright` config, and the repo's `uv` conventions.
- Rust, Go, Java, Ruby, PHP, C/C++, and other stacks: their canonical manifests,
  lockfiles, toolchain files, and existing editor or agent config.
- Existing agent/editor surfaces: `.claude/settings.json`, `.mcp.json`,
  `.vscode/settings.json`, `docs/agents/**`, setup scripts, CI checks, any
  checked-in language-server config, and any MCP-based LSP entries already
  wired into the host CLI, such as a `serena` entry in `.mcp.json`,
  `~/.claude.json` MCP servers, `~/.codex/config.toml` `[mcp_servers.*]`
  blocks, or a `.serena/` project directory.

Prefer checked-in repo-local setup over relying on a global tool that only one
machine has. Good underlying language-server setup usually means one or more of:

- the language server or required compiler package is declared as a dev
  dependency in the repo's normal package manager
- the project has the config file the server needs to find source roots,
  virtualenvs, workspaces, generated types, or strictness settings
- the setup command is included in the repo's install/bootstrap path
- agent guidance points to the setup only as a short command, not a long manual

For Python repos, prefer `uv` and the project's `.venv` conventions. Do not add
Python dependencies through the system interpreter.

### TypeScript Recipe

When `package.json` and TypeScript source/config are present, use this order:

1. Detect the package manager from the lockfile (`bun.lockb`/`bun.lock`,
   `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`).
2. Verify `typescript` is available from the repo's declared dev dependencies
   or bootstrap toolchain. Keep `tsconfig*.json` as the source of truth for
   `rootDir`, `baseUrl`, `paths`, project references, and generated type roots.
3. For an agent-facing server, verify `typescript-language-server` is available
   through the same repo/toolchain path (or that the existing team toolchain
   provides it). Do not silently install a global copy. A repo may use the
   TypeScript compiler's `tsserver` through its editor integration, but Serena
   still needs a supported TypeScript language-server entry.
4. Validate with the package manager's equivalent of `tsc --noEmit` (or the
   repo's typecheck script), and record the exact script when one exists.

Do not create a new `tsconfig.json` in a framework or monorepo project when an
existing config or generated config is authoritative. If TypeScript is detected
but no local compiler/config or approved bootstrap path exists, report the
missing setup and proposed command instead of changing package metadata.

### Rust Recipe

When `Cargo.toml` or `Cargo.lock` is present, use this order:

1. Verify the workspace members and target configuration from `Cargo.toml`,
   `.cargo/config.toml`, and any `rust-toolchain.toml`/`rust-toolchain` file.
2. Verify `rust-analyzer` is available from the repo's declared toolchain or
   approved development environment. Prefer the toolchain manager's pinned
   version; do not add a second global installation or rewrite toolchain files.
3. Preserve existing workspace/source-root and generated-code settings. If a
   checked-in `.vscode/settings.json` or rust-analyzer config already supplies
   them, verify it rather than creating a competing config.
4. Validate with `cargo check --workspace` (or the repo's documented narrower
   check) and report failures before declaring the underlying LSP path ready.

If Rust is detected but `rust-analyzer`, the Rust toolchain, or a workspace
configuration cannot be resolved without a heavy or unapproved install, stop
with the exact missing prerequisite and command. Once the underlying server is
valid, pair it with Serena MCP for agent-facing symbol operations.

If the project already gets underlying language-server setup through a team
updater, plugin, devcontainer, Nix shell, or toolchain manager, verify that path
and record it instead of adding a competing local setup. Still evaluate whether
the coding agent itself has Serena or an equivalent MCP symbol surface; editor
LSP alone does not satisfy that requirement.

Stop and report instead of editing when LSP setup would require a paid service,
local-only hardware, broad package-manager migration, heavy toolchain install,
or uncertain global state. In that case, add the missing setup to the proposal
or `docs/agents/**` runbook with the exact command the user should approve.

## MCP-Based LSP Path

Serena MCP is the preferred default for agent-facing LSP setup. A repo-local
language-server config is still required, especially for Python virtualenvs and
monorepo source roots, but it should normally be paired with Serena so
symbol-level operations reach the coding agent itself, not just the editor or
CI. The current reference implementation is
[Serena](https://github.com/oraios/serena): one MCP server that exposes symbol
search, references, rename, document outline, hover, and diagnostics across
Python, TypeScript, Rust, Go, and other stacks through their existing language
servers.

In Apply and Refresh modes, after verifying or creating the repo-local
language-server config, set up Serena MCP or explicitly propose the exact Serena
setup path unless one of the stop conditions applies.

Prefer Serena MCP by default, and especially when one or more of these is true:

- the repo spans several languages and a single agent-facing surface is cheaper
  than wiring one LSP plugin per language
- the team uses both Claude Code and Codex and wants the same symbol tooling in
  both, since Serena ships a Codex-specific `--context codex` mode
- the host CLI's native LSP plugin path is unavailable, broken, or noisier than
  a checked-in MCP entry
- the agent needs symbol-level operations during long-running edits where text
  search alone causes regressions

Use a repo-local language-server-only path only when:

- the project already has a working Serena or equivalent MCP symbol server
- the host CLI cannot use MCP servers in the current environment
- the Serena install or activation path is uncertain after checking current
  upstream docs
- adding or activating Serena would require global secrets, a paid service,
  local-only hardware, broad toolchain migration, or user approval that has not
  been granted

The two paths can coexist: a checked-in language-server config keeps the editor
and CI honest, while an MCP entry gives the agent symbol tools during its own
runs.

Operational guidance for the MCP path, intentionally minimal so the agent
checks current upstream docs before editing config:

- Treat the upstream README and recent release notes as the source of truth for
  install, transport, and per-host context flags. Do not paste old commands from
  memory.
- Add the MCP server through the host CLI's native command when one exists, such
  as `claude mcp add` or `codex mcp add`, or through a checked-in `.mcp.json` /
  `~/.codex/config.toml` block. Pin the install method the upstream README
  currently recommends.
- Activate the server for the current repo and confirm the agent can see its
  tools before declaring setup done. Record the activation step in
  `docs/agents/**` or root guidance only when the host does not auto-activate
  on session start.
- For Python repos, still keep a `pyrightconfig.json` or `[tool.pyright]` block
  with `venvPath` and `venv` set. MCP-based LSP servers reuse the underlying
  language server, so missing project config still produces false
  `reportMissingImports` diagnostics.
- Stop and report instead of editing when the MCP install would require global
  secrets, paid services, or an install path the user has not approved.
