# aggregitor

Generate aggregated git commit logs from multiple git folders.

[中文文档](./README_CN.md)

## What is this

### Requirements

- `git` must be installed locally and available in PATH
- The required git permissions have been configured

### Main use cases

- Scenarios such as daily / weekly reports that require summarizing the main work from multiple git repositories over a period of time
- Especially suitable for **scheduled tasks of an AI Agent**: configure once and it periodically produces summary reports automatically, without checking `git log` one by one; feeding only the condensed summary to the LLM instead of all raw logs **can significantly save tokens**

### Limitations

- The report is **summarized from git commit messages** and does not perform semantic understanding of the contents
- Therefore, if commit messages are not detailed enough, the report quality will suffer greatly — it is recommended to use well-formed commit messages (e.g. [Conventional Commits](https://www.conventionalcommits.org/), with `git.filter-unconventional` to filter out non-conforming commits)

## Usage

```
# Create .aggregitor.yml in current directory
npx aggregitor init

# Collect and output aggregated git log
npx aggregitor

# Filter by date range (supports git-compatible date formats)
npx aggregitor --since "2024-01-01" --until "2024-12-31"
npx aggregitor --since "1 week ago"

# Verbose output
npx aggregitor --verbose

# Show version
npx aggregitor --version
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--since <date>` | Only include commits after this date (inclusive). Examples: `"2024-01-01"`, `"1 week ago"`, `"2024-06-01 00:00:00"` |
| `--until <date>` | Only include commits before this date (inclusive). Same format as `--since` |
| `--verbose` | Print detailed processing logs to stderr |

## Configuration

All configuration is in `.aggregitor.yml` (single file, includes the Markdown template).
See [example](./docs/.aggregitor.yml.example) for the full reference.

### Output formats

- **json** — Fixed schema output (see [example](./docs/example-output.json))
- **md** — Template-driven Markdown (default template built-in, or customize via `output.template`)

### Template syntax

| Syntax | Description |
|--------|-------------|
| `{{ variable }}` | Interpolation |
| `{{ variable.nested }}` | Nested property access |
| `{{#each list}}...{{/each}}` | Loop over an array |
| `{{#if value}}...{{/if}}` | Conditional |
| `{{#unless value}}...{{/unless}}` | Inverse conditional |
| `{{! comment }}` | Comment |
