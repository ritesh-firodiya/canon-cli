import type { LLMProvider, LLMMessage, LLMContentBlock } from '../types/index.js';
import { getToolSpecs, getToolExecutor } from './tools.js';

export interface AgentOptions {
  repoRoot: string;
  llm: LLMProvider;
  systemPrompt: string;
  maxIterations?: number;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
  onThinking?: (text: string) => void;
  onAskUser?: (question: string) => Promise<string>;
}

export interface AgentResult {
  success: boolean;
  output: string;
  toolCalls: { name: string; input: Record<string, unknown>; result: string }[];
  totalTokens: { input: number; output: number };
}

export async function runAgentLoop(
  task: string,
  options: AgentOptions
): Promise<AgentResult> {
  const {
    repoRoot,
    llm,
    systemPrompt,
    maxIterations = 30,
    onToolCall,
    onToolResult,
    onThinking,
    onAskUser,
  } = options;

  const tools = getToolSpecs();
  const executeTool = getToolExecutor(repoRoot);

  // Add ask_user tool if callback provided
  if (onAskUser) {
    tools.push({
      name: 'ask_user',
      description: 'Ask the user a question to clarify requirements or get approval. Use when you need more information to proceed.',
      input_schema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to ask the user' },
        },
        required: ['question'],
      },
    });
  }

  const messages: LLMMessage[] = [
    { role: 'user', content: task },
  ];

  const allToolCalls: AgentResult['toolCalls'] = [];
  const totalTokens = { input: 0, output: 0 };
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const response = await llm.chat(messages, {
      system: systemPrompt,
      tools,
      maxTokens: 8192,
    });

    totalTokens.input += response.usage.inputTokens;
    totalTokens.output += response.usage.outputTokens;

    // Process response content
    const assistantContent: LLMContentBlock[] = [];
    let finalText = '';

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        onThinking?.(block.text);
        finalText += block.text;
        assistantContent.push(block);
      } else if (block.type === 'tool_use') {
        assistantContent.push(block);
      }
    }

    // Add assistant message
    messages.push({ role: 'assistant', content: assistantContent });

    // If no tool calls, we're done
    if (response.stopReason !== 'tool_use') {
      return {
        success: true,
        output: finalText,
        toolCalls: allToolCalls,
        totalTokens,
      };
    }

    // Execute tool calls
    const toolResults: LLMContentBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name && block.id) {
        const input = (block.input ?? {}) as Record<string, unknown>;
        onToolCall?.(block.name, input);

        let result: string;

        if (block.name === 'ask_user' && onAskUser) {
          result = await onAskUser(input.question as string);
        } else {
          result = await executeTool(block.name, input);
        }

        onToolResult?.(block.name, result);
        allToolCalls.push({ name: block.name, input, result });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    success: false,
    output: 'Agent reached maximum iterations without completing the task.',
    toolCalls: allToolCalls,
    totalTokens,
  };
}
