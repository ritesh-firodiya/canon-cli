import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const ZENO_DIR = '.zeno';

export function getZenoDir(repoRoot: string): string {
  return join(repoRoot, ZENO_DIR);
}

export async function ensureZenoDir(repoRoot: string): Promise<string> {
  const zenoDir = getZenoDir(repoRoot);
  const dirs = ['docs', 'patterns', 'memory', 'skills', 'plans'];
  for (const dir of dirs) {
    const dirPath = join(zenoDir, dir);
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }
  return zenoDir;
}

export function zenoExists(repoRoot: string): boolean {
  return existsSync(getZenoDir(repoRoot));
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export async function readMarkdownFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf-8');
}

export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required.\n' +
      'Set it with: export ANTHROPIC_API_KEY=your-key-here'
    );
  }
  return key;
}
