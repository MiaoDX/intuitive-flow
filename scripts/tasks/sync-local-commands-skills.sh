#!/bin/bash

_TASK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$_TASK_DIR/../lib/codex-skill-adapter.sh"
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

_remove_stale_local_artifacts() {
    local manifest="$1"
    if [ ! -f "$manifest" ]; then
        return 0
    fi
    _managed_state_tool prune-legacy-artifacts "$manifest"
}

_remove_stale_owned_root_skills() {
    local manifest="$1"
    _managed_state_tool prune-owned-root-skills "$manifest"
}

_record_owned_root_skills() {
    local manifest="$1"
    _managed_state_tool record-owned-root-skills "$manifest"
}

_check_root_skill_manifest() {
    local manifest="$1"
    local root_skills_src="$2"
    _manifest_tool check-root-skills "$manifest" "$root_skills_src"
}

# Sync .claude/commands/*.md from this repo to:
#   ~/.claude/commands/   (Claude Code global commands — raw .md copy)
#   ~/.codex/skills/      (Codex skills — rendered via render_codex_skill)
# Sync repo-owned skills/* to:
#   Claude Code + ~/.codex/skills/  (skills)
#   ~/.config/mimocode/command/     (MiMoCode slash-command wrappers)
run_sync_local_commands_skills() {
    local project_dir commands_src default_skill_allowlist default_skill_prune_ledger
    project_dir=$(cd "$SCRIPT_DIR/.." && pwd)
    commands_src="$project_dir/.claude/commands"
    default_skill_allowlist="$project_dir/scripts/default-skill-allowlist.txt"
    default_skill_prune_ledger="$project_dir/scripts/default-skill-prune-ledger.txt"

    task_notice "Repo-local commands & skills: pruning stale artifacts"
    _remove_stale_local_artifacts "$default_skill_prune_ledger" || return 1
    _remove_stale_owned_root_skills "$default_skill_allowlist" || return 1

    local claude_dest="$HOME/.claude/commands"
    local codex_dest="$HOME/.codex/skills"
    local synced=0 src_file filename name codex_name

    mkdir -p "$claude_dest"

    if [ -d "$commands_src" ]; then
        for src_file in "$commands_src"/*.md; do
            [ -f "$src_file" ] || continue

            filename=$(basename "$src_file")
            name="${filename%.md}"
            codex_name="${name//_/-}"

            cp "$src_file" "$claude_dest/$name.md"

            if [ -d "$codex_dest" ]; then
                render_codex_skill "$src_file" "$codex_dest/$codex_name" "$codex_name"
            fi

            synced=$((synced + 1))
            echo "  synced command: $name"
        done
    fi

    if [ "$synced" -eq 0 ]; then
        echo "  ! no .md files found in .claude/commands/"
    elif [ -d "$codex_dest" ]; then
        echo "  ✓ $synced local command(s) → ~/.claude/commands/ + ~/.codex/skills/"
    else
        echo "  ✓ $synced local command(s) → ~/.claude/commands/"
    fi

    # ── Sync local skills/* (repo root) to Claude Code + Codex ─
    local root_skills_src="$project_dir/skills"
    if [ -d "$root_skills_src" ]; then
        local root_skills_codex_synced=0
        local root_skills_claude_synced=0
        local root_skills_claude_failed=0
        local root_skills_mimocode_synced=0
        local mimocode_command_dest="$HOME/.config/mimocode/command"
        local skill_dir skill_name
        if ! _check_root_skill_manifest "$default_skill_allowlist" "$root_skills_src"; then
            return 1
        fi
        local skills_registry
        skills_registry=$(select_npm_registry "Skills CLI" skills) || return 1
        mkdir -p "$mimocode_command_dest"
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

            # MiMoCode reads skills from ~/.codex/skills natively; generate a
            # slash-command wrapper so /<skill_name> is available in MiMoCode too.
            render_mimocode_command "$skill_dir/SKILL.md" "$mimocode_command_dest/$skill_name.md" "$skill_name"
            root_skills_mimocode_synced=$((root_skills_mimocode_synced + 1))

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
        if [ "$root_skills_mimocode_synced" -gt 0 ]; then
            echo "  ✓ $root_skills_mimocode_synced repo-local command(s) → ~/.config/mimocode/command/"
        fi
        _record_owned_root_skills "$default_skill_allowlist" || return 1
    fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
    run_sync_local_commands_skills "$@"
fi
