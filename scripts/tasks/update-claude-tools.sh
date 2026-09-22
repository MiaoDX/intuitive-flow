#!/bin/bash

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

run_claude_plugins() {
    local out

    task_notice "Claude plugins: registering marketplace"
    out=$(claude plugin marketplace add anthropics/claude-plugins-official 2>&1) || {
        echo "  ! failed to register claude-plugins-official marketplace:"
        echo "$out"
        return 1
    }

    local plugins=(
        pyright-lsp
        claude-md-management
        hookify
        commit-commands
        pr-review-toolkit
        claude-code-setup
        learning-output-style
        feature-dev
        frontend-design
        agent-sdk-dev
    )

    for plugin in "${plugins[@]}"; do
        task_notice "Claude plugins: installing $plugin"
        out=$(claude plugin install "${plugin}@claude-plugins-official" 2>&1) || {
            echo "  ! failed to install ${plugin}:"
            echo "$out"
            return 1
        }
        echo "  ✓ ${plugin}"
    done
}

run_mcp_fetch() {
    local fetch_command=(npx -y mcp-fetch-server@latest)

    if command -v claude >/dev/null 2>&1; then
        task_notice "MCP: fetch: registering Claude server"
        claude mcp remove fetch --scope user >/dev/null 2>&1 || true
        claude mcp add fetch --scope user -- "${fetch_command[@]}" >/dev/null 2>&1 || {
            echo "  ! failed to register fetch MCP with Claude"
            return 1
        }
        claude mcp get fetch >/dev/null 2>&1 || {
            echo "  ! Claude fetch MCP registration did not validate"
            return 1
        }
        echo "  ✓ Claude fetch MCP: npx -y mcp-fetch-server@latest"
    else
        echo "  ! skipped Claude fetch MCP because claude is not installed"
    fi

    if command -v codex >/dev/null 2>&1; then
        task_notice "MCP: fetch: registering Codex server"
        codex mcp remove fetch >/dev/null 2>&1 || true
        codex mcp add fetch -- "${fetch_command[@]}" >/dev/null 2>&1 || {
            echo "  ! failed to register fetch MCP with Codex"
            return 1
        }
        codex mcp get fetch >/dev/null 2>&1 || {
            echo "  ! Codex fetch MCP registration did not validate"
            return 1
        }
        echo "  ✓ Codex fetch MCP: npx -y mcp-fetch-server@latest"
    else
        echo "  ! skipped Codex fetch MCP because codex is not installed"
    fi
}
