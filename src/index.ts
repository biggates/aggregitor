#!/usr/bin/env node

async function main() {
  const args = process.argv.slice(2);

  // Extract flag options from any position before matching subcommands
  const verbose = args.includes("--verbose");
  const sinceIdx = args.indexOf("--since");
  const since = sinceIdx !== -1 ? args[sinceIdx + 1] : undefined;
  const untilIdx = args.indexOf("--until");
  const until = untilIdx !== -1 ? args[untilIdx + 1] : undefined;

  const cleanArgs = args.filter((a, i) => {
    if (a === "--verbose") return false;
    if (a === "--since" || a === "--until") return false;
    // Also skip the value immediately after --since or --until
    if (i > 0 && (args[i - 1] === "--since" || args[i - 1] === "--until")) return false;
    return true;
  });

  if (cleanArgs[0] === "init") {
    const { initCommand } = await import("./commands/init.js");
    await initCommand();
  } else if (cleanArgs[0] === "--version" || cleanArgs[0] === "-V") {
    console.log("0.1.0");
  } else if (cleanArgs[0] === "--help" || cleanArgs[0] === "-h") {
    console.log(`
aggregitor - Generate aggregated git commit logs from multiple git folders

Usage:
  aggregitor init                            Create .aggregitor.yml in current directory
  aggregitor [--verbose] [--since <date>] [--until <date>]  Read config and output aggregated git log
  aggregitor --version                       Show version
  aggregitor --help                          Show this help

Date format examples: "2024-01-01", "1 week ago", "2024-06-01 00:00:00"
`);
  } else {
    const { runCommand } = await import("./commands/run.js");
    await runCommand({ verbose, since, until });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
