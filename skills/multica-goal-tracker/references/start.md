# Start tracking

## Start Tracking

Use this after the issue exists and contains the goal, or when the user gives
you the goal text directly. Run the command from the Intuitive Flow checkout
root so the script path stays portable across clone locations.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  start \
  --issue MIA-40
```

If the goal is not already in the issue description, pass `--goal-file`.

```bash
bun skills/multica-goal-tracker/scripts/track_goal.ts \
  start \
  --issue MIA-40 \
  --goal-file /tmp/goal.txt
```

Pass `--update-description` only when the user asks to normalize the issue
description itself. The script inserts or replaces a marked summary block and
preserves the existing description below it.

Use `--dry-run` before writing to a real issue when testing a prompt or script
change.
