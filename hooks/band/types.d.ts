export type Size = 'small' | 'medium' | 'large'
export type Tier = 'haiku' | 'sonnet' | 'opus'
export type Effort = 'low' | 'medium' | 'high'
export type Chosen = { model: Tier | null; effort: Effort | null }

export type StageMark = 'ok' | 'here' | 'waiting' | 'running' | 'todo'
export type Tests = 'none' | 'ok' | 'stale' | 'failed'
export type Info = 'awake' | 'size' | 'cost' | 'checks' | 'tests' | '7D' | '5H' | 'ctx' | 'cache'
export type Panel = 'stage' | 'review' | 'errors' | 'warnings' | 'route' | Info
export type Level = 'ok' | 'warn' | 'bad'
export type ReplySize = 'S' | 'M' | 'L'

export type Finding = { file?: string; message: string }

/** What `canon band` prints. */
export type BandFacts = {
  product: string | null
  stage: string | null
  stages: { id: string; state: StageMark }[]
  waiting: { record: string; stage: string } | null
  running: { record: string; stage: string | null; startedAt: string; spendUsd: number; capUsd: number } | null
  // Optional: a newer band can meet an older canon.
  root?: string | null
  problem: { id: string; title: string; source: string | null; priority: string | null; file: string } | null
  errors: Finding[]
  warnings: Finding[]
  features?: string[]
  /** USD per million tokens for the models this machine runs, by id. */
  prices?: Record<string, { input: number; output: number; write5m: number; write1h: number; cacheRead: number }>
}

export type CacheFacts = { lastAt: number; tokens: number; model: string | null }

export type Route = { size: Size | null; decideUsd: number | null; isFailed: boolean }

export type Applied = { model: string; effort?: string }

export type UsageWindow = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    canon: {
      facts: BandFacts | null
      workPath: string | null
      windows: UsageWindow[]
      cache: CacheFacts | null
      taskUsd: number
      tests: Tests
      panel: Panel | null
      isExtending: boolean
      isRouting: boolean
      isFresh: boolean
      route: Route | null
      chosen: Chosen
      applied: Applied | null
      contextUsed: number | null
      isAwake: boolean
      replySize: ReplySize
      weigh: { isNeeded: boolean; isDone: boolean }
      attached: string[]
    }
  }
}
