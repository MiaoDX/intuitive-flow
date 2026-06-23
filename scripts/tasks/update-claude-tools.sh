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
    task_notice "MCP: fetch: running claude-fetch-setup"
    claude-fetch-setup >/dev/null 2>&1 || {
        echo "  ! claude-fetch-setup failed"
        return 1
    }
    echo "  ✓ mcp-fetch"
}
