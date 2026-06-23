#!/bin/bash

_TASK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$_TASK_DIR/../lib/npm-registry.sh"
unset _TASK_DIR

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

prune_broken_codex_skill_symlinks() {
    local skills_dir="$HOME/.codex/skills"
    local link removed=0

    [ -d "$skills_dir" ] || return 0

    while IFS= read -r -d '' link; do
        rm -f "$link"
        removed=$((removed + 1))
    done < <(find "$skills_dir" -xtype l -print0 2>/dev/null)

    if [ "$removed" -gt 0 ]; then
        echo "  ! removed $removed broken Codex skill symlink(s)"
    fi
}

prune_gsd_hooks() {
    local config_dir="$1"
    local label="$2"
    local hooks_dir="$config_dir/hooks"
    local hook removed=0

    [ -d "$hooks_dir" ] || return 0

    while IFS= read -r -d '' hook; do
        rm -f "$hook"
        removed=$((removed + 1))
    done < <(find "$hooks_dir" -maxdepth 1 -type f \( -name 'gsd-*.js' -o -name 'gsd-*.sh' \) -print0 2>/dev/null)

    if [ "$removed" -gt 0 ]; then
        echo "  ! removed $removed existing $label GSD hook file(s)"
    fi
}

gsd_current_for_target() {
    local label="$1"
    local config_dir="$2"
    local latest="$3"
    local version_file="$config_dir/get-shit-done/VERSION"
    local profile_file="$config_dir/.gsd-profile"
    local desired_profile="standard"
    local installed=""
    local active_profile=""

    if [ -f "$version_file" ]; then
        installed=$(cat "$version_file")
    fi

    if [ -f "$profile_file" ]; then
        active_profile=$(cat "$profile_file")
    fi

    if [ "$installed" = "$latest" ]; then
        if [ "$active_profile" = "$desired_profile" ]; then
            echo "  ✓ gsd $label already current: v$installed ($desired_profile profile)"
            return 0
        fi

        if [ -z "$active_profile" ]; then
            echo "  ! gsd $label profile missing; reinstalling v$installed with $desired_profile profile"
        else
            echo "  ! gsd $label profile is $active_profile; reinstalling v$installed with $desired_profile profile"
        fi
        return 1
    fi

    if [ -z "$installed" ]; then
        echo "  ! gsd $label missing; installing v$latest with $desired_profile profile"
    else
        echo "  ! gsd $label update available: v$installed → v$latest with $desired_profile profile"
    fi

    return 1
}

run_gsd_installer() {
    local registry="$1"
    local target="$2"
    local profile="standard"
    local out

    if [ "$registry" = "$NPM_MIRROR_REGISTRY" ] && [ "$NPM_REGISTRY_MODE" = "mirror" ]; then
        task_notice "GSD workflow: running installer $target --profile=$profile"
    else
        task_notice "GSD workflow: running installer $target --profile=$profile via $registry"
    fi
    out=$(npx --registry="$registry" -y @opengsd/get-shit-done-redux "$target" --global "--profile=$profile" 2>&1) || { echo "$out"; return 1; }
    echo "$out" | grep -E '^  [⚠✗!]' || true
}

run_gsd_workflow() {
    local registry
    local latest
    registry=$(select_npm_registry "GSD workflow" @opengsd/get-shit-done-redux) || return 1
    task_notice "GSD workflow: resolving latest version"
    latest=$(npm_package_version @opengsd/get-shit-done-redux "$registry") || return 1

    task_notice "GSD workflow: checking Claude install"
    # GSD #976: strip context-monitor hook from global settings.json (use auto-compact instead)
    prune_gsd_hooks "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" "Claude Code"
    if ! gsd_current_for_target "claude" "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" "$latest"; then
        run_gsd_installer "$registry" --claude || return 1
    fi

    task_notice "GSD workflow: checking Codex install"
    prune_broken_codex_skill_symlinks
    prune_gsd_hooks "${CODEX_HOME:-$HOME/.codex}" "Codex"
    if ! gsd_current_for_target "codex" "${CODEX_HOME:-$HOME/.codex}" "$latest"; then
        run_gsd_installer "$registry" --codex || return 1
    fi

    local settings="$HOME/.claude/settings.json"
    if [ -f "$settings" ] && command -v jq >/dev/null 2>&1; then
        local tmp
        tmp=$(jq '
          if .hooks.PostToolUse then
            .hooks.PostToolUse |= map(
              select(.hooks | any(.command | test("gsd-context-monitor")) | not)
            )
          else . end
        ' "$settings") && printf '%s\n' "$tmp" > "$settings"
    fi

    local gsd_version
    gsd_version=$(cat ~/.claude/get-shit-done/VERSION 2>/dev/null || echo "?")
    bun "$SCRIPT_DIR/lib/managed-skill-state.ts" gsd-sync "$SCRIPT_DIR/default-skill-allowlist.txt" || return 1
    echo "  ✓ gsd v$gsd_version (claude + codex)"
}
