import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

export interface GitCommit {
  hash: string;
  author: string;
  time: string;
  message: string;
  branch: string;
  lines: {
    additions: number;
    deletions: number;
  };
}

export interface GitTag {
  name: string;
  hash: string;
  time: string;
}

export interface RepoData {
  name: string;
  path: string;
  total_commits: number;
  summary: {
    total_additions: number;
    total_deletions: number;
  };
  tags: GitTag[];
  commits: GitCommit[];
}

export interface SummaryData {
  generated_at: string;
  begin_time: string;
  end_time: string;
  tool: {
    name: string;
    version: string;
  };
  repos: RepoData[];
}

interface FetchOptions {
  authors?: { email?: string; name?: string }[];
  fetchRemote?: boolean;
  filterUnconventional?: boolean;
  onlyTags?: boolean;
  tagPattern?: string;
  branchPattern?: string;
}

function runGit(repoPath: string, args: string[]): string {
  try {
    const result = spawnSync("git", args, {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.status !== 0) return "";
    return result.stdout;
  } catch {
    return "";
  }
}

function getRepoName(repoPath: string): string {
  const base = repoPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const last = base.split("/").pop() || base;
  return last.replace(/\.git$/, "");
}

export function collectRepoData(repoPath: string, opts: FetchOptions): RepoData | null {
  if (!existsSync(join(repoPath, ".git"))) return null;

  if (opts.fetchRemote) {
    runGit(repoPath, ["fetch", "--all", "--tags", "--force"]);
  }

  const tags = collectTags(repoPath);
  const commits = collectCommits(repoPath, opts, tags);
  if (commits.length === 0) return null;

  let totalAdd = 0;
  let totalDel = 0;
  for (const c of commits) {
    totalAdd += c.lines.additions;
    totalDel += c.lines.deletions;
  }

  return {
    name: getRepoName(repoPath),
    path: repoPath,
    total_commits: commits.length,
    summary: { total_additions: totalAdd, total_deletions: totalDel },
    tags,
    commits,
  };
}

function collectTags(repoPath: string): GitTag[] {
  const raw = runGit(repoPath, [
    "tag",
    "--sort=-creatordate",
    "--format=%(refname:short)%x00%(objectname:short)%x00%(creatordate:iso-strict)",
  ]);
  if (!raw.trim()) return [];

  return raw
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split("\0");
      if (parts.length < 3) return null;
      return { name: parts[0], hash: parts[1], time: parts[2] };
    })
    .filter((t): t is GitTag => t !== null);
}

function collectCommits(
  repoPath: string,
  opts: FetchOptions,
  tags: GitTag[],
): GitCommit[] {
  const logArgs = [
    "log",
    "--all",
    "--format=%H%x00%an <%ae>%x00%aI%x00%s%x00%D",
    "--numstat",
    "--no-merges",
    "--reverse",
  ];

  const raw = runGit(repoPath, logArgs);
  if (!raw.trim()) return [];

  const blocks = raw.trim().split("\n\n");
  if (blocks.length < 2) return [];

  const entries: string[] = [];
  for (let i = 0; i < blocks.length - 1; i += 2) {
    entries.push(blocks[i] + "\n" + blocks[i + 1]);
  }

  const commits: GitCommit[] = [];
  const tagHashes = new Set(tags.map((t) => t.hash));

  for (let i = 0; i < entries.length; i++) {
    const block = entries[i];
    const [metaLine, ...statLines] = block.split("\n");
    if (!metaLine) continue;

    const metaParts = metaLine.split("\0");
    if (metaParts.length < 5) continue;

    const hash = metaParts[0].slice(0, 7);
    const author = metaParts[1];
    const time = metaParts[2];
    const message = metaParts[3];
    const refs = metaParts[4] || "";

    const branch = extractBranch(refs);

    if (opts.onlyTags && !tagHashes.has(hash) && !refs.includes("tag: ")) continue;
    if (opts.tagPattern && !tagHashes.has(hash)) {
      const matched = tags.some((t) => new RegExp(opts.tagPattern!).test(t.name));
      if (!matched) continue;
    }
    if (opts.branchPattern && !new RegExp(opts.branchPattern).test(branch)) continue;
    if (opts.authors && opts.authors.length > 0) {
      const matched = opts.authors.some((a) => {
        if (a.email && author.includes(a.email)) return true;
        if (a.name && author.startsWith(a.name + " <")) return true;
        return false;
      });
      if (!matched) continue;
    }
    if (opts.filterUnconventional) {
      const conventionalRe = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s/;
      if (!conventionalRe.test(message)) continue;
    }

    let additions = 0;
    let deletions = 0;
    for (const s of statLines) {
      if (!s.trim()) continue;
      const parts = s.trim().split("\t");
      if (parts.length < 3) continue;
      if (parts[0] !== "-") additions += parseInt(parts[0], 10) || 0;
      if (parts[1] !== "-") deletions += parseInt(parts[1], 10) || 0;
    }

    commits.push({ hash, author, time, message, branch, lines: { additions, deletions } });
  }

  return commits;
}

function extractBranch(refs: string): string {
  if (!refs) return "unknown";
  const m = refs.match(/HEAD -> ([^\s,]+)/);
  return m ? m[1] : "unknown";
}

export function generateSummary(
  repos: RepoData[],
  beginTime: string,
  endTime: string,
  version: string,
): SummaryData {
  return {
    generated_at: new Date().toISOString(),
    begin_time: beginTime,
    end_time: endTime,
    tool: { name: "aggregitor", version },
    repos,
  };
}
