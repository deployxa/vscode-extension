import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Readable } from 'node:stream';

/**
 * Folders Deployxa should never package and upload to the Engine, even when a
 * vibe coder's project folder contains them. Mirrors the frontend exclusions.
 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.cache', 'dist', 'build', '.turbo', '.parcel-cache', 'coverage', '.vercel', '.deployxa']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', '.npmrc']);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB — matches the Engine limit

/**
 * Parse a `.deployxaignore` file into a set of glob-style patterns that are
 * converted to minimatch-compatible exclusion flags for `tar --exclude`.
 * Falls back to the built-in skip lists when no file is present.
 */
function readIgnoreFile(folder: string): string[] {
  const ignorePath = join(folder, '.deployxaignore');
  if (!existsSync(ignorePath)) return [];
  const lines = readFileSync(ignorePath, 'utf8').split('\n').map(line => line.trim());
  return lines.filter(line => line && !line.startsWith('#'));
}

/** Build the full exclusion list: built-in defaults + user-supplied `.deployxaignore`. */
function exclusionPatterns(folder: string): string[] {
  return [...SKIP_DIRS, ...SKIP_FILES, ...readIgnoreFile(folder)];
}

/** Check whether the system `tar` binary is available before spawning it. */
export function isTarAvailable(): boolean {
  try { execFileSync('tar', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

export interface ArchiveResult {
  stream: Readable;
  filename: string;
  size: number;
  /** Resolves with the total uncompressed file size, for progress estimation. */
  estimatedSize: number;
  cleanup(): void;
}

/**
 * Produce a streaming .tar.gz of a project folder without writing the whole
 * archive to disk first. Uses the system `tar` (shipped on macOS, Linux, and
 * Windows 10+) and excludes build artifacts / dependencies the Engine will
 * regenerate during the build. Honors a `.deployxaignore` file if present.
 */
export function archiveFolder(folder: string): ArchiveResult {
  const filename = `${basename(folder) || 'project'}.tar.gz`;
  const estimatedSize = estimateFolderSize(folder);
  // --exclude keeps node_modules, build output, and VCS metadata out of the
  // archive so it stays small and the Engine regenerates them during the build.
  const excludeArgs = exclusionPatterns(folder).flatMap(pattern => ['--exclude', pattern]);
  const tar = spawn('tar', ['-czf', '-', ...excludeArgs, '-C', folder, '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const stream = tar.stdout as Readable;

  // If tar fails to start (e.g. missing on a very old Windows build), surface a
  // clear error through the stream so the caller can show a friendly message.
  tar.on('error', error => stream.destroy(new Error(`Could not package the folder: ${error.message}. Make sure \`tar\` is available on your system.`)));

  return { stream, filename, size: 0, estimatedSize, cleanup: () => { try { tar.kill(); } catch {} } };
}

/**
 * A defensive size guard: walk the folder and reject uploads above the Engine
 * limit before opening a network stream, so the user gets an immediate, clear
 * message instead of a mid-upload abort. Honors `.deployxaignore` patterns.
 */
function matchesIgnore(entry: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === entry) return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      if (regex.test(entry)) return true;
    }
  }
  return false;
}

export function estimateFolderSize(folder: string): number {
  const extraIgnore = readIgnoreFile(folder);
  let total = 0;
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry) || matchesIgnore(entry, extraIgnore)) continue;
      const full = join(dir, entry);
      try {
        const stats = statSync(full);
        if (stats.isDirectory()) walk(full);
        else total += stats.size;
      } catch {}
    }
  };
  walk(folder);
  return total;
}

export const UPLOAD_LIMIT = MAX_UPLOAD_BYTES;
export const uploadLimitMessage = `Your project folder is larger than Deployxa's 100 MB upload limit after excluding build artifacts. Remove large files (videos, datasets, node_modules) or add a \`.deployxaignore\` file and try again.`;
export const tarMissingMessage = `Deployxa could not find the \`tar\` command on your system. It ships with macOS, Linux, and Windows 10+ (inside "bsdtar"). Install it or add its directory to your PATH and try again.`;
