#!/usr/bin/env python3
"""Run a skill-driven task in a supervised tmux agent session."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import shlex
import subprocess
import sys
import time
from pathlib import Path


DEFAULT_SKILL_REPO = Path(__file__).resolve().parents[3]
DEFAULT_CACHE_ROOT = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "skill-runner"
DEFAULT_RUN_ROOT = DEFAULT_CACHE_ROOT / "runs"
DEFAULT_TIMEOUT_MINUTES = 600.0
DEFAULT_IDLE_TIMEOUT_MINUTES = 20.0
SANDBOX_CAPABILITY_CACHE = DEFAULT_CACHE_ROOT / "sandbox-capability.json"
SANDBOX_CACHE_SCHEMA_VERSION = 1
COMMAND_PROBE_TIMEOUT_SECONDS = 5
SANDBOX_LOOPBACK_PATTERN = re.compile(
    r"bwrap:\s+loopback:\s+Failed RTM_NEWADDR:\s+Operation not permitted",
    re.I,
)
# ANSI CSI (cursor moves, SGR colors, etc.) plus OSC (terminal-title) sequences.
ANSI_ESCAPE_PATTERN = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)")
RESULT_STATUS_PATTERN = re.compile(
    r"^\s*RESULT_STATUS:\s*(SUCCESS|PARTIAL|BLOCKED_NEEDS_DECISION|FAILED)\b",
    re.I | re.M,
)
TERMINAL_RESULT_STATUS_PATTERN = re.compile(
    r"RESULT_STATUS:\s*(SUCCESS|PARTIAL|BLOCKED_NEEDS_DECISION|FAILED)\b",
    re.I,
)
SANDBOX_DETECTION_LOGS = (
    "stderr.log",
    "last-message.md",
    "terminal.log",
    "events.jsonl",
    "pane-before-stop.log",
)
SANDBOX_SYSCTL_PATHS = {
    "kernel.unprivileged_userns_clone": "/proc/sys/kernel/unprivileged_userns_clone",
    "user.max_user_namespaces": "/proc/sys/user/max_user_namespaces",
    "kernel.apparmor_restrict_unprivileged_userns": "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",
}
SANDBOX_CACHEABLE_STATUSES = {"available", "loopback_unavailable"}


RISK_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("missing-agent-cli", re.compile(r"\b(codex|claude): command not found\b", re.I)),
    ("sandbox-loopback-denied", SANDBOX_LOOPBACK_PATTERN),
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
    (
        "interactive-approval",
        re.compile(r"(Action Required|Would you like to run the following command\?)", re.I),
    ),
)


def main() -> int:
    args = parse_args()
    if args.prompt and args.prompt[0] == "--":
        args.prompt = args.prompt[1:]
    prompt = " ".join(args.prompt).strip()
    if not prompt:
        print("error: provide a task prompt after --", file=sys.stderr)
        return 2

    cwd = Path(args.cwd).expanduser().resolve()
    skill_repo = Path(args.skill_repo).expanduser().resolve()
    run_dir = make_run_dir(args.run_root, cwd, prompt)
    run_dir.mkdir(parents=True, exist_ok=False)

    skills = detect_skills(prompt)
    rewritten = rewrite_prompt(prompt=prompt, skills=skills, cwd=cwd)

    write_text(run_dir / "input.md", prompt + "\n")
    write_text(run_dir / "rewritten-prompt.md", rewritten)
    workspace_status_before = git_status(cwd)
    session = args.session or default_session_name(run_dir)
    sandbox_decision = resolve_sandbox_decision(args=args, cwd=cwd, run_dir=run_dir)
    write_json(
        run_dir / "run.json",
        {
            "agent": args.agent,
            "cwd": str(cwd),
            "execution_mode": "interactive" if args.interactive else "exec",
            "goal": args.goal,
            "skills": skills,
            "session": session,
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "auto_retry_sandbox_failure": args.auto_retry_sandbox_failure,
            "sandbox": sandbox_decision,
        },
    )
    write_sandbox_report(run_dir, sandbox_decision)

    if sandbox_decision.get("blocked"):
        reason = str(sandbox_decision["reason"])
        write_result(run_dir, session, "BLOCKED", reason)
        write_eval(run_dir, cwd, skill_repo, "BLOCKED", 125, reason)
        write_skill_review(run_dir, cwd, skill_repo, skills, "BLOCKED", reason)
        print(run_dir)
        return 125

    initial_dangerous = bool(sandbox_decision["dangerous"])
    write_run_script(run_dir, args, cwd, dangerous=initial_dangerous)

    if args.dry_run:
        write_result(run_dir, session, "DRY_RUN", "Prompt rewritten; tmux session not started.")
        write_eval(run_dir, cwd, skill_repo, "DRY_RUN", 0, "No worker run executed.")
        write_skill_review(
            run_dir,
            cwd,
            skill_repo,
            skills,
            "DRY_RUN",
            "Prompt rewritten; tmux session not started.",
        )
        print(run_dir)
        return 0

    start_tmux(session=session, run_dir=run_dir, cwd=cwd)
    if args.interactive:
        try:
            start_interactive_worker(session=session, run_dir=run_dir, args=args)
        except RuntimeError as exc:
            reason = f"interactive prompt injection failed: {exc}"
            stop_session(session, run_dir, reason)
            write_result(run_dir, session, "BLOCKED", reason)
            write_eval(run_dir, cwd, skill_repo, "BLOCKED", 125, reason)
            write_skill_review(run_dir, cwd, skill_repo, skills, "BLOCKED", reason)
            print(run_dir)
            return 125

    if args.detach:
        if args.interactive and not args.no_detached_supervisor:
            supervisor_pid = spawn_detached_supervisor(
                args=args,
                cwd=cwd,
                skill_repo=skill_repo,
                run_dir=run_dir,
                session=session,
                skills=skills,
                workspace_status_before=workspace_status_before,
                initial_dangerous=initial_dangerous,
            )
            write_result(
                run_dir,
                session,
                "DETACHED",
                f"Worker session started; detached supervisor (pid {supervisor_pid}) "
                "will close the session on RESULT_STATUS and update result.md.",
            )
            print(f"session: {session}")
            print(f"run_dir: {run_dir}")
            print(f"supervisor: {supervisor_pid}")
            print(f"attach: tmux attach -t {shlex.quote(session)}")
            return 0

        write_result(run_dir, session, "DETACHED", "Worker session started and left running.")
        print(f"session: {session}")
        print(f"run_dir: {run_dir}")
        print(f"attach: tmux attach -t {shlex.quote(session)}")
        return 0

    return supervise_to_completion(
        args=args,
        cwd=cwd,
        skill_repo=skill_repo,
        run_dir=run_dir,
        session=session,
        skills=skills,
        workspace_status_before=workspace_status_before,
        initial_dangerous=initial_dangerous,
    )


def supervise_to_completion(
    *,
    args: argparse.Namespace,
    cwd: Path,
    skill_repo: Path,
    run_dir: Path,
    session: str,
    skills: list[str],
    workspace_status_before: str,
    initial_dangerous: bool,
) -> int:
    status, exit_code, reason = wait_for_worker(session=session, run_dir=run_dir, args=args)
    if should_retry_sandbox_failure(
        args,
        run_dir,
        cwd,
        workspace_status_before,
        initial_dangerous=initial_dangerous,
    ):
        retry_session = retry_session_name(session)
        archive_attempt_logs(run_dir, "attempt-1")
        write_text(
            run_dir / "auto-retry.md",
            "Initial Codex run hit the known bwrap loopback sandbox failure. "
            "The workspace git status was unchanged, so skill-runner retried "
            "once with --dangerously-bypass-approvals-and-sandbox.\n",
        )
        cache_sandbox_result(
            cache_path=Path(args.sandbox_capability_cache).expanduser().resolve(),
            key=sandbox_cache_key(),
            status="loopback_unavailable",
            reason="main worker hit the known Codex bwrap loopback sandbox failure",
            source_run_dir=run_dir,
        )
        write_run_script(run_dir, args, cwd, dangerous=True)
        start_tmux(session=retry_session, run_dir=run_dir, cwd=cwd)
        if args.interactive:
            try:
                start_interactive_worker(session=retry_session, run_dir=run_dir, args=args)
            except RuntimeError as exc:
                retry_reason = f"interactive retry prompt injection failed: {exc}"
                stop_session(retry_session, run_dir, retry_reason)
                status, exit_code = "BLOCKED", 125
            else:
                status, exit_code, retry_reason = wait_for_worker(
                    session=retry_session,
                    run_dir=run_dir,
                    args=args,
                )
        else:
            status, exit_code, retry_reason = wait_for_worker(
                session=retry_session,
                run_dir=run_dir,
                args=args,
            )
        session = retry_session
        reason = f"auto-retried sandbox-loopback-denied; retry result: {retry_reason}"

    if args.sync_on_skill_change:
        maybe_sync_skill_changes(skill_repo)
    if args.commit_skill_changes:
        maybe_commit_skill_changes(skill_repo)

    write_result(run_dir, session, status, reason)
    write_eval(run_dir, cwd, skill_repo, status, exit_code, reason)
    write_skill_review(run_dir, cwd, skill_repo, skills, status, reason)
    print(run_dir)
    return exit_code


def spawn_detached_supervisor(
    *,
    args: argparse.Namespace,
    cwd: Path,
    skill_repo: Path,
    run_dir: Path,
    session: str,
    skills: list[str],
    workspace_status_before: str,
    initial_dangerous: bool,
) -> int:
    """Double-fork a daemon that runs supervise_to_completion in the background.

    Returns the supervisor PID. The parent then returns control to the caller
    so the main session can keep working; the supervisor stays alive only
    long enough to detect RESULT_STATUS (or hit the configured timeouts),
    close the tmux session, materialize last-message.md, and rewrite
    result.md / eval.md with the real outcome.
    """
    log_path = run_dir / "supervisor.log"
    pid_path = run_dir / "supervisor.pid"

    first_pid = os.fork()
    if first_pid > 0:
        # Parent of first fork — reap the intermediate child and wait for pid file.
        os.waitpid(first_pid, 0)
        deadline = time.monotonic() + 5.0
        while time.monotonic() < deadline:
            if pid_path.exists():
                try:
                    return int(pid_path.read_text(encoding="utf-8").strip())
                except (OSError, ValueError):
                    pass
            time.sleep(0.05)
        return first_pid

    # First child — fork again so the supervisor is reparented to init.
    try:
        os.setsid()
    except OSError:
        pass
    second_pid = os.fork()
    if second_pid > 0:
        os._exit(0)

    # Grandchild — this is the real supervisor.
    try:
        with open(os.devnull, "rb") as devnull_in:
            os.dup2(devnull_in.fileno(), 0)
        log_fh = open(log_path, "ab", buffering=0)
        os.dup2(log_fh.fileno(), 1)
        os.dup2(log_fh.fileno(), 2)
        log_fh.close()
        try:
            write_text(pid_path, f"{os.getpid()}\n")
            supervise_to_completion(
                args=args,
                cwd=cwd,
                skill_repo=skill_repo,
                run_dir=run_dir,
                session=session,
                skills=skills,
                workspace_status_before=workspace_status_before,
                initial_dangerous=initial_dangerous,
            )
        except BaseException as exc:  # pragma: no cover - exercised via integration
            sys.stderr.write(f"supervisor crashed: {exc!r}\n")
            sys.stderr.flush()
            os._exit(1)
    finally:
        os._exit(0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent", choices=("codex", "claude"), default="codex")
    parser.add_argument("--cwd", default=os.getcwd())
    parser.add_argument("--session")
    parser.add_argument("--run-root", default=str(DEFAULT_RUN_ROOT))
    parser.add_argument("--skill-repo", default=str(DEFAULT_SKILL_REPO))
    parser.add_argument("--timeout-min", type=float, default=DEFAULT_TIMEOUT_MINUTES)
    parser.add_argument("--idle-timeout-min", type=float, default=DEFAULT_IDLE_TIMEOUT_MINUTES)
    parser.add_argument("--detach", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--dangerous", action="store_true")
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Run an interactive tmux agent session and inject prompts with tmux send-keys.",
    )
    parser.add_argument(
        "--goal",
        help="Set this worker-local slash-command goal before sending the task prompt.",
    )
    parser.add_argument(
        "--clear-context-on-exit",
        action="store_true",
        help="Send /clear after an interactive worker reaches RESULT_STATUS.",
    )
    parser.add_argument(
        "--clear-goal-on-exit",
        action="store_true",
        help="Send /goal clear after an interactive worker reaches RESULT_STATUS.",
    )
    parser.add_argument(
        "--interactive-ready-timeout-sec",
        type=float,
        default=30.0,
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--interactive-send-settle-sec",
        type=float,
        default=0.5,
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--poll-interval-sec", type=float, default=5.0, help=argparse.SUPPRESS)
    parser.add_argument("--agent-command", help=argparse.SUPPRESS)
    parser.add_argument(
        "--require-sandbox",
        action="store_true",
        help="Fail instead of bypassing when the Codex workspace-write sandbox is unavailable.",
    )
    parser.add_argument(
        "--refresh-sandbox-preflight",
        action="store_true",
        help="Ignore the cached Codex sandbox capability and run a fresh preflight.",
    )
    parser.add_argument(
        "--sandbox-capability-cache",
        default=str(SANDBOX_CAPABILITY_CACHE),
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--sandbox-preflight-timeout-sec",
        type=float,
        default=30.0,
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--auto-retry-sandbox-failure",
        dest="auto_retry_sandbox_failure",
        action="store_true",
        default=True,
        help="Retry known Codex bwrap loopback sandbox failures once without sandboxing.",
    )
    parser.add_argument(
        "--no-auto-retry-sandbox-failure",
        dest="auto_retry_sandbox_failure",
        action="store_false",
        help="Do not retry known Codex bwrap loopback sandbox failures automatically.",
    )
    parser.add_argument("--no-auto-stop", action="store_true")
    parser.add_argument(
        "--no-detached-supervisor",
        action="store_true",
        help="With --interactive --detach, do NOT spawn the background supervisor "
        "that auto-closes the worker on RESULT_STATUS. Leaks the tmux session.",
    )
    parser.add_argument("--sync-on-skill-change", action="store_true")
    parser.add_argument("--commit-skill-changes", action="store_true")
    parser.add_argument("prompt", nargs=argparse.REMAINDER)
    return parser.parse_args()


def make_run_dir(run_root: str, cwd: Path, prompt: str) -> Path:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    repo_slug = slug(cwd.name)
    prompt_slug = slug(prompt)[:48] or "task"
    return Path(run_root).expanduser().resolve() / f"{stamp}-{repo_slug}-{prompt_slug}"


def default_session_name(run_dir: Path) -> str:
    return "skill-runner-" + run_dir.name[:80]


def retry_session_name(session: str) -> str:
    return (session + "-retry")[:200]


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


def rewrite_prompt(*, prompt: str, skills: list[str], cwd: Path) -> str:
    selected = ", ".join(f"${s}" for s in skills) if skills else "none explicitly named"
    return f"""Objective:
{prompt}

Selected skills:
{selected}

Workspace:
{cwd}

Operating contract:
- Treat the workspace above as the task/product repo and apply the selected
  skill workflows there.
- Do not substitute the custom skill source repo for the task workspace merely
  because the prompt mentions a skill file or installed skill copy.
- If the workspace appears wrong for the user objective, stop and report
  BLOCKED_NEEDS_DECISION instead of doing a plausible task in the wrong repo.
- Use the selected skill workflows honestly. If a named skill is unavailable, say so and stop.
- Keep the work KISS: smallest useful change, fewest artifacts, clear stop condition.
- Preserve unrelated user changes. Do not revert work you did not make.
- Do not edit custom skills unless the objective explicitly asks for skill work.
- Do not edit third-party/system skills directly.
- Commit only when the user's prompt or repo workflow asks for a commit.
- If blocked by credentials, paid APIs, local hardware, Docker, GPU, or a human decision, stop and report BLOCKED_NEEDS_DECISION.
- If you realize the current goal is wrong, too broad, looping, or sending you
  away from the requested artifact, stop and report PARTIAL or
  BLOCKED_NEEDS_DECISION with the corrected goal you recommend. Do not spend a
  long run trying to make a bad goal work.
- For long work, keep producing durable progress artifacts or commits at natural
  boundaries so the supervising session can steer without killing a healthy run.

Skill-specific guardrails:
- For $intuitive-flow: one phase is one coherent delivery unit. Do not create more than three phases from this prompt without stopping for grouping approval. Use tasks/checklists for blockers, proof retries, diagnostics, and small report/checker changes.
- For $simplify: review the actual changed scope only. Do not expand into broad architecture discovery.
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
RECOMMENDED_GOAL_REVISION: <only if the current goal or prompt should be changed; otherwise "none">
"""


def resolve_sandbox_decision(
    *,
    args: argparse.Namespace,
    cwd: Path,
    run_dir: Path,
) -> dict[str, object]:
    if args.dry_run:
        return {
            "agent": args.agent,
            "blocked": False,
            "cacheable": False,
            "dangerous": bool(args.dangerous),
            "mode": "bypass" if args.dangerous else "sandboxed",
            "reason": "dry run: skipped sandbox capability preflight",
            "source": "dry_run",
        }

    if args.agent != "codex":
        if args.require_sandbox:
            return {
                "agent": args.agent,
                "blocked": True,
                "cacheable": False,
                "dangerous": False,
                "mode": "blocked",
                "reason": "--require-sandbox is only supported for Codex workspace-write runs",
                "source": "not_applicable",
            }
        return {
            "agent": args.agent,
            "blocked": False,
            "cacheable": False,
            "dangerous": bool(args.dangerous),
            "mode": "bypass" if args.dangerous else "permissions-auto",
            "reason": "sandbox capability preflight applies only to Codex",
            "source": "not_applicable",
        }

    if args.dangerous:
        return {
            "agent": args.agent,
            "blocked": False,
            "cacheable": False,
            "dangerous": True,
            "mode": "bypass",
            "reason": "--dangerous was requested explicitly",
            "source": "explicit_dangerous",
        }

    cache_path = Path(args.sandbox_capability_cache).expanduser().resolve()
    key = sandbox_cache_key()
    if not args.refresh_sandbox_preflight:
        cached = sandbox_decision_from_cache(
            load_sandbox_cache(cache_path),
            key,
            require_sandbox=args.require_sandbox,
            cache_path=cache_path,
        )
        if cached is not None:
            return cached

    preflight = run_sandbox_preflight(args=args, cwd=cwd, run_dir=run_dir, key=key)
    status = str(preflight["status"])
    if status in SANDBOX_CACHEABLE_STATUSES:
        cache_sandbox_result(
            cache_path=cache_path,
            key=key,
            status=status,
            reason=str(preflight["reason"]),
            source_run_dir=run_dir,
        )

    base: dict[str, object] = {
        "agent": "codex",
        "blocked": False,
        "cache_path": str(cache_path),
        "cache_key": key,
        "cacheable": status in SANDBOX_CACHEABLE_STATUSES,
        "dangerous": False,
        "preflight": preflight,
        "source": "preflight",
    }
    if status == "available":
        return {
            **base,
            "mode": "sandboxed",
            "reason": "Codex workspace-write sandbox preflight succeeded",
        }
    if status == "loopback_unavailable":
        if args.require_sandbox:
            return {
                **base,
                "blocked": True,
                "mode": "blocked",
                "reason": "Codex workspace-write sandbox is unavailable and --require-sandbox was set",
            }
        return {
            **base,
            "dangerous": True,
            "mode": "bypass",
            "reason": "Codex workspace-write sandbox has the known bwrap loopback failure; running bypassed by default",
        }

    if args.require_sandbox:
        return {
            **base,
            "blocked": True,
            "mode": "blocked",
            "reason": f"Codex sandbox preflight did not prove sandbox availability: {preflight['reason']}",
        }
    return {
        **base,
        "mode": "sandboxed",
        "reason": f"Codex sandbox preflight failed in an unknown way; preserving sandboxed run path: {preflight['reason']}",
    }


def sandbox_decision_from_cache(
    cache: dict[str, object] | None,
    key: dict[str, object],
    *,
    require_sandbox: bool,
    cache_path: Path,
) -> dict[str, object] | None:
    if not sandbox_cache_matches(cache, key):
        return None
    assert cache is not None
    status = str(cache["status"])
    reason = str(cache.get("reason") or "cached sandbox capability")
    base: dict[str, object] = {
        "agent": "codex",
        "blocked": False,
        "cache_path": str(cache_path),
        "cache_key": key,
        "cache_status": status,
        "cache_updated_at": cache.get("updated_at"),
        "cacheable": True,
        "dangerous": False,
        "source": "cache",
    }
    if status == "available":
        return {
            **base,
            "mode": "sandboxed",
            "reason": f"cached Codex sandbox capability is available: {reason}",
        }
    if status == "loopback_unavailable":
        if require_sandbox:
            return {
                **base,
                "blocked": True,
                "mode": "blocked",
                "reason": "cached Codex sandbox capability is unavailable and --require-sandbox was set",
            }
        return {
            **base,
            "dangerous": True,
            "mode": "bypass",
            "reason": f"cached Codex sandbox capability is unavailable: {reason}",
        }
    return None


def sandbox_cache_matches(cache: dict[str, object] | None, key: dict[str, object]) -> bool:
    if not isinstance(cache, dict):
        return False
    if cache.get("schema_version") != SANDBOX_CACHE_SCHEMA_VERSION:
        return False
    if cache.get("status") not in SANDBOX_CACHEABLE_STATUSES:
        return False
    return cache.get("key") == key


def sandbox_cache_key() -> dict[str, object]:
    codex_path = shutil.which("codex") or "missing"
    bwrap_path = shutil.which("bwrap") or "missing"
    return build_sandbox_cache_key(
        codex_path=codex_path,
        codex_version=command_output(["codex", "--version"]) if codex_path != "missing" else "missing",
        bwrap_path=bwrap_path,
        bwrap_version=command_output(["bwrap", "--version"]) if bwrap_path != "missing" else "missing",
        kernel=kernel_fingerprint(),
        sysctls={name: read_sysctl(path) for name, path in SANDBOX_SYSCTL_PATHS.items()},
    )


def build_sandbox_cache_key(
    *,
    codex_path: str,
    codex_version: str,
    bwrap_path: str,
    bwrap_version: str,
    kernel: str,
    sysctls: dict[str, str],
) -> dict[str, object]:
    return {
        "bwrap_path": bwrap_path,
        "bwrap_version": bwrap_version,
        "codex_path": codex_path,
        "codex_version": codex_version,
        "kernel": kernel,
        "sysctls": dict(sorted(sysctls.items())),
    }


def command_output(command: list[str]) -> str:
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=COMMAND_PROBE_TIMEOUT_SECONDS,
        )
    except FileNotFoundError:
        return "missing"
    except subprocess.TimeoutExpired:
        return "timeout"
    output = result.stdout.strip()
    if output:
        return output
    return f"exit {result.returncode}"


def kernel_fingerprint() -> str:
    uname = os.uname()
    return " ".join((uname.sysname, uname.nodename, uname.release, uname.version, uname.machine))


def read_sysctl(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except OSError:
        return "missing"


def load_sandbox_cache(cache_path: Path) -> dict[str, object] | None:
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def cache_sandbox_result(
    *,
    cache_path: Path,
    key: dict[str, object],
    status: str,
    reason: str,
    source_run_dir: Path,
) -> dict[str, object]:
    data: dict[str, object] = {
        "key": key,
        "reason": reason,
        "schema_version": SANDBOX_CACHE_SCHEMA_VERSION,
        "source_run_dir": str(source_run_dir),
        "status": status,
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    write_json(cache_path, data)
    return data


def run_sandbox_preflight(
    *,
    args: argparse.Namespace,
    cwd: Path,
    run_dir: Path,
    key: dict[str, object],
) -> dict[str, object]:
    preflight_dir = run_dir / "sandbox-preflight"
    preflight_dir.mkdir(parents=True, exist_ok=False)
    command = [
        "codex",
        "exec",
        "--cd",
        str(cwd),
        "--json",
        "--output-last-message",
        str(preflight_dir / "last-message.md"),
        "--sandbox",
        "workspace-write",
        "-",
    ]
    prompt = "Return exactly this single line and do not inspect files:\nRESULT_STATUS: SUCCESS\n"
    write_text(preflight_dir / "command.txt", " ".join(shlex.quote(part) for part in command) + "\n")
    write_text(preflight_dir / "prompt.md", prompt)
    exit_code: int | None = None
    timed_out = False
    error: str | None = None
    try:
        result = subprocess.run(
            command,
            input=prompt,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=args.sandbox_preflight_timeout_sec,
        )
        exit_code = result.returncode
        write_text(preflight_dir / "events.jsonl", result.stdout)
        write_text(preflight_dir / "stderr.log", result.stderr)
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        exit_code = 124
        write_text(preflight_dir / "events.jsonl", subprocess_text(exc.stdout))
        write_text(preflight_dir / "stderr.log", subprocess_text(exc.stderr))
        error = f"timeout after {args.sandbox_preflight_timeout_sec:g} seconds"
    except FileNotFoundError as exc:
        exit_code = 127
        error = str(exc)
        write_text(preflight_dir / "events.jsonl", "")
        write_text(preflight_dir / "stderr.log", error + "\n")

    write_text(preflight_dir / "exit_code", f"{exit_code}\n")
    classification = classify_sandbox_preflight(
        preflight_dir,
        exit_code=exit_code,
        timed_out=timed_out,
        error=error,
    )
    result_data: dict[str, object] = {
        **classification,
        "cache_key": key,
        "exit_code": exit_code,
        "preflight_dir": str(preflight_dir),
        "schema_version": SANDBOX_CACHE_SCHEMA_VERSION,
    }
    write_json(preflight_dir / "result.json", result_data)
    return result_data


def classify_sandbox_preflight(
    preflight_dir: Path,
    *,
    exit_code: int | None,
    timed_out: bool = False,
    error: str | None = None,
) -> dict[str, object]:
    if detect_sandbox_loopback_failure(preflight_dir):
        return {
            "reason": "Codex workspace-write preflight hit the known bwrap loopback failure",
            "status": "loopback_unavailable",
        }
    if timed_out:
        return {
            "reason": error or "Codex workspace-write preflight timed out",
            "status": "unknown_error",
        }
    if error:
        return {
            "reason": f"Codex workspace-write preflight failed before completion: {error}",
            "status": "unknown_error",
        }
    if exit_code == 0:
        return {
            "reason": "Codex workspace-write preflight completed successfully",
            "status": "available",
        }
    return {
        "reason": f"Codex workspace-write preflight exited with code {exit_code}",
        "status": "unknown_error",
    }


def subprocess_text(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def write_sandbox_report(run_dir: Path, decision: dict[str, object]) -> None:
    lines = [
        "# Sandbox Preflight",
        "",
        f"- Agent: {decision.get('agent')}",
        f"- Source: {decision.get('source')}",
        f"- Mode: {decision.get('mode')}",
        f"- Dangerous bypass: {decision.get('dangerous')}",
        f"- Blocked: {decision.get('blocked')}",
        f"- Reason: {decision.get('reason')}",
    ]
    if decision.get("cache_path"):
        lines.append(f"- Cache: `{decision['cache_path']}`")
    preflight = decision.get("preflight")
    if isinstance(preflight, dict) and preflight.get("preflight_dir"):
        lines.append(f"- Preflight artifacts: `{preflight['preflight_dir']}`")
    lines.append("")
    lines.append("Full cache-key inputs are recorded in `run.json`.")
    write_text(run_dir / "sandbox-preflight.md", "\n".join(lines) + "\n")


def write_run_script(
    run_dir: Path,
    args: argparse.Namespace,
    cwd: Path,
    *,
    dangerous: bool,
) -> None:
    prompt_path = run_dir / "rewritten-prompt.md"
    exit_path = run_dir / "exit_code"
    if args.interactive:
        command = interactive_agent_command(args=args, cwd=cwd, dangerous=dangerous, run_dir=run_dir)
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
        if dangerous:
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
        if dangerous:
            command.append("--dangerously-skip-permissions")

    quoted = " ".join(shlex.quote(part) for part in command)
    if args.interactive:
        body = f"""{quoted} 2> >(tee {shlex.quote(str(run_dir / "stderr.log"))} >&2)
code=$?
"""
    else:
        body = f"""{quoted} < {shlex.quote(str(prompt_path))} 2> >(tee {shlex.quote(str(run_dir / "stderr.log"))} >&2) | tee {shlex.quote(str(run_dir / "events.jsonl"))}
code=${{PIPESTATUS[0]}}
"""

    script = f"""#!/usr/bin/env bash
set -u
cd {shlex.quote(str(cwd))}
echo $$ > {shlex.quote(str(run_dir / "worker.pid"))}
echo running > {shlex.quote(str(run_dir / "status"))}
set +e
{body}
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


def interactive_agent_command(
    *,
    args: argparse.Namespace,
    cwd: Path,
    dangerous: bool,
    run_dir: Path,
) -> list[str]:
    if args.agent_command:
        return shlex.split(str(args.agent_command))
    if args.agent == "codex":
        command = [
            "codex",
            "--no-alt-screen",
            "--cd",
            str(cwd),
        ]
        if dangerous:
            command.append("--dangerously-bypass-approvals-and-sandbox")
        else:
            command.extend(["--sandbox", "workspace-write"])
        return command

    command = ["claude"]
    if dangerous:
        command.append("--dangerously-skip-permissions")
    else:
        # Interactive supervised mode: the runner has already vetted the task
        # (rewritten prompt, bounded scope), the tmux session is isolated,
        # and risk-detection scans terminal.log. Without bypassPermissions
        # the worker hangs on every Write/Bash prompt because there is no
        # human at the keyboard. acceptEdits is not enough — paths under
        # $HOME/.claude/ are treated as "sensitive" and prompt anyway.
        # --add-dir still narrows file access; bypassPermissions only
        # affects whether prompts surface.
        command.extend(["--permission-mode", "bypassPermissions"])
        for extra in claude_interactive_add_dirs(run_dir):
            command.extend(["--add-dir", str(extra)])
    return command


def claude_interactive_add_dirs(run_dir: Path) -> list[Path]:
    """Paths the interactive claude worker must read/write without prompting.

    The worker is started with `--cwd <task-repo>`, but the runner injects
    instructions referencing the rewritten prompt and (commonly) writes
    reports under user job directories. Pre-authorize those so the worker
    does not stall on permission prompts during a detached run.
    """
    candidates: list[Path] = [run_dir]
    job_dir_env = os.environ.get("CLAUDE_JOB_DIR")
    if job_dir_env:
        candidates.append(Path(job_dir_env).expanduser())
    candidates.append(Path.home() / ".claude" / "jobs")
    seen: set[Path] = set()
    resolved: list[Path] = []
    for path in candidates:
        try:
            normalized = path.expanduser().resolve()
        except OSError:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        resolved.append(normalized)
    return resolved


def start_tmux(*, session: str, run_dir: Path, cwd: Path) -> None:
    run_script = run_dir / "run.sh"
    subprocess.run(
        ["tmux", "new-session", "-d", "-s", session, "-c", str(cwd), "bash", str(run_script)],
        check=True,
    )
    subprocess.run(
        ["tmux", "pipe-pane", "-o", "-t", session, f"cat >> {shlex.quote(str(run_dir / 'terminal.log'))}"],
        check=False,
    )


def start_interactive_worker(*, session: str, run_dir: Path, args: argparse.Namespace) -> None:
    if not wait_for_interactive_prompt(
        session=session,
        run_dir=run_dir,
        timeout_sec=float(args.interactive_ready_timeout_sec),
    ):
        write_text(run_dir / "interactive-start-warning", "ready prompt was not detected before injection\n")
        if not tmux_has_session(session):
            raise RuntimeError("tmux session exited before the interactive prompt became ready")

    goal = str(args.goal or "").strip()
    if goal:
        send_tmux_line(
            session=session,
            run_dir=run_dir,
            text=f"/goal {goal}",
            label="goal",
            settle_sec=float(args.interactive_send_settle_sec),
        )

    task_prompt = interactive_task_prompt(run_dir)
    send_tmux_line(
        session=session,
        run_dir=run_dir,
        text=task_prompt,
        label="task",
        settle_sec=float(args.interactive_send_settle_sec),
    )


def interactive_task_prompt(run_dir: Path) -> str:
    return (
        f"Execute the skill-runner task described in {run_dir / 'rewritten-prompt.md'}. "
        "Follow that file exactly and finish with RESULT_STATUS."
    )


def wait_for_interactive_prompt(*, session: str, run_dir: Path, timeout_sec: float) -> bool:
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        output = capture_tmux_pane(session)
        if output is not None:
            write_text(run_dir / "pane-before-injection.log", output)
            if has_interactive_prompt(output) and not is_interactive_startup_busy(output):
                return True
        if not tmux_has_session(session):
            return False
        time.sleep(0.25)
    return False


def has_interactive_prompt(output: str) -> bool:
    cleaned = strip_ansi(output)
    tail = "\n".join(cleaned.splitlines()[-30:])
    # Real prompt glyphs claude/codex render: '›', '>', '❯', '$ ' (when shell).
    # Some renders also leading-indent with box-drawing whitespace.
    return re.search(r"(?m)^[\s│┃▏▎▍▌▋▊▉█]*[›>❯$]\s*$|^[\s│┃▏▎▍▌▋▊▉█]*[›>❯$]\s+\S", tail) is not None


def is_interactive_startup_busy(output: str) -> bool:
    cleaned = strip_ansi(output)
    tail = "\n".join(cleaned.splitlines()[-40:])
    return any(
        marker in tail
        for marker in (
            "model:       loading",
            "Booting MCP server",
            "Queued follow-up inputs",
            "MCP startup interrupted",
        )
    )


def send_tmux_line(
    *,
    session: str,
    run_dir: Path,
    text: str,
    label: str,
    settle_sec: float,
) -> None:
    if not tmux_has_session(session):
        raise RuntimeError(f"tmux session {session!r} is not running before sending {label}")

    input_log = run_dir / "tmux-inputs.jsonl"
    with input_log.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"label": label, "text": text}) + "\n")

    buffer_name = f"skill-runner-{os.getpid()}-{int(time.time() * 1000)}"
    buffer_path = run_dir / f"tmux-input-{label}.txt"
    write_text(buffer_path, text)
    subprocess.run(["tmux", "send-keys", "-t", session, "C-u"], check=False)
    subprocess.run(["tmux", "load-buffer", "-b", buffer_name, str(buffer_path)], check=True)
    try:
        subprocess.run(["tmux", "paste-buffer", "-d", "-b", buffer_name, "-t", session], check=True)
    finally:
        subprocess.run(
            ["tmux", "delete-buffer", "-b", buffer_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    if not tmux_has_session(session):
        raise RuntimeError(f"tmux session {session!r} exited while sending {label}")
    subprocess.run(["tmux", "send-keys", "-t", session, "C-m"], check=True)
    if settle_sec > 0:
        time.sleep(settle_sec)


def wait_for_worker(*, session: str, run_dir: Path, args: argparse.Namespace) -> tuple[str, int, str]:
    started = time.monotonic()
    last_activity = time.monotonic()
    last_size = -1
    exit_path = run_dir / "exit_code"
    timeout = args.timeout_min * 60
    idle_timeout = args.idle_timeout_min * 60

    while True:
        if args.interactive:
            worker_status = read_worker_result_status(run_dir)
            if worker_status:
                materialize_interactive_last_message(run_dir)
                close_interactive_session(session=session, run_dir=run_dir, args=args)
                return classify_worker_exit(run_dir, 0)

        if exit_path.exists():
            code = read_exit_code(exit_path)
            return classify_worker_exit(run_dir, code)

        if not tmux_has_session(session):
            return "FAILED", 1, "tmux session ended without exit_code"

        current_size = log_size(run_dir)
        if current_size != last_size:
            last_activity = time.monotonic()
            last_size = current_size

        if time.monotonic() - started > timeout:
            stop_session(session, run_dir, "timeout")
            return "FAILED", 124, f"timeout after {args.timeout_min:g} minutes"

        if time.monotonic() - last_activity > idle_timeout:
            stop_session(session, run_dir, "idle-timeout")
            return "FAILED", 124, f"idle timeout after {args.idle_timeout_min:g} minutes"

        if not args.no_auto_stop:
            risk = detect_risk(run_dir, include_terminal=args.interactive)
            if risk:
                stop_session(session, run_dir, risk)
                return "BLOCKED", 125, f"auto-stopped: {risk}"

        time.sleep(max(0.1, float(args.poll_interval_sec)))


def tmux_has_session(session: str) -> bool:
    return subprocess.run(["tmux", "has-session", "-t", session], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def stop_session(session: str, run_dir: Path, reason: str) -> None:
    capture_path = run_dir / "pane-before-stop.log"
    with capture_path.open("w", encoding="utf-8") as fh:
        subprocess.run(["tmux", "capture-pane", "-p", "-S", "-2000", "-t", session], stdout=fh, stderr=subprocess.DEVNULL)
    write_text(run_dir / "stopped_reason", reason + "\n")
    subprocess.run(["tmux", "kill-session", "-t", session], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    write_text(run_dir / "exit_code", "125\n")
    write_text(run_dir / "status", "stopped\n")


def close_interactive_session(*, session: str, run_dir: Path, args: argparse.Namespace) -> None:
    if args.clear_goal_on_exit and args.goal:
        wait_for_interactive_prompt(session=session, run_dir=run_dir, timeout_sec=10.0)
        send_tmux_line(
            session=session,
            run_dir=run_dir,
            text="/goal clear",
            label="goal-clear",
            settle_sec=float(args.interactive_send_settle_sec),
        )
    if args.clear_context_on_exit:
        wait_for_interactive_prompt(session=session, run_dir=run_dir, timeout_sec=10.0)
        send_tmux_line(
            session=session,
            run_dir=run_dir,
            text="/clear",
            label="clear",
            settle_sec=float(args.interactive_send_settle_sec),
        )

    capture_path = run_dir / "pane-before-close.log"
    output = capture_tmux_pane(session)
    if output is not None:
        write_text(capture_path, output)
    subprocess.run(["tmux", "kill-session", "-t", session], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    write_text(run_dir / "exit_code", "0\n")
    write_text(run_dir / "status", "complete\n")


def capture_tmux_pane(session: str) -> str | None:
    result = subprocess.run(
        ["tmux", "capture-pane", "-p", "-S", "-2000", "-t", session],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def materialize_interactive_last_message(run_dir: Path) -> None:
    if (run_dir / "last-message.md").exists():
        return
    terminal_path = run_dir / "terminal.log"
    if not terminal_path.exists():
        return
    terminal = strip_ansi(terminal_path.read_text(encoding="utf-8", errors="replace"))
    match = TERMINAL_RESULT_STATUS_PATTERN.search(terminal)
    if not match:
        return
    write_text(run_dir / "last-message.md", terminal[match.start():])


def strip_ansi(text: str) -> str:
    """Remove CSI/OSC escape sequences so terminal-log scans see plain text."""
    return ANSI_ESCAPE_PATTERN.sub("", text)


def classify_worker_exit(run_dir: Path, code: int) -> tuple[str, int, str]:
    worker_status = read_worker_result_status(run_dir)
    if worker_status == "SUCCESS":
        return "SUCCESS", 0, f"worker reported RESULT_STATUS: SUCCESS; cli exit code {code}"
    if worker_status == "PARTIAL":
        return "PARTIAL", 0, f"worker reported RESULT_STATUS: PARTIAL; cli exit code {code}"
    if detect_sandbox_loopback_failure(run_dir):
        return "BLOCKED", 125, f"sandbox-loopback-denied; cli exit code {code}"
    if worker_status == "BLOCKED_NEEDS_DECISION":
        return "BLOCKED", 125, (
            f"worker reported RESULT_STATUS: BLOCKED_NEEDS_DECISION; cli exit code {code}"
        )
    if worker_status == "FAILED":
        return "FAILED", 1, f"worker reported RESULT_STATUS: FAILED; cli exit code {code}"
    status = "SUCCESS" if code == 0 else "FAILED"
    return status, code, f"worker exited with code {code}"


def read_worker_result_status(run_dir: Path) -> str | None:
    for name in ("last-message.md", "terminal.log", "events.jsonl"):
        path = run_dir / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if name == "terminal.log":
            text = strip_ansi(text)
            pattern = TERMINAL_RESULT_STATUS_PATTERN
        else:
            pattern = RESULT_STATUS_PATTERN
        match = pattern.search(text)
        if match:
            return match.group(1).upper()
    return None


def detect_sandbox_loopback_failure(run_dir: Path) -> bool:
    return any(
        SANDBOX_LOOPBACK_PATTERN.search(read_log_tail(run_dir / log_name)) is not None
        for log_name in SANDBOX_DETECTION_LOGS
    )


def should_retry_sandbox_failure(
    args: argparse.Namespace,
    run_dir: Path,
    cwd: Path,
    workspace_status_before: str,
    *,
    initial_dangerous: bool,
) -> bool:
    if (
        args.agent != "codex"
        or initial_dangerous
        or args.require_sandbox
        or not args.auto_retry_sandbox_failure
    ):
        return False
    if not detect_sandbox_loopback_failure(run_dir):
        return False
    return git_status(cwd) == workspace_status_before


def archive_attempt_logs(run_dir: Path, prefix: str) -> None:
    for name in (
        "events.jsonl",
        "stderr.log",
        "terminal.log",
        "last-message.md",
        "exit_code",
        "status",
        "worker.pid",
        "stopped_reason",
        "pane-before-stop.log",
    ):
        path = run_dir / name
        if path.exists():
            path.rename(run_dir / f"{prefix}.{name}")


def log_size(run_dir: Path) -> int:
    total = 0
    for name in ("events.jsonl", "stderr.log", "terminal.log"):
        path = run_dir / name
        if path.exists():
            total += path.stat().st_size
    return total


def detect_risk(run_dir: Path, *, include_terminal: bool = False) -> str | None:
    text = read_log_tail(run_dir / "stderr.log")
    if include_terminal:
        text += "\n" + strip_ansi(read_log_tail(run_dir / "terminal.log"))
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


def write_result(run_dir: Path, session: str, status: str, reason: str) -> None:
    write_text(
        run_dir / "result.md",
        f"""# Skill Runner Result

- Status: {status}
- Reason: {reason}
- Tmux session: `{session}`
- Attach command: `tmux attach -t {session}`

Review `last-message.md`, `eval.md`, and targeted log excerpts before relying
on this run.
""",
    )


def write_eval(run_dir: Path, cwd: Path, skill_repo: Path, status: str, exit_code: int, reason: str) -> None:
    workspace_status = git_status(cwd)
    skill_status = git_status(skill_repo, ["--", "skills"])
    verdict = "NO_SKILL_CHANGE" if not skill_status.strip() else "REVIEW_REQUIRED"
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
    """Write the default post-run skill-performance review artifact.

    This is deliberately advisory. The runner should make skill feedback easy
    to batch-review without turning every product run into automatic skill
    maintenance.
    """
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
    has_skill_diff = bool(workspace_skill_status.strip() or custom_skill_status.strip())
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
    for name in ("last-message.md", "terminal.log", "events.jsonl"):
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
