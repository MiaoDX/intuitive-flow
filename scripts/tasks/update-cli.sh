#!/bin/bash

_TASK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$_TASK_DIR/../lib/npm-registry.sh"
unset _TASK_DIR

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

global_cli_repair_specs() {
    local registry="$1"
    local specs=(
        @anthropic-ai/claude-code
        claude-fetch-setup
        @openai/codex
        pyright
    )

    local claude_native
    claude_native=$(claude_native_package)
    if [ -n "$claude_native" ]; then
        specs+=("$claude_native")
    fi

    local codex_native_spec
    codex_native_spec=$(codex_native_install_spec "$registry" 2>/dev/null) || codex_native_spec=""
    if [ -n "$codex_native_spec" ]; then
        specs+=("$codex_native_spec")
    fi

    printf '%s\n' "${specs[@]}"
}

print_npm_install_command() {
    local registry="$1"
    shift

    printf '    npm install -g --include=optional --foreground-scripts --registry=%q' "$registry"
    local spec
    for spec in "$@"; do
        printf ' %q' "$spec"
    done
    printf '\n'
}

print_global_cli_manual_repair() {
    local registry="$1"
    shift

    local specs=("$@")
    if [ "${#specs[@]}" -eq 0 ]; then
        while IFS= read -r spec; do
            [ -n "$spec" ] || continue
            specs+=("$spec")
        done < <(global_cli_repair_specs "$registry")
    fi

    echo "  ! To repair the global CLI packages outside update.sh, run:"
    print_npm_install_command "$registry" "${specs[@]}"

    if [ "$registry" != "$NPM_FALLBACK_REGISTRY" ]; then
        local direct_specs=()
        while IFS= read -r spec; do
            [ -n "$spec" ] || continue
            direct_specs+=("$spec")
        done < <(global_cli_repair_specs "$NPM_FALLBACK_REGISTRY")

        echo "  ! If the mirror looks stale, use the original npm registry:"
        print_npm_install_command "$NPM_FALLBACK_REGISTRY" "${direct_specs[@]}"
    fi
}

# Failure hint for run_global_cli_tools — surfaces the most common npm error
# (ENOTEMPTY when an old global package directory blocks the rename), then prints
# a raw npm command so the user can repair CLI packages outside update.sh.
print_npm_failure_hint() {
    local log_file="$1"
    local path dest npm_log registry install_specs

    path=$(sed -n 's/^npm error path //p' "$log_file" | tail -1)
    dest=$(sed -n 's/^npm error dest //p' "$log_file" | tail -1)
    npm_log=$(sed -n 's/^npm error A complete log of this run can be found in: //p' "$log_file" | tail -1)
    registry=$(
        sed -n \
            -e 's/^  ✓ Global CLI tools registry: \([^ ]*\).*/\1/p' \
            "$log_file" | tail -1
    )
    if [ -z "$registry" ]; then
        if [ "$NPM_REGISTRY_MODE" = "direct" ]; then
            registry="$NPM_FALLBACK_REGISTRY"
        else
            registry="$NPM_MIRROR_REGISTRY"
        fi
    fi
    install_specs=$(sed -n 's/^  → installing package(s): //p' "$log_file" | tail -1)

    if grep -q '^npm error ENOTEMPTY: directory not empty, rename ' "$log_file" && [ -n "$dest" ]; then
        echo "  ! npm could not move the existing package out of the way because this path already exists:"
        echo "    $dest"
        if [ -n "$path" ]; then
            echo "  ! It was trying to update:"
            echo "    $path"
        fi
        echo "  ! Inspect that leftover path and, if it is stale, move or remove it manually, then rerun update.sh."
        echo "  ! Example:"
        echo "    ls -la \"$(dirname "$dest")\""
        echo "    mv \"$dest\" \"${dest}.bak.$(date +%Y%m%d_%H%M%S)\""
    fi

    if [ -n "$npm_log" ]; then
        echo "  ! npm log: $npm_log"
    fi

    # shellcheck disable=SC2206
    local parsed_specs=($install_specs)
    print_global_cli_manual_repair "$registry" "${parsed_specs[@]}"
    return 0
}

print_tool_version() {
    local label="$1"
    local binary="$2"
    local path version

    path=$(command -v "$binary" 2>/dev/null) || {
        echo "  ! $label failed after install:"
        echo "$binary: command not found"
        return 1
    }

    if [ ! -x "$path" ]; then
        echo "  ! $label failed after install:"
        echo "$path: Permission denied"
        return 1
    fi

    version=$("$path" --version 2>&1) || {
        echo "  ! $label failed after install:"
        echo "$version"
        return 1
    }

    echo "  ✓ $label $version"
}

global_cli_package_binary() {
    case "$1" in
        @anthropic-ai/claude-code) printf '%s\n' "claude" ;;
        claude-fetch-setup)        printf '%s\n' "claude-fetch-setup" ;;
        @openai/codex)             printf '%s\n' "codex" ;;
        pyright)                   printf '%s\n' "pyright" ;;
        *)                         return 1 ;;
    esac
}

global_cli_binary_available() {
    local binary="$1"
    local path

    path=$(command -v "$binary" 2>/dev/null) || return 1
    [ -x "$path" ]
}

stale_npm_rename_dest() {
    local output="$1"

    grep -q '^npm error ENOTEMPTY: directory not empty, rename ' <<< "$output" || return 1
    sed -n 's/^npm error dest //p' <<< "$output" | tail -1
}

safe_stale_npm_dest() {
    local dest="$1"
    local base

    [ -n "$dest" ] || return 1
    [ -d "$dest" ] || return 1
    [[ "$dest" == */node_modules/* ]] || return 1
    base="${dest##*/}"
    [[ "$base" == .* ]]
}

run_global_cli_npm_install() {
    local registry="$1"
    shift

    local output status dest backup

    output=$(npm install -g --loglevel=error --include=optional --foreground-scripts --registry="$registry" "$@" 2>&1) && {
        [ -z "$output" ] || printf '%s\n' "$output"
        return 0
    }
    status=$?

    dest=$(stale_npm_rename_dest "$output") || dest=""
    if ! safe_stale_npm_dest "$dest"; then
        printf '%s\n' "$output"
        return "$status"
    fi

    backup="${dest}.bak.$(date +%Y%m%d_%H%M%S).$$"
    echo "  ! npm install hit stale rename destination:"
    echo "    $dest"
    echo "  ! moving stale npm temp package aside:"
    echo "    $backup"
    mv "$dest" "$backup" || {
        printf '%s\n' "$output"
        return "$status"
    }

    echo "  → retrying npm install after stale temp cleanup"
    npm install -g --loglevel=error --include=optional --foreground-scripts --registry="$registry" "$@"
}

append_if_package_needs_update() {
    local registry="$1"
    local package="$2"
    local install_spec="${3:-$2}"
    local latest installed binary

    task_notice "Global CLI tools: checking $package"
    latest=$(npm_package_version "$package" "$registry") || latest=""
    installed=$(global_npm_package_version "$package") || installed=""

    if [ -z "$latest" ]; then
        echo "  ! could not resolve latest version for: $package"
        GLOBAL_CLI_CHECK_FAILED=true
    elif [ -z "$installed" ]; then
        echo "  ! missing global package: $package@$latest"
        GLOBAL_CLI_INSTALL_PACKAGES+=("$install_spec")
    elif [ "$installed" != "$latest" ]; then
        echo "  ! global package update available: $package $installed → $latest"
        GLOBAL_CLI_INSTALL_PACKAGES+=("$install_spec")
    elif binary=$(global_cli_package_binary "$package"); then
        if ! global_cli_binary_available "$binary"; then
            echo "  ! global package binary unavailable: $package@$installed should provide executable $binary"
            GLOBAL_CLI_INSTALL_PACKAGES+=("$install_spec")
        fi
    fi
}

collect_global_cli_install_packages() {
    local registry="$1"
    shift

    GLOBAL_CLI_INSTALL_PACKAGES=()
    GLOBAL_CLI_CHECK_FAILED=false

    local package
    for package in "$@"; do
        append_if_package_needs_update "$registry" "$package"
    done

    local codex_native_name codex_native_version codex_native_installed codex_native_spec native_spec_prefix
    codex_native_name=$(codex_native_package_name)
    if [ -n "$codex_native_name" ]; then
        codex_native_spec=$(codex_native_install_spec "$registry") || codex_native_spec=""
        native_spec_prefix="$codex_native_name@npm:@openai/codex@"
        codex_native_version="${codex_native_spec#"$native_spec_prefix"}"
        if [ "$codex_native_version" = "$codex_native_spec" ]; then
            codex_native_version=""
        fi
        codex_native_installed=$(global_npm_package_version "$codex_native_name") || codex_native_installed=""

        if [ -z "$codex_native_spec" ]; then
            echo "  ! could not resolve Codex native package spec for: $codex_native_name"
            GLOBAL_CLI_CHECK_FAILED=true
        elif [ -z "$codex_native_version" ]; then
            echo "  ! could not resolve Codex native package version for: $codex_native_name"
            GLOBAL_CLI_CHECK_FAILED=true
        elif [ -z "$codex_native_installed" ]; then
            echo "  ! missing global package: $codex_native_name@$codex_native_version"
            GLOBAL_CLI_INSTALL_PACKAGES+=("$codex_native_spec")
        elif [ "$codex_native_installed" != "$codex_native_version" ]; then
            echo "  ! global package update available: $codex_native_name $codex_native_installed → $codex_native_version"
            GLOBAL_CLI_INSTALL_PACKAGES+=("$codex_native_spec")
        fi
    fi

    if [ "$GLOBAL_CLI_CHECK_FAILED" = true ]; then
        return 1
    fi

    return 0
}

run_global_cli_tools() {
    local packages=(
        @anthropic-ai/claude-code
        claude-fetch-setup
        @openai/codex
        pyright
    )
    local native_package
    native_package=$(claude_native_package)
    if [ -n "$native_package" ]; then
        packages+=("$native_package")
    fi

    local registry
    registry=$(select_npm_registry "Global CLI tools" "${packages[@]}") || return 1

    task_notice "Global CLI tools: checking installed versions"
    collect_global_cli_install_packages "$registry" "${packages[@]}" || return 1
    if [ "${#GLOBAL_CLI_INSTALL_PACKAGES[@]}" -eq 0 ]; then
        echo "  ✓ global CLI packages already current"
        print_tool_version claude claude
        print_tool_version codex codex
        print_tool_version pyright pyright
        return 0
    fi

    # Keep all global npm installs in one command so they do not race on the same prefix.
    echo "  → installing package(s): ${GLOBAL_CLI_INSTALL_PACKAGES[*]}"
    if [ "$registry" = "$NPM_MIRROR_REGISTRY" ] && [ "$NPM_REGISTRY_MODE" = "mirror" ]; then
        task_notice "Global CLI tools: installing ${GLOBAL_CLI_INSTALL_PACKAGES[*]}"
    else
        task_notice "Global CLI tools: installing ${GLOBAL_CLI_INSTALL_PACKAGES[*]} via $registry"
    fi
    run_global_cli_npm_install "$registry" "${GLOBAL_CLI_INSTALL_PACKAGES[@]}"
    hash -r

    print_tool_version claude claude
    print_tool_version codex codex
    print_tool_version pyright pyright
}

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
