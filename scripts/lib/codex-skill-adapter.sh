#!/bin/bash
# Render a Claude Code slash-command markdown file as a Codex skill directory.
#
# Bridges two shapes:
#   Claude:  .claude/commands/<name>.md  (single file with `description:` frontmatter)
#   Codex:   <name>/SKILL.md             (dir with frontmatter + adapter + body)
#
# The adapter block tells Codex how to translate AskUserQuestion →
# request_user_input. Delegation policy lives in the synced skill-runner
# reference; keep this adapter as a pointer so policy does not drift in generated
# command wrappers.

# Emit the Codex skill adapter heredoc for a given skill name.
_codex_skill_adapter_block() {
    local skill_name="$1"
    cat <<ADAPTER
<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by mentioning \`\$$skill_name\`.
- Treat all user text after \`\$$skill_name\` as \`{{GSD_ARGS}}\`.
- If no arguments are present, treat \`{{GSD_ARGS}}\` as empty.

## B. AskUserQuestion → request_user_input Mapping
GSD workflows use \`AskUserQuestion\` (Claude Code syntax). Translate to Codex \`request_user_input\`:

Parameter mapping:
- \`header\` → \`header\`
- \`question\` → \`question\`
- Options formatted as \`"Label" — description\` → \`{label: "Label", description: "description"}\`
- Generate \`id\` from header: lowercase, replace spaces with underscores

Batched calls:
- \`AskUserQuestion([q1, q2])\` → single \`request_user_input\` with multiple entries in \`questions[]\`

Multi-select workaround:
- Codex has no \`multiSelect\`. Use sequential single-selects, or present a numbered freeform list asking the user to enter comma-separated numbers.

Execute mode fallback:
- When \`request_user_input\` is rejected (Execute mode), present a plain-text numbered list and pick a reasonable default.

## C. Task() / Subagent Policy
GSD workflows may mention \`Task(...)\` (Claude Code syntax). On Codex, follow
\`$skill-runner\`'s bundled Codex delegation policy
(\`skill-runner/references/codex-delegation.md\` in the synced skills tree).
That reference is the canonical source for native-subagent disablement, Paseo
probing, model choice, tmux/runner fallback, and worker-result inspection.
</codex_skill_adapter>
ADAPTER
}

# render_codex_skill <src_md> <dest_dir> <skill_name>
# Reads a Claude command .md file, writes <dest_dir>/SKILL.md.
render_codex_skill() {
    local src_md="$1" dest_dir="$2" skill_name="$3"

    local description body
    description=$(awk '/^---/{c++; next} c==1 && /^description:/{sub(/^description:[[:space:]]*/,""); print; exit}' "$src_md")
    body=$(awk 'BEGIN{c=0} /^---/{c++; next} c>=2{print}' "$src_md")

    mkdir -p "$dest_dir"
    {
        printf -- '---\n'
        printf 'name: "%s"\n' "$skill_name"
        printf 'description: "%s"\n' "$description"
        printf 'metadata:\n'
        printf '  short-description: "%s"\n' "$description"
        printf -- '---\n\n'
        _codex_skill_adapter_block "$skill_name"
        printf '\n'
        printf '%s\n' "$body"
    } > "$dest_dir/SKILL.md"
}

# render_mimocode_command <src_skill_md> <dest_md> <name>
# Renders a MiMoCode slash-command wrapper for a repo-owned skill. MiMoCode
# discovers skills natively via ~/.codex/skills, so the command only needs to
# tell the agent to load the skill (no Codex adapter block). Reads the skill's
# own `description:` frontmatter so the / menu shows meaningful help.
render_mimocode_command() {
    local src_md="$1" dest_md="$2" name="$3"

    # Extract the skill's `description:` from frontmatter. Handles both inline
    # (`description: text`) and YAML block scalar (`description: |` followed by
    # indented lines) forms, collapsing block scalars to a single line.
    local description
    description=$(awk '
        /^---/ { c++; next }
        c == 1 && /^description:[[:space:]]*$/ { next }
        c == 1 && /^description:[[:space:]]*[|>]/ {
            block = 1; next
        }
        c == 1 && block && /^[[:space:]]+/ {
            sub(/^[[:space:]]+/, ""); printf "%s%s", (n++ ? " " : ""), $0; next
        }
        c == 1 && block { exit }
        c == 1 && /^description:/ {
            sub(/^description:[[:space:]]*/, "");
            gsub(/^"|"$/, "");
            print; exit
        }
    ' "$src_md")
    if [ -z "$description" ]; then
        description="Load and run the $name skill."
    fi
    # Escape embedded double quotes for safe YAML double-quoted scalar output.
    description=${description//\"/\\\"}

    mkdir -p "$(dirname "$dest_md")"
    {
        printf -- '---\n'
        printf 'description: "%s"\n' "$description"
        printf -- '---\n\n'
        printf 'Load and run the `%s` skill.\n\n' "$name"
        printf 'User input: $ARGUMENTS\n'
    } > "$dest_md"
}
