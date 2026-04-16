import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LLMProvider } from '../types/index.js';
import type { FileEntry, PatternInfo, ConventionInfo, DomainConcept } from '../types/index.js';

interface AnalysisResult {
  patterns: PatternInfo[];
  conventions: ConventionInfo[];
  domain: DomainConcept[];
  architecture: string;
}

export async function analyzeWithAI(
  repoRoot: string,
  files: FileEntry[],
  stackSummary: string,
  llm: LLMProvider
): Promise<AnalysisResult> {
  // Sample key files for analysis (prioritize entry points, configs, and representative code)
  const keyFiles = selectKeyFiles(files);

  // Read file contents
  const fileContents: { path: string; content: string }[] = [];
  let totalChars = 0;
  const MAX_CHARS = 100_000; // ~25k tokens, keep under context limits

  for (const file of keyFiles) {
    if (totalChars > MAX_CHARS) break;
    try {
      const content = await readFile(join(repoRoot, file.path), 'utf-8');
      if (content.length > 10_000) continue; // Skip very large files
      fileContents.push({ path: file.path, content });
      totalChars += content.length;
    } catch {
      // Skip unreadable files
    }
  }

  const filesSummary = fileContents
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``)
    .join('\n\n');

  const allFilesList = files.map((f) => f.path).join('\n');

  const response = await llm.chat(
    [
      {
        role: 'user',
        content: `Analyze this codebase and extract patterns, conventions, domain concepts, and architecture.

## Tech Stack
${stackSummary}

## All Files (${files.length} total)
${allFilesList}

## Key File Contents
${filesSummary}

Respond with valid JSON in this exact format:
{
  "patterns": [
    { "category": "routing|state-management|db-access|api-structure|error-handling|auth|other", "description": "...", "examples": ["file1.ts", "file2.ts"], "confidence": 0.8 }
  ],
  "conventions": [
    { "category": "naming|formatting|file-organization|imports|exports|error-handling", "rule": "...", "examples": ["file1.ts"], "confidence": 0.8 }
  ],
  "domain": [
    { "name": "ConceptName", "description": "...", "relatedFiles": ["file1.ts"] }
  ],
  "architecture": "A markdown description of the overall architecture, key components, data flow, and how the application is structured."
}

Be specific and concrete. Reference actual files. Only include patterns you're confident about.`,
      },
    ],
    {
      system: 'You are a senior software architect analyzing a codebase. Output only valid JSON, no markdown fences.',
      maxTokens: 4096,
      temperature: 0.2,
    }
  );

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';

  try {
    // Try to parse, stripping markdown fences if present
    const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(cleaned) as AnalysisResult;
  } catch {
    // If JSON parsing fails, return empty results
    return {
      patterns: [],
      conventions: [],
      domain: [],
      architecture: 'Analysis could not be completed. Re-run `zeno sync` to retry.',
    };
  }
}

function selectKeyFiles(files: FileEntry[]): FileEntry[] {
  const priority: FileEntry[] = [];
  const rest: FileEntry[] = [];

  // Priority patterns (entry points, configs, schemas)
  const priorityPatterns = [
    /^(src\/)?index\.(ts|js|tsx|jsx)$/,
    /^(src\/)?app\.(ts|js|tsx|jsx)$/,
    /^(src\/)?main\.(ts|js|tsx|jsx)$/,
    /^(src\/)?server\.(ts|js|tsx|jsx)$/,
    /package\.json$/,
    /tsconfig\.json$/,
    /\.(config|rc)\.(ts|js|json|yaml|yml)$/,
    /schema\.(ts|js|prisma|graphql|sql)$/,
    /routes?\.(ts|js)$/,
    /router\.(ts|js|tsx)$/,
    /middleware/,
    /models?\//,
    /controllers?\//,
    /services?\//,
    /hooks?\//,
    /utils?\//,
    /lib\//,
    /api\//,
    /README\.md$/i,
  ];

  for (const file of files) {
    if (priorityPatterns.some((p) => p.test(file.path))) {
      priority.push(file);
    } else {
      rest.push(file);
    }
  }

  // Return priority files first, then sample from rest
  const sampled = rest.filter((_, i) => i % Math.max(1, Math.floor(rest.length / 20)) === 0);
  return [...priority.slice(0, 30), ...sampled.slice(0, 20)];
}
