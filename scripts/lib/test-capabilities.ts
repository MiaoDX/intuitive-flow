import { spawnSync } from "node:child_process";

export const hasUsableTmux = (env: NodeJS.ProcessEnv = process.env): boolean => {
  if (spawnSync("tmux", ["-V"], { encoding: "utf8", env }).status !== 0) {
    return false;
  }

  const sessionName = `iflow-test-probe-${process.pid}-${Date.now()}`;
  const created = spawnSync("tmux", ["new-session", "-d", "-s", sessionName, "true"], { encoding: "utf8", env });
  if (created.status !== 0) {
    return false;
  }

  spawnSync("tmux", ["kill-session", "-t", sessionName], { encoding: "utf8", env });
  return true;
};
