import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import fg from 'fast-glob';
import type { LLMTool } from '../types/index.js';

export interface ToolDefinition {
  spec: LLMTool;
  execute: (input: Record<string, unknown>, repoRoot: string) => Promise<string>;
}

export const agentTools: ToolDefinition[] = [
  {
    spec: {
      name: 'read_file',
      description: 'Read the contents of a file. Returns the full file content.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from repo root' },
        },
        required: ['path'],
      },
    },
    execute: async (input, repoRoot) => {
      const filePath = join(repoRoot, input.path as string);
      if (!existsSync(filePath)) {
        return `Error: File not found: ${input.path}`;
      }
      try {
        const content = await readFile(filePath, 'utf-8');
        if (content.length > 50_000) {
          return content.slice(0, 50_000) + '\n\n[...truncated, file too large]';
        }
        return content;
      } catch (e) {
        return `Error reading file: ${(e as Error).message}`;
      }
    },
  },
  {
    spec: {
      name: 'write_file',
      description: 'Write content to a file. Creates parent directories if needed. Use this to create new files or overwrite existing ones.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from repo root' },
          content: { type: 'string', description: 'File content to write' },
        },
        required: ['path', 'content'],
      },
    },
    execute: async (input, repoRoot) => {
      const filePath = join(repoRoot, input.path as string);
      try {
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }
        await writeFile(filePath, input.content as string, 'utf-8');
        return `Successfully wrote to ${input.path}`;
      } catch (e) {
        return `Error writing file: ${(e as Error).message}`;
      }
    },
  },
  {
    spec: {
      name: 'edit_file',
      description: 'Replace a specific string in a file with new content. Use this for targeted edits instead of rewriting entire files.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from repo root' },
          old_text: { type: 'string', description: 'Exact text to find and replace' },
          new_text: { type: 'string', description: 'Text to replace it with' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
    execute: async (input, repoRoot) => {
      const filePath = join(repoRoot, input.path as string);
      try {
        const content = await readFile(filePath, 'utf-8');
        const oldText = input.old_text as string;
        if (!content.includes(oldText)) {
          return `Error: Could not find the specified text in ${input.path}. Make sure the old_text matches exactly.`;
        }
        const newContent = content.replace(oldText, input.new_text as string);
        await writeFile(filePath, newContent, 'utf-8');
        return `Successfully edited ${input.path}`;
      } catch (e) {
        return `Error editing file: ${(e as Error).message}`;
      }
    },
  },
  {
    spec: {
      name: 'search_code',
      description: 'Search for files matching a glob pattern OR search for text content across files.',
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts") or text to search for' },
          mode: { type: 'string', enum: ['glob', 'content'], description: 'Search mode: glob for file patterns, content for text search' },
        },
        required: ['pattern', 'mode'],
      },
    },
    execute: async (input, repoRoot) => {
      const pattern = input.pattern as string;
      const mode = input.mode as string;

      if (mode === 'glob') {
        try {
          const files = await fg(pattern, {
            cwd: repoRoot,
            ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.zeno/**'],
          });
          if (files.length === 0) return 'No files found matching pattern.';
          return files.slice(0, 100).join('\n') + (files.length > 100 ? `\n...and ${files.length - 100} more` : '');
        } catch (e) {
          return `Error: ${(e as Error).message}`;
        }
      }

      // Content search using grep
      try {
        const result = execSync(
          `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" --include="*.json" --include="*.yaml" --include="*.yml" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=.zeno -l "${pattern.replace(/"/g, '\\"')}" .`,
          { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 1024 * 1024 }
        );
        const files = result.trim().split('\n').filter(Boolean);
        if (files.length === 0) return 'No matches found.';
        return files.slice(0, 50).join('\n') + (files.length > 50 ? `\n...and ${files.length - 50} more` : '');
      } catch {
        return 'No matches found.';
      }
    },
  },
  {
    spec: {
      name: 'run_command',
      description: 'Run a shell command in the repo directory. Use for running tests, linting, type checking, etc. Do NOT use for destructive operations.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
    },
    execute: async (input, repoRoot) => {
      const command = input.command as string;

      // Block dangerous commands
      const blocked = ['rm -rf /', 'rm -rf ~', 'dd if=', 'mkfs', ':(){', 'fork bomb'];
      if (blocked.some((b) => command.includes(b))) {
        return 'Error: This command is blocked for safety reasons.';
      }

      try {
        const output = execSync(command, {
          cwd: repoRoot,
          encoding: 'utf-8',
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        });
        const trimmed = output.trim();
        if (trimmed.length > 10_000) {
          return trimmed.slice(0, 10_000) + '\n\n[...truncated]';
        }
        return trimmed || '(command completed with no output)';
      } catch (e) {
        const err = e as { stderr?: string; stdout?: string; message: string };
        return `Command failed:\n${err.stderr || err.stdout || err.message}`.slice(0, 5000);
      }
    },
  },
  {
    spec: {
      name: 'list_directory',
      description: 'List files and directories in a given path.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from repo root (default: root)' },
        },
        required: [],
      },
    },
    execute: async (input, repoRoot) => {
      const dirPath = join(repoRoot, (input.path as string) || '.');
      try {
        const entries = await fg('*', { cwd: dirPath, onlyFiles: false, dot: true });
        return entries.sort().join('\n') || '(empty directory)';
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
];

export function getToolSpecs(): LLMTool[] {
  return agentTools.map((t) => t.spec);
}

export function getToolExecutor(
  repoRoot: string
): (name: string, input: Record<string, unknown>) => Promise<string> {
  return async (name, input) => {
    const tool = agentTools.find((t) => t.spec.name === name);
    if (!tool) return `Error: Unknown tool: ${name}`;
    return tool.execute(input, repoRoot);
  };
}
