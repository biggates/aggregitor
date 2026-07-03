import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { load as yamlLoad } from "js-yaml";

export interface Config {
  repos: string[];
  output: {
    format: "json" | "md";
    dest?: string;
    template?: string;
  };
  git: {
    authors?: { email?: string; name?: string }[];
    "fetch-remote"?: boolean;
    "filter-unconventional"?: boolean;
    "only-tags"?: boolean;
    "tag-pattern"?: string;
    "branch-pattern"?: string;
  };
}

export const DEFAULT_TEMPLATE = [
  "# Aggregated Git Log",
  "",
  "> Generated at: {{ generated_at }}",
  "> Time range: {{ begin_time }} ~ {{ end_time }}",
  "> Tool: {{ tool.name }} v{{ tool.version }}",
  "",
  "---",
  "{{#each repos}}",
  "## {{ name }}",
  "",
  "- **Path:** `{{ path }}`",
  "- **Total commits:** {{ total_commits }}",
  "- **Summary:** +{{ summary.total_additions }} / −{{ summary.total_deletions }}",
  "{{#if tags}}",
  "",
  "### Tags",
  "",
  "| Tag | Hash | Date |",
  "|-----|------|------|",
  "{{#each tags}}",
  "| {{ name }} | `{{ hash }}` | {{ time }} |",
  "{{/each}}",
  "{{/if}}",
  "",
  "### Commits",
  "",
  "| Hash | Author | Time | Branch | Message | +/- |",
  "|------|--------|------|--------|---------|-----|",
  "{{#each commits}}",
  "| `{{ hash }}` | {{ author }} | {{ time }} | {{ branch }} | {{ message }} | +{{ lines.additions }} −{{ lines.deletions }} |",
  "{{/each}}",
  "",
  "---",
  "{{/each}}",
].join("\n") + "\n";

export function findConfigPath(): string | null {
  const candidates = [".aggregitor.yml", ".aggregitor.yaml"];
  for (const c of candidates) {
    const full = join(process.cwd(), c);
    if (existsSync(full)) return full;
  }
  return null;
}

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = yamlLoad(raw) as Record<string, unknown>;

  const repos: string[] = [];
  if (Array.isArray(parsed.repos)) {
    for (const r of parsed.repos) {
      if (typeof r === "string") repos.push(r);
    }
  }

  const outputRaw = (parsed.output as Record<string, unknown>) || {};
  const output = {
    format: (outputRaw.format as string) === "md" ? "md" as const : "json" as const,
    dest: typeof outputRaw.dest === "string" ? outputRaw.dest : undefined,
    template: typeof outputRaw.template === "string" ? outputRaw.template : undefined,
  };

  const gitRaw = (parsed.git as Record<string, unknown>) || {};

  let authors: { email?: string; name?: string }[] | undefined;
  if (Array.isArray(gitRaw.authors)) {
    authors = gitRaw.authors.map((a: unknown) => {
      if (a && typeof a === "object") {
        const aa = a as Record<string, unknown>;
        return { email: typeof aa.email === "string" ? aa.email : undefined, name: typeof aa.name === "string" ? aa.name : undefined };
      }
      if (typeof a === "string") return { name: a };
      return {};
    });
  }

  const git = {
    authors,
    "fetch-remote": Boolean(gitRaw["fetch-remote"]),
    "filter-unconventional": gitRaw["filter-unconventional"] === true,
    "only-tags": Boolean(gitRaw["only-tags"]),
    "tag-pattern": typeof gitRaw["tag-pattern"] === "string" ? gitRaw["tag-pattern"] : undefined,
    "branch-pattern": typeof gitRaw["branch-pattern"] === "string" ? gitRaw["branch-pattern"] : undefined,
  };

  return { repos, output, git };
}

export function resolveRepos(repos: string[]): string[] {
  return repos.map((r) => {
    if (r.startsWith("/") || /^[A-Za-z]:\\/.test(r)) return r;
    return join(process.cwd(), r);
  });
}

/**
 * Expand repo paths: if a path is a git directory itself, include it directly.
 * Otherwise scan its immediate subdirectories and include all that are git repos.
 */
export function expandRepoPaths(absRepos: string[]): string[] {
  const result: string[] = [];
  for (const repoPath of absRepos) {
    if (existsSync(join(repoPath, ".git"))) {
      result.push(repoPath);
    } else if (existsSync(repoPath)) {
      try {
        const entries = readdirSync(repoPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subPath = join(repoPath, entry.name);
          if (existsSync(join(subPath, ".git"))) {
            result.push(subPath);
          }
        }
      } catch {
        // skip unreadable directories
      }
    }
  }
  return result;
}
