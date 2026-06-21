#!/usr/bin/env python3
"""Run a skill-driven task in a supervised non-interactive tmux agent session."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shlex
import subprocess
import time
from pathlib import Path


DEFAULT_SKILL_REPO = Path(__file__).resolve().parents[3]
DEFAULT_CACHE_ROOT = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "skill-runner"
DEFAULT_RUN_ROOT = DEFAULT_CACHE_ROOT / "runs"
DEFAULT_TIMEOUT_MINUTES = 600.0
DEFAULT_IDLE_TIMEOUT_MINUTES = 20.0
RESULT_STATUS_PATTERN = re.compile(
    r"^\s*RESULT_STATUS:\s*(SUCCESS|PARTIAL|BLOCKED_NEEDS_DECISION|FAILED)\b",
    re.I | re.M,
)
ANSI_ESCAPE_PATTERN = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)")

RISK_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("missing-agent-cli", re.compile(r"\b(codex|claude): command not found\b", re.I)),
    ("sandbox-loopback-denied", re.compile(r"bwrap:\s+loopback:\s+Failed RTM_NEWADDR:\s+Operation not permitted", re.I)),
    (
        "auth-required",
        re.compile(
            r"(authentication required|not authenticated|login required|please run .*\blogin\b|"
            r"api key (is )?(required|missing|not set)|401 unauthorized)",
            re.I,
        ),
    ),
    ("context-exhausted", re.compile(r"(context length|maximum context|too many tokens)", re.I)),
    ("noninteractive-approval", re.compile(r"(approval required|cannot prompt|requires confirmation)", re.I)),
)


def main() -> int:
    args = parse_args()
    if args.finalize_run:
        return finalize_existing_run(
            run_dir=Path(args.finalize_run).expanduser().resolve(),
            skill_repo=Path(args.skill_repo).expanduser().resolve(),
        )

    if args.prompt and args.prompt[0] == "--":
        args.prompt = args.prompt[1:]
    prompt = " ".join(args.prompt).strip()
    if not prompt:
        print("error: provide a task prompt after --", file=os.sys.stderr)
        return 2

    cwd = Path(args.cwd).expanduser().resolve()
    skill_repo = Path(args.skill_repo).expanduser().resolve()
    run_dir = make_run_dir(args.run_root, cwd, prompt)
    run_dir.mkdir(parents=True, exist_ok=False)

    skills = detect_skills(prompt)
    owned_paths = normalize_owned_paths(args.owned_path, cwd)
    rewritten = rewrite_prompt(prompt=prompt, skills=skills, cwd=cwd, owned_paths=owned_paths)
    workspace_status_before = git_status(cwd)
    session = args.session or default_session_name(run_dir)
    tmux_socket_name = isolated_tmux_socket_name(run_dir)

    write_text(run_dir / "input.md", prompt + "\n")
    write_text(run_dir / "rewritten-prompt.md", rewritten)
    write_json(
        run_dir / "run.json",
        {
            "agent": args.agent,
            "cwd": str(cwd),
            "dangerous": bool(args.dangerous),
            "execution_mode": "exec",
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "owned_paths": owned_paths,
            "session": session,
            "tmux_socket_name": tmux_socket_name,
            "skills": skills,
        },
    )

    if args.dry_run:
        write_result(run_dir, session, "DRY_RUN", "Prompt rewritten; worker not started.", tmux_socket_name)
        write_eval(
            run_dir,
            cwd,
            skill_repo,
            "DRY_RUN",
            0,
            "No worker run executed.",
            workspace_status_before=workspace_status_before,
            owned_paths=owned_paths,
        )
        write_skill_review(run_dir, cwd, skill_repo, skills, "DRY_RUN", "Prompt rewritten; worker not started.")
        print(run_dir)
        return 0

    write_run_script(run_dir, args, cwd)
    start_tmux(session=session, run_dir=run_dir, cwd=cwd, socket_name=tmux_socket_name)
    status, exit_code, reason = wait_for_worker(
        session=session,
        run_dir=run_dir,
        args=args,
        socket_name=tmux_socket_name,
    )
    materialize_last_message(run_dir)

    if args.sync_on_skill_change:
        maybe_sync_skill_changes(skill_repo)
    if args.commit_skill_changes:
        maybe_commit_skill_changes(skill_repo)

    write_result(run_dir, session, status, reason, tmux_socket_name)
    write_eval(
        run_dir,
        cwd,
        skill_repo,
        status,
        exit_code,
        reason,
        workspace_status_before=workspace_status_before,
        owned_paths=owned_paths,
    )
    write_skill_review(run_dir, cwd, skill_repo, skills, status, reason)
    print(run_dir)
    return exit_code


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent", choices=("codex", "claude"), default="codex")
    parser.add_argument("--cwd", default=os.getcwd())
    parser.add_argument("--session")
    parser.add_argument("--run-root", default=str(DEFAULT_RUN_ROOT))
    parser.add_argument("--skill-repo", default=str(DEFAULT_SKILL_REPO))
    parser.add_argument("--timeout-min", type=float, default=DEFAULT_TIMEOUT_MINUTES)
    parser.add_argument("--idle-timeout-min", type=float, default=DEFAULT_IDLE_TIMEOUT_MINUTES)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--dangerous", action="store_true")
    parser.add_argument("--poll-interval-sec", type=float, default=5.0, help=argparse.SUPPRESS)
    parser.add_argument("--agent-command", help=argparse.SUPPRESS)
    parser.add_argument(
        "--finalize-run",
        help="Rewrite result.md/eval.md/skill-review.md for an existing run directory.",
    )
    parser.add_argument(
        "--owned-path",
        action="append",
        default=[],
        help="Path owned by this worker. Repeat to split eval.md owned vs pre-existing diff.",
    )
    parser.add_argument("--sync-on-skill-change", action="store_true")
    parser.add_argument("--commit-skill-changes", action="store_true")
    parser.add_argument("prompt", nargs=argparse.REMAINDER)
    return parser.parse_args()


def make_run_dir(run_root: str, cwd: Path, prompt: str) -> Path:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    repo_slug = slug(cwd.name)
    prompt_slug = slug(prompt)[:48] or "task"
    return Path(run_root).expanduser().resolve() / f"{stamp}-{repo_slug}-{prompt_slug}"


def default_session_name(run_dir: Path) -> str:
    return "skill-runner-" + run_dir.name[:80]


def isolated_tmux_socket_name(run_dir: Path) -> str:
    digest = hashlib.sha1(str(run_dir).encode("utf-8")).hexdigest()[:16]
    return f"skill-runner-{digest}"


def tmux_command(socket_name: str | None, *args: str) -> list[str]:
    if socket_name:
        return ["tmux", "-L", socket_name, *args]
    return ["tmux", *args]


def slug(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-").lower()
    return value or "run"


def detect_skills(prompt: str) -> list[str]:
    found: list[str] = []
    for match in re.findall(r"\$([A-Za-z][A-Za-z0-9_-]*)", prompt):
        if match not in found:
            found.append(match)
    for match in re.findall(r"\b(gsd-[A-Za-z0-9_-]+)\b", prompt):
        if match not in found:
            found.append(match)
    return found


def normalize_owned_paths(paths: list[str], cwd: Path) -> list[str]:
    normalized: list[str] = []
    for raw in paths:
        text = str(raw).strip()
        if not text:
            continue
        path = Path(text).expanduser()
        if path.is_absolute():
            try:
                text = path.resolve().relative_to(cwd).as_posix()
            except ValueError:
                text = path.as_posix()
        else:
            text = path.as_posix()
        text = text.strip("/")
        if text and text not in normalized:
            normalized.append(text)
    return normalized


def rewrite_prompt(*, prompt: str, skills: list[str], cwd: Path, owned_paths: list[str]) -> str:
    selected = ", ".join(f"${s}" for s in skills) if skills else "none explicitly named"
    owned_text = "\n".join(f"- {path}" for path in owned_paths) if owned_paths else "none specified"
    return f"""Objective:
{prompt}

Selected skills:
{selected}

Workspace:
{cwd}

Owned paths:
{owned_text}

Context package:
- Must inspect first: the user objective, any approved plan/contract it names,
  the selected skill instructions, and the smallest relevant live repo files or
  logs needed to prove the task.
- Useful evidence: recent diffs, tests, docs, issues, run artifacts, or command
  output directly tied to the objective.
- Do not inspect unless needed: broad historical archives, unrelated generated
  output, unrelated vendored dependencies, or the custom skill source repo when
  the task workspace is a product repo.

Acceptance contract:
- SUCCESS only if: the task-specific acceptance criteria in the user objective
  or approved plan are satisfied with observable evidence, not just attempted.
- PARTIAL if: useful scoped work lands but any acceptance criterion, required
  verification, or user-visible behavior remains incomplete or unproven.
- BLOCKED_NEEDS_DECISION if: success criteria, scope, non-goals, route, or an
  external gate are unclear enough that implementation would require guessing
  what the user wants.
- Must not regress: preserve existing public behavior, documented commands,
  tests, contracts, and unrelated user changes unless the objective explicitly
  approves changing them.

Operating contract:
- Treat the workspace above as the task/product repo and apply the selected
  skill workflows there.
- Do not substitute the custom skill source repo for the task workspace merely
  because the prompt mentions a skill file or installed skill copy.
- If the workspace appears wrong for the user objective, stop and report
  BLOCKED_NEEDS_DECISION instead of doing a plausible task in the wrong repo.
- Use the selected skill workflows honestly. If a named skill is unavailable, say so and stop.
- Keep the work KISS: smallest useful change, fewest artifacts, clear stop condition.
- If the prompt lacks task-specific acceptance criteria, stop early and report
  BLOCKED_NEEDS_DECISION with the missing acceptance questions or a proposed
  `$intuitive-preflight` draft. Do not infer SUCCESS from relevant tests alone.
- If the prompt lacks required context, stop early and report
  BLOCKED_NEEDS_DECISION with the missing files, plans, issues, logs, artifacts,
  commands, or a proposed `$intuitive-preflight` context package.
- Preserve unrelated user changes. Do not revert work you did not make.
- If owned paths are listed, limit edits to those paths unless the task becomes
  impossible without a clearly named adjacent change.
- Do not edit custom skills unless the objective explicitly asks for skill work.
- Do not edit third-party/system skills directly.
- Commit only when the user's prompt or repo workflow asks for a commit.
- If blocked by credentials, paid APIs, local hardware, Docker, GPU, or a human decision, stop and report BLOCKED_NEEDS_DECISION.
- If you realize the current goal is wrong, too broad, looping, or sending you
  away from the requested artifact, stop and report PARTIAL or
  BLOCKED_NEEDS_DECISION with the corrected goal you recommend. Do not spend a
  long run trying to make a bad goal work.

Skill-specific guardrails:
- For $intuitive-flow: one phase is one coherent delivery unit. Do not create more than three phases from this prompt without stopping for grouping approval. Use tasks/checklists for blockers, proof retries, diagnostics, and small report/checker changes.
- For $intuitive-refactor changed-code review: review the actual changed scope only. Do not expand into broad architecture discovery.
- For GSD work: do not hand-write .planning artifacts and claim a downstream GSD skill produced them.

Verification:
- Run the most relevant fast checks available for the changed scope.
- If a required check is skipped, explain exactly why.
- Do not claim completion from intent, effort, or proxy signals alone.

Final response format:
RESULT_STATUS: SUCCESS | PARTIAL | BLOCKED_NEEDS_DECISION | FAILED
SUMMARY: <short description>
CHANGED_FILES: <files or "none">
COMMITS: <hashes or "none">
VERIFICATION: <commands and results>
OPEN_DECISIONS: <remaining decisions or "none">
SKILL_BEHAVIOR_NOTES: <reusable skill issue candidates or "none">
ACCEPTANCE_EVIDENCE: <how each SUCCESS-only-if condition was proven, or "incomplete">
RECOMMENDED_GOAL_REVISION: <only if the current goal or prompt should be changed; otherwise "none">
"""


def write_run_script(run_dir: Path, args: argparse.Namespace, cwd: Path) -> None:
    prompt_path = run_dir / "rewritten-prompt.md"
    exit_path = run_dir / "exit_code"
    if args.agent_command:
        command = shlex.split(str(args.agent_command))
    elif args.agent == "codex":
        command = [
            "codex",
            "exec",
            "--cd",
            str(cwd),
            "--json",
            "--output-last-message",
            str(run_dir / "last-message.md"),
        ]
        if args.dangerous:
            command.append("--dangerously-bypass-approvals-and-sandbox")
        else:
            command.extend(["--sandbox", "workspace-write"])
        command.append("-")
    else:
        command = [
            "claude",
            "-p",
            "--output-format",
            "stream-json",
            "--permission-mode",
            "auto",
        ]
        if args.dangerous:
            command.append("--dangerously-skip-permissions")

    quoted = " ".join(shlex.quote(part) for part in command)
    script = f"""#!/usr/bin/env bash
set -u
cd {shlex.quote(str(cwd))}
echo $$ > {shlex.quote(str(run_dir / "worker.pid"))}
echo running > {shlex.quote(str(run_dir / "status"))}
set +e
{quoted} < {shlex.quote(str(prompt_path))} 2> >(tee {shlex.quote(str(run_dir / "stderr.log"))} >&2) | tee {shlex.quote(str(run_dir / "events.jsonl"))}
code=${{PIPESTATUS[0]}}
echo "$code" > {shlex.quote(str(exit_path))}
if [ "$code" -eq 0 ]; then
  echo complete > {shlex.quote(str(run_dir / "status"))}
else
  echo failed > {shlex.quote(str(run_dir / "status"))}
fi
exit "$code"
"""
    run_script = run_dir / "run.sh"
    write_text(run_script, script)
    run_script.chmod(0o755)


def start_tmux(*, session: str, run_dir: Path, cwd: Path, socket_name: str) -> None:
    run_script = run_dir / "run.sh"
    subprocess.run(
        tmux_command(socket_name, "new-session", "-d", "-s", session, "-c", str(cwd), "bash", str(run_script)),
        check=True,
    )
    subprocess.run(
        tmux_command(socket_name, "pipe-pane", "-o", "-t", session, f"cat >> {shlex.quote(str(run_dir / 'terminal.log'))}"),
        check=False,
    )


def wait_for_worker(*, session: str, run_dir: Path, args: argparse.Namespace, socket_name: str) -> tuple[str, int, str]:
    started = time.monotonic()
    last_activity = time.monotonic()
    last_size = -1
    exit_path = run_dir / "exit_code"
    timeout = args.timeout_min * 60
    idle_timeout = args.idle_timeout_min * 60

    while True:
        if exit_path.exists():
            code = read_exit_code(exit_path)
            return classify_worker_exit(run_dir, code)

        if not tmux_has_session(session, socket_name):
            if exit_path.exists():
                code = read_exit_code(exit_path)
                return classify_worker_exit(run_dir, code)
            return "FAILED", 1, "tmux session ended without exit_code"

        current_size = log_size(run_dir)
        if current_size != last_size:
            last_activity = time.monotonic()
            last_size = current_size

        if time.monotonic() - started > timeout:
            stop_session(session, run_dir, "timeout", socket_name)
            return "FAILED", 124, f"timeout after {args.timeout_min:g} minutes"

        if time.monotonic() - last_activity > idle_timeout:
            stop_session(session, run_dir, "idle-timeout", socket_name)
            return "FAILED", 124, f"idle timeout after {args.idle_timeout_min:g} minutes"

        risk = detect_risk(run_dir)
        if risk:
            stop_session(session, run_dir, risk, socket_name)
            return "BLOCKED", 125, f"auto-stopped: {risk}"

        time.sleep(max(0.1, float(args.poll_interval_sec)))


def tmux_has_session(session: str, socket_name: str | None = None) -> bool:
    return subprocess.run(
        tmux_command(socket_name, "has-session", "-t", session),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0


def stop_session(session: str, run_dir: Path, reason: str, socket_name: str | None = None) -> None:
    capture_path = run_dir / "pane-before-stop.log"
    with capture_path.open("w", encoding="utf-8") as fh:
        subprocess.run(
            tmux_command(socket_name, "capture-pane", "-p", "-S", "-2000", "-t", session),
            stdout=fh,
            stderr=subprocess.DEVNULL,
        )
    write_text(run_dir / "stopped_reason", reason + "\n")
    subprocess.run(tmux_command(socket_name, "kill-session", "-t", session), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    write_text(run_dir / "exit_code", "125\n")
    write_text(run_dir / "status", "stopped\n")


def classify_worker_exit(run_dir: Path, code: int) -> tuple[str, int, str]:
    worker_status = read_worker_result_status(run_dir)
    if worker_status == "SUCCESS":
        return "SUCCESS", 0, f"worker reported RESULT_STATUS: SUCCESS; cli exit code {code}"
    if worker_status == "PARTIAL":
        return "PARTIAL", 0, f"worker reported RESULT_STATUS: PARTIAL; cli exit code {code}"
    if worker_status == "BLOCKED_NEEDS_DECISION":
        return "BLOCKED", 125, (
            f"worker reported RESULT_STATUS: BLOCKED_NEEDS_DECISION; cli exit code {code}"
        )
    if worker_status == "FAILED":
        return "FAILED", 1, f"worker reported RESULT_STATUS: FAILED; cli exit code {code}"
    status = "SUCCESS" if code == 0 else "FAILED"
    return status, code, f"worker exited with code {code}"


def read_worker_result_status(run_dir: Path) -> str | None:
    for name in ("last-message.md", "events.jsonl", "terminal.log"):
        path = run_dir / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if name == "terminal.log":
            text = strip_ansi(text)
        match = RESULT_STATUS_PATTERN.search(text)
        if match:
            return match.group(1).upper()
    return None


def materialize_last_message(run_dir: Path) -> None:
    target = run_dir / "last-message.md"
    if target.exists() and target.read_text(encoding="utf-8", errors="replace").strip():
        return
    for name in ("events.jsonl", "terminal.log"):
        path = run_dir / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if name == "terminal.log":
            text = strip_ansi(text)
        if RESULT_STATUS_PATTERN.search(text):
            write_text(target, text[-12000:].lstrip())
            return


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE_PATTERN.sub("", text)


def log_size(run_dir: Path) -> int:
    total = 0
    for name in ("events.jsonl", "stderr.log", "terminal.log"):
        path = run_dir / name
        if path.exists():
            total += path.stat().st_size
    return total


def detect_risk(run_dir: Path) -> str | None:
    text = read_log_tail(run_dir / "stderr.log")
    for label, pattern in RISK_PATTERNS:
        if pattern.search(text):
            return label
    return None


def read_log_tail(path: Path, limit: int = 8000) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")[-limit:]


def read_exit_code(path: Path) -> int:
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except Exception:
        return 1


def finalize_existing_run(*, run_dir: Path, skill_repo: Path) -> int:
    metadata = load_run_metadata(run_dir)
    cwd = Path(str(metadata.get("cwd") or os.getcwd())).expanduser().resolve()
    session = str(metadata.get("session") or default_session_name(run_dir))
    socket_name = metadata.get("tmux_socket_name")
    socket_name = str(socket_name) if isinstance(socket_name, str) and socket_name else None
    skills = [str(item) for item in metadata.get("skills", []) if isinstance(item, str)]
    owned_paths = [str(item) for item in metadata.get("owned_paths", []) if isinstance(item, str)]
    if (run_dir / "exit_code").exists():
        code = read_exit_code(run_dir / "exit_code")
        materialize_last_message(run_dir)
        status, exit_code, reason = classify_worker_exit(run_dir, code)
    elif tmux_has_session(session, socket_name):
        status, exit_code, reason = "RUNNING", 0, "Worker session is still running."
    else:
        status, exit_code, reason = "FAILED", 1, "tmux session ended without exit_code"
    write_result(run_dir, session, status, reason, socket_name)
    write_eval(run_dir, cwd, skill_repo, status, exit_code, reason, owned_paths=owned_paths)
    write_skill_review(run_dir, cwd, skill_repo, skills, status, reason)
    print(run_dir)
    return exit_code


def load_run_metadata(run_dir: Path) -> dict[str, object]:
    try:
        data = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def write_result(run_dir: Path, session: str, status: str, reason: str, socket_name: str | None = None) -> None:
    attach_command = (
        f"tmux -L {shlex.quote(socket_name)} attach -t {shlex.quote(session)}"
        if socket_name
        else f"tmux attach -t {shlex.quote(session)}"
    )
    write_text(
        run_dir / "result.md",
        f"""# Skill Runner Result

- Status: {status}
- Reason: {reason}
- Tmux session: `{session}`
- Attach command: `{attach_command}`

Review `last-message.md`, `eval.md`, and targeted log excerpts before relying
on this run.
""",
    )


def write_eval(
    run_dir: Path,
    cwd: Path,
    skill_repo: Path,
    status: str,
    exit_code: int,
    reason: str,
    *,
    workspace_status_before: str = "",
    owned_paths: list[str] | None = None,
) -> None:
    workspace_status = git_status(cwd)
    skill_status = git_status(skill_repo, ["--", "skills"])
    verdict = skill_diff_verdict("", skill_status)
    owned_paths = owned_paths or []
    ownership_sections = ""
    if owned_paths:
        owned_status, outside_status = split_status_by_owned_paths(workspace_status, owned_paths)
        pre_existing_status = diff_status_lines(workspace_status_before, workspace_status)
        ownership_sections = f"""
## Owned Path Diff

Owned paths:

```text
{chr(10).join(owned_paths)}
```

Owned changes:

```text
{owned_status or "clean"}
```

Outside owned paths:

```text
{outside_status or "clean"}
```

Pre-run status no longer present:

```text
{pre_existing_status or "none"}
```
"""
    write_text(
        run_dir / "eval.md",
        f"""# Skill Runner Evaluation

## Run

- Status: {status}
- Exit code: {exit_code}
- Reason: {reason}

## Workspace Diff

```text
{workspace_status or "clean"}
```
{ownership_sections}

## Custom Skill Diff

```text
{skill_status or "clean"}
```

## Skill Patch Verdict

{verdict}

Patch a skill only for reusable workflow defects. Prefer deleting, simplifying,
or moving detail to a script/reference before adding new rules.
""",
    )


def write_skill_review(
    run_dir: Path,
    cwd: Path,
    skill_repo: Path,
    skills: list[str],
    status: str,
    reason: str,
) -> None:
    workspace_skill_status = git_status(cwd, ["--", "skills"])
    custom_skill_status = git_status(skill_repo, ["--", "skills"])
    notes = extract_final_field(run_dir, "SKILL_BEHAVIOR_NOTES")
    recommendation = skill_review_recommendation(
        status=status,
        notes=notes,
        workspace_skill_status=workspace_skill_status,
        custom_skill_status=custom_skill_status,
    )
    selected_skills = ", ".join(f"${skill}" for skill in skills) if skills else "none detected"
    notes_text = notes or "none"
    write_text(
        run_dir / "skill-review.md",
        f"""# Skill Runner Skill Review

## Run

- Status: {status}
- Reason: {reason}
- Selected skills: {selected_skills}

## Worker Skill Behavior Notes

{notes_text}

## Workspace Skill Diff

```text
{workspace_skill_status or "clean"}
```

## Custom Skill Source Diff

```text
{custom_skill_status or "clean"}
```

## Recommendation

{recommendation}

## User Decision

Choose one after reviewing this run and the actual diff:

- `NO_SKILL_CHANGE` - behavior was acceptable or the issue was task-specific.
- `RECORD_LEARNING` - keep as a candidate learning; do not edit a skill yet.
- `PATCH_REPO_SKILL` - update a repo-local skill source under `skills/`.
- `PATCH_CUSTOM_SKILL` - update the shared custom skill source in the skill repo.
- `FIX_RUNNER` - change skill-runner mechanics or artifact parsing.
""",
    )


def skill_review_recommendation(
    *,
    status: str,
    notes: str,
    workspace_skill_status: str,
    custom_skill_status: str,
) -> str:
    has_skill_diff = skill_diff_verdict(workspace_skill_status, custom_skill_status) == "REVIEW_REQUIRED"
    normalized_notes = notes.strip().lower()
    if has_skill_diff:
        return (
            "REVIEW_REQUIRED: this run changed skill source files. Inspect whether the "
            "skill change is general, small, verified, and separate from product-task work."
        )
    if normalized_notes and normalized_notes not in {"none", "n/a", "na"}:
        return (
            "CANDIDATE_LEARNING: the worker reported skill behavior notes. Review them "
            "across runs before deciding whether to patch a skill."
        )
    if status in {"FAILED", "BLOCKED"}:
        return (
            "NO_SKILL_CHANGE by default: the run did not identify a reusable skill "
            "defect. Inspect logs only if the failure pattern repeats."
        )
    return "NO_SKILL_CHANGE: no reusable skill issue was reported."


def skill_diff_verdict(workspace_skill_status: str, custom_skill_status: str) -> str:
    statuses = (workspace_skill_status.strip(), custom_skill_status.strip())
    has_real_diff = any(status and status != "not a git worktree" for status in statuses)
    return "REVIEW_REQUIRED" if has_real_diff else "NO_SKILL_CHANGE"


def split_status_by_owned_paths(status: str, owned_paths: list[str]) -> tuple[str, str]:
    owned: list[str] = []
    outside: list[str] = []
    for line in status.splitlines():
        if not line.strip():
            continue
        path = git_status_path(line)
        target = owned if path_matches_owned(path, owned_paths) else outside
        target.append(line)
    return "\n".join(owned), "\n".join(outside)


def git_status_path(line: str) -> str:
    text = line[3:] if len(line) > 3 else line.strip()
    if " -> " in text:
        text = text.rsplit(" -> ", 1)[1]
    return text.strip()


def path_matches_owned(path: str, owned_paths: list[str]) -> bool:
    normalized = path.strip("/")
    for owned in owned_paths:
        candidate = owned.strip("/")
        if normalized == candidate or normalized.startswith(candidate + "/"):
            return True
    return False


def diff_status_lines(before: str, after: str) -> str:
    before_set = {line for line in before.splitlines() if line.strip()}
    after_set = {line for line in after.splitlines() if line.strip()}
    return "\n".join(sorted(before_set - after_set))


def extract_final_field(run_dir: Path, field: str) -> str:
    text = final_message_text(run_dir)
    if not text:
        return ""
    pattern = re.compile(
        rf"(?ims)^\s*{re.escape(field)}\s*:\s*(.*?)(?=^\s*[A-Z_]+\s*:|\Z)"
    )
    match = pattern.search(text)
    if not match:
        return ""
    return match.group(1).strip()


def final_message_text(run_dir: Path) -> str:
    for name in ("last-message.md", "events.jsonl", "terminal.log"):
        path = run_dir / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        return strip_ansi(text) if name == "terminal.log" else text
    return ""


def git_status(cwd: Path, extra: list[str] | None = None) -> str:
    is_worktree = subprocess.run(
        ["git", "-C", str(cwd), "rev-parse", "--is-inside-work-tree"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    if is_worktree.returncode != 0:
        return "not a git worktree"
    cmd = ["git", "-C", str(cwd), "status", "--short"]
    if extra:
        cmd.extend(extra)
    result = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return result.stdout.strip()


def maybe_sync_skill_changes(skill_repo: Path) -> None:
    if not git_status(skill_repo, ["--", "skills"]).strip():
        return
    script = skill_repo / "scripts" / "tasks" / "sync-local-commands-skills.sh"
    if script.exists():
        subprocess.run([str(script)], cwd=str(skill_repo), check=False)


def maybe_commit_skill_changes(skill_repo: Path) -> None:
    if not git_status(skill_repo, ["--", "skills"]).strip():
        return
    subprocess.run(["git", "-C", str(skill_repo), "add", "skills"], check=False)
    subprocess.run(
        ["git", "-C", str(skill_repo), "commit", "-m", "docs: refine custom skills"],
        check=False,
    )


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, data: object) -> None:
    write_text(path, json.dumps(data, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
