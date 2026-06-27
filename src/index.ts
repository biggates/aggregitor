#!/usr/bin/env node

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "init") {
    const { initCommand } = await import("./commands/init.js");
    await initCommand();
  } else if (args[0] === "--version" || args[0] === "-V") {
    console.log(require("../package.json").version);
  } else if (args[0] === "--help" || args[0] === "-h") {
    console.log(`
aggregitor - Generate aggregated git commit logs from multiple git folders

Usage:
  aggregitor init       Create .aggregitor.yml in current directory
  aggregitor            Read config and output aggregated git log
  aggregitor --version  Show version
  aggregitor --help     Show this help
`);
  } else {
    const { runCommand } = await import("./commands/run.js");
    await runCommand();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
