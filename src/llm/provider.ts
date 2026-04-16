import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMChatOptions, LLMResponse } from '../types/index.js';

export function createProvider(type: 'claude', options: { apiKey: string; model?: string }): LLMProvider {
  switch (type) {
    case 'claude':
      return createClaudeProvider(options);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

function createClaudeProvider(options: { apiKey: string; model?: string }): LLMProvider {
  const client = new Anthropic({ apiKey: options.apiKey });
  const model = options.model ?? 'claude-sonnet-4-6';

  return {
    async chat(messages: LLMMessage[], chatOptions?: LLMChatOptions): Promise<LLMResponse> {
      const apiMessages = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as Anthropic.MessageParam['content'],
      }));

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: chatOptions?.maxTokens ?? 4096,
        messages: apiMessages,
      };

      if (chatOptions?.system) {
        params.system = chatOptions.system;
      }

      if (chatOptions?.tools && chatOptions.tools.length > 0) {
        params.tools = chatOptions.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        }));
      }

      if (chatOptions?.temperature !== undefined) {
        params.temperature = chatOptions.temperature;
      }

      const response = await client.messages.create(params);

      return {
        content: response.content.map((block) => {
          if (block.type === 'text') {
            return { type: 'text' as const, text: block.text };
          }
          if (block.type === 'tool_use') {
            return {
              type: 'tool_use' as const,
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            };
          }
          return { type: 'text' as const, text: '' };
        }),
        stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : response.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}
