#!/usr/bin/env python3
"""Summarize skill-runner run artifacts for batch review."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
from collections import Counter
from pathlib import Path


DEFAULT_RUN_ROOT = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "skill-runner" / "runs"
RESULT_STATUS_PATTERN = re.compile(r"RESULT_STATUS:\s*(SUCCESS|PARTIAL|BLOCKED_NEEDS_DECISION|FAILED)\b", re.I)


def main() -> int:
    args = parse_args()
    run_root = Path(args.run_root).expanduser().resolve()
    since = parse_since(args.since)
    rows = [
        summarize_run(path)
        for path in sorted(run_root.iterdir(), key=lambda item: item.name)
        if path.is_dir() and (since is None or run_mtime(path) >= since)
    ]
    if args.json:
        print(json.dumps(rows, indent=2, sort_keys=True))
        return 0
    print_markdown(rows)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-root", default=str(DEFAULT_RUN_ROOT))
    parser.add_argument(
        "--since",
        help="Include runs modified at or after YYYY-MM-DD or an ISO datetime.",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def parse_since(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    text = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        parsed = dt.datetime.fromisoformat(text)
    else:
        parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.astimezone()
    return parsed


def run_mtime(path: Path) -> dt.datetime:
    return dt.datetime.fromtimestamp(path.stat().st_mtime).astimezone()


def summarize_run(path: Path) -> dict[str, object]:
    result_status, result_reason = parse_result(path / "result.md")
    worker_status = parse_worker_status(path)
    recommendation = parse_recommendation(path / "skill-review.md")
    metadata = read_json(path / "run.json")
    skills = metadata.get("skills") if isinstance(metadata, dict) else []
    owned_paths = metadata.get("owned_paths") if isinstance(metadata, dict) else []
    mismatch = result_status in {"DETACHED", "FAILED"} and bool(worker_status)
    return {
        "run": path.name,
        "mtime": run_mtime(path).isoformat(timespec="seconds"),
        "status": result_status or "UNKNOWN",
        "reason": result_reason or "",
        "worker_status": worker_status or "",
        "status_mismatch": mismatch,
        "skill_review": recommendation or "",
        "skills": skills if isinstance(skills, list) else [],
        "owned_paths": owned_paths if isinstance(owned_paths, list) else [],
    }


def parse_result(path: Path) -> tuple[str, str]:
    text = read_text(path)
    status = ""
    reason = ""
    for line in text.splitlines():
        if line.startswith("- Status:"):
            status = line.split(":", 1)[1].strip()
        elif line.startswith("- Reason:"):
            reason = line.split(":", 1)[1].strip()
    return status, reason


def parse_worker_status(path: Path) -> str:
    for name in ("last-message.md", "terminal.log", "events.jsonl"):
        text = read_text(path / name)
        match = RESULT_STATUS_PATTERN.search(text)
        if match:
            return match.group(1).upper()
    return ""


def parse_recommendation(path: Path) -> str:
    text = read_text(path)
    match = re.search(r"(?ms)^## Recommendation\s+(.+?)(?:\n## |\Z)", text)
    if not match:
        return ""
    return " ".join(match.group(1).strip().split())


def read_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def print_markdown(rows: list[dict[str, object]]) -> None:
    status_counts = Counter(str(row["status"]) for row in rows)
    mismatch_rows = [row for row in rows if row["status_mismatch"]]
    review_counts = Counter(str(row["skill_review"]).split(":", 1)[0] or "none" for row in rows)

    print("# Skill Runner Run Summary")
    print()
    print(f"- Runs: {len(rows)}")
    print(f"- Status counts: {format_counter(status_counts)}")
    print(f"- Skill-review counts: {format_counter(review_counts)}")
    print(f"- Result/worker-status mismatches: {len(mismatch_rows)}")
    print()
    print("| Run | Status | Worker | Mismatch | Reason | Skill review |")
    print("| --- | --- | --- | --- | --- | --- |")
    for row in rows:
        print(
            "| "
            + " | ".join(
                [
                    markdown_cell(str(row["run"])),
                    markdown_cell(str(row["status"])),
                    markdown_cell(str(row["worker_status"])),
                    "yes" if row["status_mismatch"] else "",
                    markdown_cell(str(row["reason"])),
                    markdown_cell(str(row["skill_review"])),
                ]
            )
            + " |"
        )


def format_counter(counter: Counter[str]) -> str:
    if not counter:
        return "none"
    return ", ".join(f"{key}={counter[key]}" for key in sorted(counter))


def markdown_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ").strip()


if __name__ == "__main__":
    raise SystemExit(main())
