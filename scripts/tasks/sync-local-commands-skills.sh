#!/bin/bash

_TASK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$_TASK_DIR/../lib/npm-registry.sh"
unset _TASK_DIR

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

_replace_dir_contents() {
    local src_dir="$1"
    local dest_dir="$2"

    if [ -e "$dest_dir" ] && [ ! -d "$dest_dir" ]; then
        echo "  ! destination exists and is not a directory: $dest_dir"
        return 1
    fi

    rm -rf "$dest_dir"
    mkdir -p "$dest_dir"
    cp -R "$src_dir"/. "$dest_dir"/
}

_manifest_tool() {
    if ! command -v bun >/dev/null 2>&1; then
        echo "  ! bun not found; run scripts/update.sh after fixing the environment pre-check"
        return 1
    fi

    bun "$SCRIPT_DIR/lib/default-skill-allowlist.ts" "$@"
}

_managed_state_tool() {
    if ! command -v bun >/dev/null 2>&1; then
        echo "  ! bun not found; run scripts/update.sh after fixing the environment pre-check"
        return 1
    fi

    bun "$SCRIPT_DIR/lib/managed-skill-state.ts" "$@"
}

_check_root_skill_manifest() {
    local manifest="$1"
    local root_skills_src="$2"
    _manifest_tool check-root-skills "$manifest" "$root_skills_src"
}

# Sync repo-owned skills/* to:
#   Claude Code + ~/.codex/skills/  (skills)
run_sync_local_commands_skills() {
    local project_dir default_skill_allowlist default_skill_prune_ledger
    project_dir=$(cd "$SCRIPT_DIR/.." && pwd)
    default_skill_allowlist="$project_dir/scripts/default-skill-allowlist.txt"
    default_skill_prune_ledger="$project_dir/scripts/default-skill-prune-ledger.txt"

    task_notice "Repo-local commands & skills: pruning stale artifacts"
    if [ -f "$default_skill_prune_ledger" ]; then
        _managed_state_tool prune-legacy-artifacts "$default_skill_prune_ledger" || return 1
    fi
    _managed_state_tool prune-owned-root-skills "$default_skill_allowlist" || return 1

    local codex_dest="$HOME/.codex/skills"
    local claude_dest="$HOME/.claude/skills"

    # ── Sync local skills/* (repo root) to Claude Code + Codex ─
    local root_skills_src="$project_dir/skills"
    if [ -d "$root_skills_src" ]; then
        local root_skills_codex_synced=0
        local root_skills_claude_synced=0
        local root_skills_claude_failed=0
        local skill_dir skill_name
        if ! _check_root_skill_manifest "$default_skill_allowlist" "$root_skills_src"; then
            return 1
        fi
        local skills_registry
        skills_registry=$(select_npm_registry "Skills CLI" skills) || return 1
        if [ -d "$root_skills_src/_shared" ]; then
            if [ -d "$codex_dest" ]; then
                task_notice "Repo-local commands & skills: syncing shared Codex skill resources"
                if ! _replace_dir_contents "$root_skills_src/_shared" "$codex_dest/_shared"; then
                    return 1
                fi
            fi
            if [ -d "$claude_dest" ]; then
                task_notice "Repo-local commands & skills: syncing shared Claude Code skill resources"
                if ! _replace_dir_contents "$root_skills_src/_shared" "$claude_dest/_shared"; then
                    return 1
                fi
            fi
        fi
        while IFS= read -r skill_name; do
            skill_dir="$root_skills_src/$skill_name"

            task_notice "Repo-local commands & skills: syncing root skill $skill_name"
            if npx --registry="$skills_registry" -y skills add "$skill_dir" -g -y -a claude-code >/dev/null 2>&1 </dev/null; then
                root_skills_claude_synced=$((root_skills_claude_synced + 1))
            else
                echo "  ! failed to sync Claude Code skill: $skill_name"
                root_skills_claude_failed=$((root_skills_claude_failed + 1))
            fi

            if [ -d "$codex_dest" ]; then
                # Replace contents so deleted or renamed skill resources do not
                # survive in the installed Codex mirror.
                if ! _replace_dir_contents "$skill_dir" "$codex_dest/$skill_name"; then
                    return 1
                fi
                root_skills_codex_synced=$((root_skills_codex_synced + 1))
            fi

            echo "  synced skill mirrors: $skill_name"
        done < <(_manifest_tool root-skills "$default_skill_allowlist")
        if [ "$root_skills_claude_failed" -gt 0 ]; then
            echo "  ! $root_skills_claude_failed repo-local skill(s) failed to sync to Claude Code"
            return 1
        fi
        if [ "$root_skills_claude_synced" -gt 0 ] || [ "$root_skills_codex_synced" -gt 0 ]; then
            echo "  ✓ $root_skills_claude_synced repo-local skill(s) → Claude Code"
            echo "  ✓ $root_skills_codex_synced repo-local skill(s) → ~/.codex/skills/"
        fi
        _managed_state_tool record-owned-root-skills "$default_skill_allowlist" || return 1
    fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
    run_sync_local_commands_skills "$@"
fi
