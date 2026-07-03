import { writeFileSync } from "fs";
import { loadConfig, findConfigPath, DEFAULT_TEMPLATE, resolveRepos, expandRepoPaths } from "../core/config.js";
import { collectRepoData, generateSummary } from "../core/git.js";
import { parseTemplate, renderTemplate } from "../core/template.js";

const VERSION = "0.1.0";

export interface RunOptions {
  verbose?: boolean;
  since?: string;
  until?: string;
}

function verboseLog(opts: RunOptions, msg: string): void {
  if (opts.verbose) {
    console.error(`[verbose] ${msg}`);
  }
}

export async function runCommand(opts: RunOptions = {}): Promise<void> {
  verboseLog(opts, `Working directory: ${process.cwd()}`);

  const configPath = findConfigPath();
  if (!configPath) {
    console.error("No .aggregitor.yml found in current directory. Run 'aggregitor init' first.");
    process.exit(1);
  }
  verboseLog(opts, `Config file found: ${configPath}`);

  const config = loadConfig(configPath);
  if (config.repos.length === 0) {
    console.error("No repos configured in .aggregitor.yml");
    process.exit(1);
  }
  verboseLog(opts, `Configured repos (${config.repos.length}): ${config.repos.join(", ")}`);
  verboseLog(opts, `Config: format=${config.output.format}, fetchRemote=${config.git["fetch-remote"]}, filterUnconventional=${config.git["filter-unconventional"]}, onlyTags=${config.git["only-tags"]}`);

  const absRepos = expandRepoPaths(resolveRepos(config.repos));
  verboseLog(opts, `Resolved repos (${absRepos.length}): ${absRepos.join(", ")}`);
  const reposData = [];
  const timestamps: string[] = [];

  for (const repoPath of absRepos) {
    verboseLog(opts, `Collecting data from: ${repoPath}`);
    const data = collectRepoData(repoPath, {
      authors: config.git.authors,
      fetchRemote: config.git["fetch-remote"],
      filterUnconventional: config.git["filter-unconventional"],
      onlyTags: config.git["only-tags"],
      tagPattern: config.git["tag-pattern"],
      branchPattern: config.git["branch-pattern"],
      verbose: opts.verbose,
      since: opts.since,
      until: opts.until,
    });
    if (data) {
      verboseLog(opts, `  -> ${data.commits.length} commits, ${data.tags.length} tags collected`);
      reposData.push(data);
      if (data.commits.length > 0) {
        timestamps.push(data.commits[0].time, data.commits[data.commits.length - 1].time);
      }
    } else {
      verboseLog(opts, `  -> No data (repo may be missing .git or have no matching commits)`);
    }
  }

  if (reposData.length === 0) {
    console.error("No data collected from any repository.");
    if (!opts.verbose) {
      console.error("Tip: run with --verbose for more details.");
    }
    process.exit(1);
  }

  timestamps.sort();
  const beginTime = timestamps[0] || new Date().toISOString();
  const endTime = timestamps[timestamps.length - 1] || new Date().toISOString();

  const summary = generateSummary(reposData, beginTime, endTime, VERSION);

  if (config.output.format === "json") {
    const json = JSON.stringify(summary, null, 2) + "\n";
    if (config.output.dest) {
      writeFileSync(config.output.dest, json, "utf-8");
    } else {
      process.stdout.write(json);
    }
  } else {
    const tpl = config.output.template || DEFAULT_TEMPLATE;
    const nodes = parseTemplate(tpl);
    const md = renderTemplate(nodes, summary as unknown as Record<string, unknown>);
    if (config.output.dest) {
      writeFileSync(config.output.dest, md, "utf-8");
    } else {
      process.stdout.write(md);
    }
  }
}
