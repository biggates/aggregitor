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
  verbose?: boolean;
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

/**
 * Resolve refs/remotes/origin/HEAD to get the default branch name
 * (e.g. "origin/master" -> "master"). Returns "" if resolution fails.
 */
function resolveRemoteHeadDefault(repoPath: string): string {
  const raw = runGit(repoPath, ["rev-parse", "--abbrev-ref", "refs/remotes/origin/HEAD"]);
  if (!raw.trim()) return "";
  // Output looks like "origin/master" or "origin/main"
  const m = raw.trim().match(/^[^/]+\/(.+)$/);
  return m ? m[1] : raw.trim();
}

export function collectRepoData(repoPath: string, opts: FetchOptions): RepoData | null {
  if (!existsSync(join(repoPath, ".git"))) {
    if (opts.verbose) console.error(`[verbose] Skipping ${repoPath}: .git directory not found`);
    return null;
  }

  if (opts.fetchRemote) {
    if (opts.verbose) console.error(`[verbose] Fetching remote for ${repoPath}`);
    runGit(repoPath, ["fetch", "--all", "--tags", "--force"]);
  }

  // Resolve remote HEAD symbolic ref once per repo, for commits where
  // %S yields refs/remotes/origin/HEAD (the remote default branch pointer)
  const defaultBranch = resolveRemoteHeadDefault(repoPath);

  const tags = collectTags(repoPath, opts);
  if (opts.verbose) console.error(`[verbose]   tags found: ${tags.length}`);
  const commits = collectCommits(repoPath, opts, tags, defaultBranch);
  if (commits.length === 0) {
    if (opts.verbose) console.error(`[verbose]   no commits collected (filter or git log returned empty)`);
    return null;
  }
  if (opts.verbose) console.error(`[verbose]   commits collected: ${commits.length} (after filtering)`);

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

function collectTags(repoPath: string, opts: FetchOptions): GitTag[] {
  const raw = runGit(repoPath, [
    "tag",
    "--sort=-creatordate",
    "--format=%(refname:short)%x00%(objectname:short)%x00%(creatordate:iso-strict)",
  ]);
  if (!raw.trim()) return [];

  let tags = raw
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split("\0");
      if (parts.length < 3) return null;
      return { name: parts[0], hash: parts[1], time: parts[2] };
    })
    .filter((t): t is GitTag => t !== null);

  // Apply tag-pattern filter at the tag level
  if (opts.tagPattern) {
    const re = new RegExp(opts.tagPattern);
    tags = tags.filter((t) => re.test(t.name));
  }

  return tags;
}

function collectCommits(
  repoPath: string,
  opts: FetchOptions,
  tags: GitTag[],
  defaultBranch: string,
): GitCommit[] {
  const logArgs = [
    "log",
    "--all",
    "--format=%H%x00%an <%ae>%x00%aI%x00%s%x00%D%x00%S",
    "--numstat",
    "--no-merges",
    "--reverse",
  ];

  const raw = runGit(repoPath, logArgs);
  if (!raw.trim()) {
    if (opts.verbose) console.error(`[verbose]   git log returned empty output`);
    return [];
  }

  const lines = raw.trim().split("\n");
  const commits: GitCommit[] = [];
  const tagHashes = new Set(tags.map((t) => t.hash));
  let currentMeta: string | null = null;
  let currentStatLines: string[] = [];
  let totalBeforeFilter = 0;

  for (const line of lines) {
    if (line.includes("\0")) {
      if (currentMeta) {
        const before = commits.length;
        processCommit(currentMeta, currentStatLines, commits, opts, tagHashes, tags, defaultBranch);
        totalBeforeFilter++;
        if (opts.verbose && commits.length === before) {
          const parts = currentMeta.split("\0");
          console.error(`[verbose]   filtered out commit: ${parts[0]?.slice(0, 7) || "?"} "${parts[3] || "?"}"`);
        }
      }
      currentMeta = line;
      currentStatLines = [];
    } else {
      currentStatLines.push(line);
    }
  }
  if (currentMeta) {
    const before = commits.length;
    processCommit(currentMeta, currentStatLines, commits, opts, tagHashes, tags, defaultBranch);
    totalBeforeFilter++;
    if (opts.verbose && commits.length === before) {
      const parts = currentMeta.split("\0");
      console.error(`[verbose]   filtered out commit: ${parts[0]?.slice(0, 7) || "?"} "${parts[3] || "?"}"`);
    }
  }

  if (opts.verbose) console.error(`[verbose]   commits before filter: ${totalBeforeFilter}, after filter: ${commits.length}`);

  return commits;
}

function processCommit(
  metaLine: string,
  statLines: string[],
  commits: GitCommit[],
  opts: FetchOptions,
  tagHashes: Set<string>,
  tags: GitTag[],
  defaultBranch: string,
) {
  const metaParts = metaLine.split("\0");
  if (metaParts.length < 5) return;

  const hash = metaParts[0].slice(0, 7);
  const author = metaParts[1];
  const time = metaParts[2];
  const message = metaParts[3];
  const refs = metaParts[4] || "";
  const source = metaParts[5] || "";  // %S: ref name by which commit was reached (git 2.21+)
  const branch = extractBranch(refs, source, defaultBranch);

  if (opts.onlyTags && !tagHashes.has(hash) && !refs.includes("tag: ")) return;
  if (opts.branchPattern && !new RegExp(opts.branchPattern).test(branch)) return;
  if (opts.authors && opts.authors.length > 0) {
    const matched = opts.authors.some((a) => {
      if (a.email && author.includes(a.email)) return true;
      if (a.name && author.startsWith(a.name + " <")) return true;
      return false;
    });
    if (!matched) return;
  }
  if (opts.filterUnconventional) {
    const conventionalRe = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s/;
    if (!conventionalRe.test(message)) return;
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

/**
 * Extract the branch name from git ref names (%D) and source ref (%S).
 * %D contains refs pointing to the commit (only populated for branch tips,
 * HEAD, tags). %S contains the ref name used to reach the commit (git 2.21+).
 * Priority: %D HEAD -> branch > %S (stripped) > %D refs/heads > defaultBranch.
 */
function extractBranch(refs: string, source: string, defaultBranch: string): string {
  // Priority 1: HEAD -> branch from %D (current checked-out branch)
  if (refs) {
    const parts = refs.split(", ");
    for (const part of parts) {
      const m = part.match(/^HEAD\s*->\s*(.+)$/);
      if (m) return m[1].trim();
    }
    // Priority 2: refs/heads/branch or remote/branch from %D
    for (const part of parts) {
      if (part.startsWith("tag: ")) continue;
      const cleaned = part.replace(/^refs\/heads\//, "");
      const m2 = cleaned.match(/^[^/]+\/(.+)$/);
      if (m2 && m2[1] !== "HEAD") return m2[1];
      if (!cleaned.includes("/") && cleaned !== "HEAD") return cleaned;
    }
  }

  // Priority 3: fallback to %S (works for all commits when using --all)
  if (source) {
    // Strip refs/heads/ or refs/remotes/<remote>/ prefix
    const cleaned = source
      .replace(/^refs\/heads\//, "")
      .replace(/^refs\/remotes\/[^/]+\//, "");
    // Skip bare HEAD refs (remote default branch pointers) - use resolved default branch
    if (cleaned === "HEAD") return defaultBranch || "unknown";
    if (cleaned && cleaned !== source) return cleaned;
  }

  // Priority 4: use default branch resolved from remote HEAD
  if (defaultBranch) return defaultBranch;

  return "unknown";
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
