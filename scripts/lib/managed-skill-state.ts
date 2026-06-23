#!/usr/bin/env bun

import { pruneRemovedExternalSkillStates, syncExternalSkillState } from "./external-skill-state";
import { syncGsdSkillState } from "./gsd-skill-state";
import { syncGstackSkillState } from "./gstack-skill-state";
import { pruneLegacyArtifacts, pruneRemovedOwnedRootSkills, recordOwnedRootSkills } from "./owned-root-skill-state";

const usage = () => {
  console.error("Usage: managed-skill-state.ts <gstack-sync|external-sync|external-prune-removed|gsd-sync|prune-legacy-artifacts|prune-owned-root-skills|record-owned-root-skills> <args...>");
};

const main = () => {
  const [command, ...args] = process.argv.slice(2);

  try {
    if (command === "gstack-sync") {
      const [repoDir, allowlistPath] = args;
      if (!repoDir || !allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = syncGstackSkillState(repoDir, allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale gstack skill artifact(s)`);
      }
      return;
    }

    if (command === "gsd-sync") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = syncGsdSkillState(allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale GSD skill artifact(s)`);
      }
      return;
    }

    if (command === "external-sync") {
      const [allowlistPath, label] = args;
      if (!allowlistPath || !label) {
        usage();
        process.exit(2);
      }

      const removed = syncExternalSkillState(allowlistPath, label);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale external skill artifact(s) for ${label}`);
      }
      return;
    }

    if (command === "external-prune-removed") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = pruneRemovedExternalSkillStates(allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale external skill artifact(s) for removed source label(s)`);
      }
      return;
    }

    if (command === "prune-owned-root-skills") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      const removed = pruneRemovedOwnedRootSkills(allowlistPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale owned root skill artifact(s)`);
      }
      return;
    }

    if (command === "prune-legacy-artifacts") {
      const [pruneLedgerPath] = args;
      if (!pruneLedgerPath) {
        usage();
        process.exit(2);
      }

      const removed = pruneLegacyArtifacts(pruneLedgerPath);
      if (removed > 0) {
        console.log(`  ✓ removed ${removed} stale local command/skill artifact(s)`);
      }
      return;
    }

    if (command === "record-owned-root-skills") {
      const [allowlistPath] = args;
      if (!allowlistPath) {
        usage();
        process.exit(2);
      }

      recordOwnedRootSkills(allowlistPath);
      return;
    }

    usage();
    process.exit(2);
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
