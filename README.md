# aggregitor

Generate aggregated git commit logs from multiple git folders.

[中文文档](./README_CN.md)

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
