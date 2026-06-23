#!/bin/bash

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

run_codex_config() {
    local config_file="$HOME/.codex/config.toml"

    if command -v codex >/dev/null 2>&1; then
        task_notice "Codex config: enabling features"
        local feature
        for feature in goals hooks image_generation; do
            codex features enable "$feature" >/dev/null
        done
        echo "  ✓ codex features enabled: goals, hooks, image_generation"
    else
        echo "  ! skipped codex feature setup because codex is not installed"
    fi

    task_notice "Codex config: writing status line"
    bun "$SCRIPT_DIR/lib/ensure-codex-config.ts" "$config_file"
    echo "  ✓ codex status line configured"
}
