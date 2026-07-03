#!/usr/bin/env node

async function main() {
  const args = process.argv.slice(2);

  // Extract --verbose from any position before matching subcommands
  const verbose = args.includes("--verbose");
  const cleanArgs = args.filter((a) => a !== "--verbose");

  if (cleanArgs[0] === "init") {
    const { initCommand } = await import("./commands/init.js");
    await initCommand();
  } else if (cleanArgs[0] === "--version" || cleanArgs[0] === "-V") {
    console.log("0.1.0");
  } else if (cleanArgs[0] === "--help" || cleanArgs[0] === "-h") {
    console.log(`
aggregitor - Generate aggregated git commit logs from multiple git folders

Usage:
  aggregitor init         Create .aggregitor.yml in current directory
  aggregitor [--verbose]  Read config and output aggregated git log
  aggregitor --version    Show version
  aggregitor --help       Show this help
`);
  } else {
    const { runCommand } = await import("./commands/run.js");
    await runCommand({ verbose });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
