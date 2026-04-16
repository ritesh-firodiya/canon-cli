import fg from 'fast-glob';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { FileEntry } from '../types/index.js';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.kt': 'kotlin', '.swift': 'swift', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c',
  '.php': 'php', '.dart': 'dart', '.vue': 'vue', '.svelte': 'svelte',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.md': 'markdown', '.sql': 'sql', '.sh': 'shell', '.bash': 'shell',
  '.dockerfile': 'docker', '.tf': 'terraform', '.prisma': 'prisma',
};

const IGNORE_PATTERNS = [
  '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**',
  '**/coverage/**', '**/.next/**', '**/.nuxt/**', '**/vendor/**',
  '**/__pycache__/**', '**/.venv/**', '**/venv/**', '**/.zeno/**',
  '**/target/**', '**/bin/**', '**/obj/**', '**/.idea/**', '**/.vscode/**',
  '**/*.min.js', '**/*.min.css', '**/package-lock.json', '**/yarn.lock',
  '**/pnpm-lock.yaml', '**/Cargo.lock', '**/poetry.lock',
];

export async function scanFileTree(repoRoot: string): Promise<FileEntry[]> {
  const files = await fg('**/*', {
    cwd: repoRoot,
    ignore: IGNORE_PATTERNS,
    dot: true,
    onlyFiles: true,
    stats: true,
  });

  const entries: FileEntry[] = [];

  for (const file of files) {
    const ext = extname(file.path).toLowerCase();
    const fileStat = file.stats;

    entries.push({
      path: file.path,
      type: 'file',
      language: LANGUAGE_MAP[ext],
      size: fileStat?.size,
    });
  }

  // Sort by path for consistent output
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return entries;
}

export function getLanguageBreakdown(files: FileEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    if (file.language) {
      counts[file.language] = (counts[file.language] || 0) + 1;
    }
  }
  return counts;
}

export function getDirectoryStructure(files: FileEntry[]): string[] {
  const dirs = new Set<string>();
  for (const file of files) {
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  return Array.from(dirs).sort();
}
