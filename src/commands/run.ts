import { writeFileSync } from "fs";
import { loadConfig, findConfigPath, DEFAULT_TEMPLATE, resolveRepos } from "../core/config.js";
import { collectRepoData, generateSummary } from "../core/git.js";
import { parseTemplate, renderTemplate } from "../core/template.js";

const VERSION = "0.1.0";

export async function runCommand(): Promise<void> {
  const configPath = findConfigPath();
  if (!configPath) {
    console.error("No .aggregitor.yml found in current directory. Run 'aggregitor init' first.");
    process.exit(1);
  }

  const config = loadConfig(configPath);
  if (config.repos.length === 0) {
    console.error("No repos configured in .aggregitor.yml");
    process.exit(1);
  }

  const absRepos = resolveRepos(config.repos);
  const reposData = [];
  const timestamps: string[] = [];

  for (const repoPath of absRepos) {
    const data = collectRepoData(repoPath, {
      authors: config.git.authors,
      fetchRemote: config.git["fetch-remote"],
      filterUnconventional: config.git["filter-unconventional"],
      onlyTags: config.git["only-tags"],
      tagPattern: config.git["tag-pattern"],
      branchPattern: config.git["branch-pattern"],
    });
    if (data) {
      reposData.push(data);
      if (data.commits.length > 0) {
        timestamps.push(data.commits[0].time, data.commits[data.commits.length - 1].time);
      }
    }
  }

  if (reposData.length === 0) {
    console.error("No data collected from any repository.");
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
