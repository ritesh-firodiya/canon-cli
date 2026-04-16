import type { LLMProvider } from '../types/index.js';
import type { MemoryStore } from '../memory/store.js';

export interface EvaluationResult {
  feasible: boolean;
  confidence: number;
  reason: string;
  suggestedQuestions: string[];
  estimatedComplexity: 'small' | 'medium' | 'large' | 'too-large';
  duplicateOf?: string;
  conflictsWith?: string[];
  subtasks?: string[];
}

export async function evaluateTask(
  task: string,
  store: MemoryStore,
  llm: LLMProvider
): Promise<EvaluationResult> {
  const memorySummary = await store.getSummary();
  const plansIndex = await store.getPlansIndex();

  const existingPlans = plansIndex.plans
    .map((p) => `- [${p.id}] "${p.title}" (${p.status}): ${p.summary}`)
    .join('\n');

  const response = await llm.chat(
    [
      {
        role: 'user',
        content: `Evaluate this task against the codebase context and existing plans.

## Task
${task}

## Codebase Context
${memorySummary}

## Existing Plans
${existingPlans || 'No existing plans.'}

Respond with valid JSON:
{
  "feasible": true/false,
  "confidence": 0.0-1.0,
  "reason": "Why this is or isn't feasible",
  "suggestedQuestions": ["Questions to clarify the task if needed"],
  "estimatedComplexity": "small|medium|large|too-large",
  "duplicateOf": "plan ID if this duplicates an existing plan, or null",
  "conflictsWith": ["plan IDs that conflict with this task"],
  "subtasks": ["If too-large, suggested subtasks to break it down"]
}

Guidelines:
- small: Single file change, under 50 lines
- medium: 2-5 files, under 200 lines
- large: 5+ files, significant changes
- too-large: Requires architectural changes, split into subtasks
- Be conservative with confidence scores
- Ask questions if the task is ambiguous`,
      },
    ],
    {
      system: 'You are a senior software architect evaluating task feasibility. Output only valid JSON.',
      maxTokens: 2048,
      temperature: 0.2,
    }
  );

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';

  try {
    const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(cleaned) as EvaluationResult;
  } catch {
    return {
      feasible: true,
      confidence: 0.5,
      reason: 'Could not evaluate task fully. Proceeding with caution.',
      suggestedQuestions: [],
      estimatedComplexity: 'medium',
    };
  }
}
