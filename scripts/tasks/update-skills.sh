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

_external_skill_manifest() {
    printf '%s/external-skill-sources.txt\n' "$SCRIPT_DIR"
}

_external_skill_tool() {
    if ! command -v bun >/dev/null 2>&1; then
        echo "  ! bun not found; run scripts/update.sh after fixing the environment pre-check"
        return 1
    fi

    bun "$SCRIPT_DIR/lib/external-skill-sources.ts" "$@"
}

_run_external_skills() {
    local agent="$1" label="$2"
    local manifest repo skill_args_output
    manifest=$(_external_skill_manifest)
    repo=$(_external_skill_tool repo "$manifest" "$label") || return 1
    skill_args_output=$(_external_skill_tool skill-args "$manifest" "$label") || return 1

    local skill_args=()
    if [ -n "$skill_args_output" ]; then
        while IFS= read -r arg; do
            skill_args+=("$arg")
        done <<< "$skill_args_output"
    fi

    if [ "${#skill_args[@]}" -gt 0 ]; then
        _run_skills "$agent" "$repo" "$label" "${skill_args[@]}"
    else
        _run_skills "$agent" "$repo" "$label"
    fi
}

run_skills_anthro() {
    _run_external_skills "$1" "anthropics"
}

run_skills_codex() {
    _run_external_skills "$1" "codex"
}

run_skills_mattpocock() {
    _run_external_skills "$1" "mattpocock"
}
