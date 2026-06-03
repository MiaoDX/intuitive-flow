#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_SCRIPTS_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

# Install and configure Agent Deck as an isolated AI-agent session dashboard.
# The generated config allows multiple TUI windows for the same profile.
# https://github.com/asheshgoplani/agent-deck
#
# Defaults can be overridden by environment variables:
#   AGENT_DECK_VERSION=latest|v1.9.x
#   AGENT_DECK_INSTALL_DIR=~/.local/bin
#   AGENT_DECK_BIN_NAME=agent-deck
#   AGENT_DECK_CONFIG=~/.agent-deck/config.toml
#   AGENT_DECK_SKIP_INSTALL=1

AGENT_DECK_VERSION="${AGENT_DECK_VERSION:-latest}"
AGENT_DECK_INSTALL_DIR="${AGENT_DECK_INSTALL_DIR:-$HOME/.local/bin}"
AGENT_DECK_BIN_NAME="${AGENT_DECK_BIN_NAME:-agent-deck}"
AGENT_DECK_CONFIG="${AGENT_DECK_CONFIG:-$HOME/.agent-deck/config.toml}"
AGENT_DECK_SKIP_INSTALL="${AGENT_DECK_SKIP_INSTALL:-0}"
AGENT_DECK_AVAILABLE=true

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

print_command_output() {
    local output="$1"
    if [ -n "$output" ]; then
        printf '%s\n' "$output" | sed 's/^/    /'
    fi
}

print_failure() {
    local message="$1"
    local output="${2:-}"

    echo "  ✗ $message"
    print_command_output "$output"
}

resolve_agent_deck_cmd() {
    local installed_cmd="$AGENT_DECK_INSTALL_DIR/$AGENT_DECK_BIN_NAME"
    if [ -x "$installed_cmd" ]; then
        printf '%s\n' "$installed_cmd"
        return 0
    fi

    if command -v "$AGENT_DECK_BIN_NAME" >/dev/null 2>&1; then
        command -v "$AGENT_DECK_BIN_NAME"
        return 0
    fi

    return 1
}

install_agent_deck() {
    local installer
    local out
    installer=$(mktemp)

    task_notice "Agent Deck: downloading installer"
    if ! out=$(curl -fsSL https://raw.githubusercontent.com/asheshgoplani/agent-deck/main/install.sh -o "$installer" 2>&1); then
        rm -f "$installer"
        print_failure "agent-deck installer download failed" "$out"
        return 1
    fi

    task_notice "Agent Deck: installing $AGENT_DECK_VERSION"
    if ! out=$(bash "$installer" \
        --name "$AGENT_DECK_BIN_NAME" \
        --dir "$AGENT_DECK_INSTALL_DIR" \
        --version "$AGENT_DECK_VERSION" \
        --skip-tmux-config \
        --non-interactive 2>&1); then
        rm -f "$installer"
        print_failure "agent-deck install failed" "$out"
        return 1
    fi

    rm -f "$installer"
}

update_agent_deck() {
    local cmd="$1"
    local update_version="${AGENT_DECK_VERSION#v}"
    local out

    if [ "$AGENT_DECK_VERSION" = "latest" ]; then
        task_notice "Agent Deck: updating to latest"
        if ! out=$("$cmd" update <<<"y" 2>&1); then
            print_failure "agent-deck update failed" "$out"
            return 1
        fi
    else
        task_notice "Agent Deck: updating to $update_version"
        if ! out=$("$cmd" update --version "$update_version" <<<"y" 2>&1); then
            print_failure "agent-deck update failed" "$out"
            return 1
        fi
    fi
}

print_agent_deck_version() {
    local version
    if ! version=$("$AGENT_DECK_CMD" --version 2>&1); then
        if ! version=$("$AGENT_DECK_CMD" version 2>&1); then
            print_failure "agent-deck version check failed" "$version"
            return 1
        fi
    fi

    version=$(printf '%s\n' "$version" | sed -n '1p')
    version="${version#Agent Deck }"
    if [ -n "$version" ]; then
        echo "  ✓ agent-deck $version"
    else
        echo "  ✓ agent-deck"
    fi
}

install_codex_notify_hook() {
    local out
    if ! out=$("$AGENT_DECK_CMD" codex-hooks install 2>&1); then
        print_failure "agent-deck codex notify hook failed" "$out"
        return 1
    fi

    echo "  ✓ agent-deck codex notify hook"
}

if [ "$AGENT_DECK_SKIP_INSTALL" = "1" ]; then
    echo "  ! agent-deck install/update skipped (AGENT_DECK_SKIP_INSTALL=1)"
else
    if AGENT_DECK_CMD=$(resolve_agent_deck_cmd); then
        update_agent_deck "$AGENT_DECK_CMD"
    else
        install_agent_deck
    fi
fi

if ! AGENT_DECK_CMD=$(resolve_agent_deck_cmd); then
    if [ "$AGENT_DECK_SKIP_INSTALL" = "1" ]; then
        AGENT_DECK_AVAILABLE=false
        AGENT_DECK_CMD="$AGENT_DECK_BIN_NAME"
    else
        print_failure "could not find $AGENT_DECK_BIN_NAME after setup" "Add $AGENT_DECK_INSTALL_DIR to PATH or set AGENT_DECK_INSTALL_DIR."
        exit 1
    fi
fi

mkdir -p "$(dirname "$AGENT_DECK_CONFIG")"
if [ -s "$AGENT_DECK_CONFIG" ]; then
    task_notice "Agent Deck: backing up config"
    if ! out=$(cp "$AGENT_DECK_CONFIG" "$AGENT_DECK_CONFIG.bak.$(date +%s)" 2>&1); then
        print_failure "agent-deck config backup failed" "$out"
        exit 1
    fi
fi

task_notice "Agent Deck: writing config"
if ! out=$(bun "$REPO_SCRIPTS_DIR/lib/ensure-agent-deck-config.ts" "$AGENT_DECK_CONFIG" 2>&1); then
    print_failure "agent-deck config update failed" "$out"
    exit 1
fi
echo "  ✓ agent-deck config (multiple instances enabled)"

if [ "$AGENT_DECK_AVAILABLE" = true ]; then
    task_notice "Agent Deck: checking version"
    print_agent_deck_version
    task_notice "Agent Deck: installing Codex notify hook"
    install_codex_notify_hook
fi
