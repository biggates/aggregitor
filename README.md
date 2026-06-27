# aggregitor

Generate aggregated git commit logs from multiple git folders.

## Usage

```
# Create .aggregitor.yml in current directory
npx aggregitor init

# Read config and output aggregated git log
npx aggregitor

# Show version
npx aggregitor --version
```

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
