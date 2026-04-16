// LLM Types
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export interface LLMContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMResponse {
  content: LLMContentBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
}

export interface LLMChatOptions {
  tools?: LLMTool[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

// Memory Types
export interface ZenoConfig {
  version: string;
  provider: 'claude' | 'openai' | 'ollama';
  model: string;
  createdAt: string;
  lastSyncAt: string;
}

export interface StackInfo {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  packageManagers: string[];
  databases: string[];
  testing: string[];
  linting: string[];
  ci: string[];
  containerization: string[];
  detected: Record<string, string>; // file -> what it indicates
}

export interface FileEntry {
  path: string;
  type: 'file' | 'directory';
  description?: string;
  language?: string;
  size?: number;
}

export interface PatternInfo {
  category: string; // e.g. "routing", "state-management", "db-access"
  description: string;
  examples: string[]; // file paths where this pattern is used
  confidence: number; // 0-1
}

export interface ConventionInfo {
  category: string; // e.g. "naming", "formatting", "file-organization"
  rule: string;
  examples: string[];
  confidence: number;
}

export interface DomainConcept {
  name: string;
  description: string;
  relatedFiles: string[];
}

export interface SkillsInfo {
  languages: string[];
  frameworks: string[];
  tools: string[];
  domains: string[];
}

export interface PlanMeta {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'paused' | 'rejected';
  created: string;
  branch?: string;
  related: string[];
  summary: string;
}

export interface PlansIndex {
  plans: PlanMeta[];
  nextId: number;
}

// Agent Types
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<string>;
}
