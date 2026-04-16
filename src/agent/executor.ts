import type { LLMProvider } from '../types/index.js';
import type { MemoryStore } from '../memory/store.js';
import { runAgentLoop, type AgentResult } from './loop.js';
import { createBranch, getCurrentBranch, commitAll, switchBranch } from '../git/index.js';

export interface ExecutionOptions {
  repoRoot: string;
  llm: LLMProvider;
  store: MemoryStore;
  task: string;
  planId: string;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
  onThinking?: (text: string) => void;
  onAskUser?: (question: string) => Promise<string>;
}

export interface ExecutionResult {
  success: boolean;
  branch: string;
  commitHash?: string;
  agentResult: AgentResult;
}

export async function executeTask(options: ExecutionOptions): Promise<ExecutionResult> {
  const {
    repoRoot,
    llm,
    store,
    task,
    planId,
    onToolCall,
    onToolResult,
    onThinking,
    onAskUser,
  } = options;

  // Get codebase context
  const memorySummary = await store.getSummary();
  const conventions = await store.getConventions();
  const patterns = await store.getPatterns();

  // Create feature branch
  const originalBranch = await getCurrentBranch(repoRoot);
  const branchName = `feat/${planId}-${slugify(task)}`;

  try {
    await createBranch(repoRoot, branchName);
  } catch {
    // Branch might already exist
    await switchBranch(repoRoot, branchName);
  }

  await store.updatePlanStatus(planId, 'in-progress', branchName);

  const conventionRules = conventions
    ? conventions.map((c) => `- ${c.category}: ${c.rule}`).join('\n')
    : 'No conventions detected yet.';

  const patternRules = patterns
    ? patterns.map((p) => `- ${p.category}: ${p.description}`).join('\n')
    : 'No patterns detected yet.';

  const systemPrompt = `You are Zeno, an AI development agent working on a codebase. Your job is to complete the given task by reading, writing, and editing code files.

## Codebase Context
${memorySummary}

## Coding Conventions (FOLLOW THESE)
${conventionRules}

## Code Patterns (FOLLOW THESE)
${patternRules}

## Rules
1. Read existing code before modifying it to understand context
2. Follow the existing coding conventions and patterns exactly
3. Write clean, production-quality code
4. If the project has tests, add or update tests for your changes
5. Run existing tests/linters if available to verify your changes
6. If something is unclear, use the ask_user tool to ask
7. Make focused, minimal changes — don't refactor unrelated code
8. Create files only when necessary — prefer editing existing ones`;

  const agentResult = await runAgentLoop(
    `Complete this development task:\n\n${task}\n\nWork on the feature branch "${branchName}". Make the necessary code changes and verify they work.`,
    {
      repoRoot,
      llm,
      systemPrompt,
      maxIterations: 30,
      onToolCall,
      onToolResult,
      onThinking,
      onAskUser,
    }
  );

  // Commit changes
  let commitHash: string | undefined;
  try {
    commitHash = await commitAll(repoRoot, `feat(${planId}): ${task}`);
  } catch {
    // No changes to commit, or commit failed
  }

  if (agentResult.success) {
    await store.updatePlanStatus(planId, 'completed', branchName);
  }

  return {
    success: agentResult.success,
    branch: branchName,
    commitHash,
    agentResult,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
