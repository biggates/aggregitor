import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const INIT_CONFIG = `# .aggregitor.yml
# ============================================================
# aggregitor - Generate aggregated git commit logs
# from multiple git folders.
# ============================================================

# ---- Repository paths ----
# Specify local git repos to scan (absolute or relative paths).
repos:
  - /path/to/your/first/repo
  - ../relative/path/to/another/repo

# ---- Output configuration ----
output:
  # Output format: "json" or "md"
  format: md

  # Output file path (omit to print to stdout)
  dest: ./AGGREGATED_LOG.md

  # ============================================================
  # Markdown template (only used when format: md).
  # Leave unset to use the built-in default template.
  #
  # Template syntax:
  #   {{ variable }}              - Interpolation
  #   {{ variable.nested }}       - Nested property access
  #   {{#each list}}...{{/each}}  - Loop over an array
  #   {{#if value}}...{{/if}}     - Conditional (truthy)
  #   {{#unless value}}...{{/unless}} - Conditional (falsy)
  #   {{! comment }}              - Comment (not output)
  # ============================================================
  template: |
    # Aggregated Git Log

    > Generated at: {{ generated_at }}
    > Time range: {{ begin_time }} ~ {{ end_time }}
    > Tool: {{ tool.name }} v{{ tool.version }}

    ---
    {{#each repos}}
    ## {{ name }}

    - **Path:** \`{{ path }}\`
    - **Total commits:** {{ total_commits }}
    - **Summary:** +{{ summary.total_additions }} / −{{ summary.total_deletions }}
    {{#if tags}}

    ### Tags

    | Tag | Hash | Date |
    |-----|------|------|
    {{#each tags}}
    | {{ name }} | \`{{ hash }}\` | {{ time }} |
    {{/each}}
    {{/if}}

    ### Commits

    | Hash | Author | Time | Branch | Message | +/- |
    |------|--------|------|--------|---------|-----|
    {{#each commits}}
    | \`{{ hash }}\` | {{ author }} | {{ time }} | {{ branch }} | {{ message }} | +{{ lines.additions }} −{{ lines.deletions }} |
    {{/each}}

    ---
    {{/each}}

# ---- Git filtering ----
git:
  # Filter commits by authors (email or name; multiple = union).
  authors:
    - email: your@email.com

  # Run "git fetch --all --tags --force" before scanning.
  fetch-remote: false

  # Exclude commits that don't follow conventional commits format.
  filter-unconventional: true

  # Only include commits that are tagged.
  only-tags: false

  # Regex to filter tags.
  tag-pattern: "v[0-9].*"

  # Regex to filter branches.
  branch-pattern: "^feat/"
`;

export async function initCommand(): Promise<void> {
  const target = join(process.cwd(), ".aggregitor.yml");
  if (existsSync(target)) {
    console.error(".aggregitor.yml already exists in this directory.");
    process.exit(1);
  }
  writeFileSync(target, INIT_CONFIG, "utf-8");
  console.log("Created .aggregitor.yml");
}
