import { describe, expect, test } from "bun:test";
import { findExternalSkillSource, parseExternalSkillSourcesText } from "./external-skill-sources";

describe("external skill sources", () => {
  test("parses allowlisted and full external skill sources", () => {
    const manifest = parseExternalSkillSourcesText(`
      source anthropics anthropics/skills allowlist skill-creator mcp-builder pdf
      source mattpocock https://github.com/mattpocock/skills allowlist diagnose tdd
    `);

    expect(findExternalSkillSource(manifest, "anthropics")).toEqual({
      label: "anthropics",
      repo: "anthropics/skills",
      mode: "allowlist",
      skills: ["skill-creator", "mcp-builder", "pdf"],
    });
    expect(findExternalSkillSource(manifest, "mattpocock")).toEqual({
      label: "mattpocock",
      repo: "https://github.com/mattpocock/skills",
      mode: "allowlist",
      skills: ["diagnose", "tdd"],
    });
  });

  test("rejects unsafe or ambiguous external skill sources", () => {
    expect(() =>
      parseExternalSkillSourcesText(`
        source ../bad anthropics/skills all
        source demo https://example.com/demo all
        source broad anthropics/skills allowlist
        source all-with-skills anthropics/skills all pdf
      `),
    ).toThrow(
      [
        "unsafe external skill source label on line 2: ../bad",
        "unsupported external skill repo on line 3: https://example.com/demo",
        "allowlisted external skill source needs at least one skill on line 4: broad",
        "external skill source in all mode must not name skills on line 5: all-with-skills",
      ].join("\n"),
    );
  });
});
