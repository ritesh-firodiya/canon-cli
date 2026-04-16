import { scanFileTree, getLanguageBreakdown, getDirectoryStructure } from './file-tree.js';
import { detectStack } from './stack-detector.js';
import type { FileEntry, StackInfo } from '../types/index.js';

export interface ScanResult {
  files: FileEntry[];
  stack: StackInfo;
  languages: Record<string, number>;
  directories: string[];
  totalFiles: number;
}

export async function scanRepo(repoRoot: string): Promise<ScanResult> {
  const files = await scanFileTree(repoRoot);
  const stack = await detectStack(repoRoot, files);
  const languages = getLanguageBreakdown(files);
  const directories = getDirectoryStructure(files);

  return {
    files,
    stack,
    languages,
    directories,
    totalFiles: files.length,
  };
}

export { scanFileTree, getLanguageBreakdown, getDirectoryStructure } from './file-tree.js';
export { detectStack } from './stack-detector.js';
