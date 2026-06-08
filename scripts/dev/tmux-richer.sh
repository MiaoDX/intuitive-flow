#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_SCRIPTS_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

source "$REPO_SCRIPTS_DIR/lib/ensure-no-running-codex.sh"

# Install and setup tmux-agent-status for both Claude Code and Codex.
# https://github.com/samleeney/tmux-agent-status

ensure_no_running_codex

PLUGIN_DIR="$HOME/.config/tmux/plugins/tmux-agent-status"
TPM_DIR="$HOME/.config/tmux/plugins/tpm"

echo "==> Installing tmux-agent-status..."

# 1. Ensure TPM is installed
if [ ! -d "$TPM_DIR" ]; then
    echo "    Cloning TPM..."
    mkdir -p "$TPM_DIR"
    git clone --depth 1 https://github.com/tmux-plugins/tpm "$TPM_DIR"
fi

# 2. Clone the plugin
if [ ! -d "$PLUGIN_DIR" ]; then
    echo "    Cloning tmux-agent-status..."
    mkdir -p "$(dirname "$PLUGIN_DIR")"
    git clone --depth 1 https://github.com/samleeney/tmux-agent-status "$PLUGIN_DIR"
else
    echo "    Updating tmux-agent-status..."
    git -C "$PLUGIN_DIR" pull --ff-only
fi

# 3. Ensure plugin is in tmux.conf
TMUX_CONF="$HOME/.tmux.conf"
TPM_INIT_LINE="run '~/.config/tmux/plugins/tpm/tpm'"

if [ -f "$TMUX_CONF" ]; then
    if ! grep -q "tmux-agent-status" "$TMUX_CONF"; then
        echo "" >> "$TMUX_CONF"
        echo "# tmux-agent-status" >> "$TMUX_CONF"
        echo "set -g @plugin 'samleeney/tmux-agent-status'" >> "$TMUX_CONF"
        echo "    Added tmux-agent-status to ~/.tmux.conf"
    else
        echo "    tmux-agent-status already in ~/.tmux.conf"
    fi

    # Ensure TPM init line is present at the bottom
    if ! grep -qF "$TPM_INIT_LINE" "$TMUX_CONF"; then
        echo "" >> "$TMUX_CONF"
        echo "# Initialize TMUX plugin manager (keep this line at the very bottom)" >> "$TMUX_CONF"
        echo "$TPM_INIT_LINE" >> "$TMUX_CONF"
        echo "    Added TPM init line to ~/.tmux.conf"
    else
        echo "    TPM init line already in ~/.tmux.conf"
    fi
else
    echo "    Creating ~/.tmux.conf..."
    cat > "$TMUX_CONF" <<'EOF'
# tmux-agent-status
set -g @plugin 'samleeney/tmux-agent-status'

# Initialize TMUX plugin manager (keep this line at the very bottom)
run '~/.config/tmux/plugins/tpm/tpm'
EOF
fi

# 4. Claude Code settings
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$(dirname "$CLAUDE_SETTINGS")"

if [ -s "$CLAUDE_SETTINGS" ]; then
    echo "    Merging Claude Code hooks into existing ~/.claude/settings.json..."
    cp "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.bak.$(date +%s)"
fi
bun "$REPO_SCRIPTS_DIR/lib/ensure-claude-hooks.ts" "$CLAUDE_SETTINGS" "$PLUGIN_DIR"
echo "    Claude Code hooks configured."

# 5. Codex CLI settings
CODEX_CONFIG="$HOME/.codex/config.toml"
CODEX_HOOKS="$HOME/.codex/hooks.json"
bun "$REPO_SCRIPTS_DIR/lib/ensure-codex-config.ts" "$CODEX_CONFIG"
echo "    Codex config ensured in ~/.codex/config.toml"
echo "    Codex status line includes current-dir, git-branch, context-used, fast-mode, and thread-title"

if [ -s "$CODEX_HOOKS" ]; then
    cp "$CODEX_HOOKS" "$CODEX_HOOKS.bak.$(date +%s)"
fi
bun "$REPO_SCRIPTS_DIR/lib/ensure-codex-hooks.ts" "$CODEX_HOOKS" "$PLUGIN_DIR"
echo "    Codex tmux-agent-status hooks merged into ~/.codex/hooks.json"

# 6. Auto-install TPM plugins (replaces the manual "prefix + I" step)
if [ -x "$TPM_DIR/bin/install_plugins" ]; then
    echo "==> Running TPM install_plugins..."
    "$TPM_DIR/bin/install_plugins" 2>/dev/null || true
fi

# 7. Reload config + source plugin on every running tmux server
#    (so existing sessions pick up the status icons without a restart)
SOCKET_DIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
if [ -d "$SOCKET_DIR" ]; then
    echo "==> Reloading running tmux servers..."
    for socket in "$SOCKET_DIR"/*; do
        [ -S "$socket" ] || continue
        socket_name=$(basename "$socket")
        echo "    Socket: $socket_name"
        tmux -S "$socket" source-file "$TMUX_CONF" 2>/dev/null || true
        tmux -S "$socket" run-shell "$PLUGIN_DIR/tmux-agent-status.tmux" 2>/dev/null || true
        tmux -S "$socket" refresh-client -S 2>/dev/null || true
    done
fi

echo "==> Done."
echo ""
echo "Next steps:"
echo "  1. Existing tmux sessions have been reloaded automatically."
echo "  2. Restart any already-running Claude Code / Codex process so the new hooks load."
echo "  3. New prompts will then report status to tmux-agent-status via hooks."
