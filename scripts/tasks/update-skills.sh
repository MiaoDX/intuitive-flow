#!/bin/bash

_TASK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$_TASK_DIR/../lib/npm-registry.sh"
unset _TASK_DIR

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

_run_skills() {
    local agent="$1" repo="$2" label="$3"; shift 3
    local out registry
    registry=$(select_npm_registry "Skills CLI" skills) || return 1
    if [ "$registry" = "$NPM_MIRROR_REGISTRY" ] && [ "$NPM_REGISTRY_MODE" = "mirror" ]; then
        task_notice "Skills: installing $label for $agent"
    else
        task_notice "Skills: installing $label for $agent via $registry"
    fi
    out=$(npx --registry="$registry" -y skills add "$repo" -a "$agent" -g -y "$@" 2>&1) || { echo "$out"; return 1; }
    echo "$out" | grep -E '(warn|error|⚠|✗)' || true
    echo "  ✓ skills ($label) → $agent"
}

_default_skill_allowlist() {
    printf '%s/default-skill-allowlist.txt\n' "$SCRIPT_DIR"
}

_allowlist_tool() {
    if ! command -v bun >/dev/null 2>&1; then
        echo "  ! bun not found; run scripts/update.sh after fixing the environment pre-check"
        return 1
    fi

    bun "$SCRIPT_DIR/lib/default-skill-allowlist.ts" "$@"
}

_run_external_skills() {
    local agent="$1" label="$2"
    local allowlist repo skill_args_output
    allowlist=$(_default_skill_allowlist)
    repo=$(_allowlist_tool external-repo "$allowlist" "$label") || return 1
    skill_args_output=$(_allowlist_tool external-skill-args "$allowlist" "$label") || return 1

    local skill_args=()
    if [ -n "$skill_args_output" ]; then
        while IFS= read -r arg; do
            skill_args+=("$arg")
        done <<< "$skill_args_output"
    fi

    if [ "${#skill_args[@]}" -gt 0 ]; then
        _run_skills "$agent" "$repo" "$label" "${skill_args[@]}" || return 1
    else
        _run_skills "$agent" "$repo" "$label" || return 1
    fi

    bun "$SCRIPT_DIR/lib/managed-skill-state.ts" external-sync "$allowlist" "$label"
}

run_external_skill_label() {
    _run_external_skills "$1" "$2"
}

list_external_skill_labels() {
    local allowlist
    allowlist=$(_default_skill_allowlist)
    _allowlist_tool external-labels "$allowlist"
}

prune_removed_external_skill_labels() {
    local allowlist
    allowlist=$(_default_skill_allowlist)
    bun "$SCRIPT_DIR/lib/managed-skill-state.ts" external-prune-removed "$allowlist"
}
