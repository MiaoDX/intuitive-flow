export const skillFrontmatter = (text: string): string | undefined => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return match?.[1];
};

export const skillFrontmatterValue = (frontmatterText: string, key: string): string | undefined => {
  const match = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(frontmatterText);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
};

export const skillBlockValue = (
  frontmatterText: string,
  key: string,
  options: { normalizeWhitespace?: boolean; stripScalarQuotes?: boolean } = {},
): string => {
  const lines = frontmatterText.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) {
    return "";
  }

  const first = lines[start].slice(`${key}:`.length).trim();
  if (first !== "|" && first !== ">") {
    const scalar = options.stripScalarQuotes ? first.replace(/^["']|["']$/g, "") : first;
    return options.normalizeWhitespace ? scalar.replace(/\s+/g, " ").trim() : scalar;
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
      break;
    }
    body.push(line.replace(/^ {2}/, ""));
  }
  const value = body.join(options.normalizeWhitespace ? " " : "\n");
  return options.normalizeWhitespace ? value.replace(/\s+/g, " ").trim() : value.trim();
};
