export type StageMark = 'ok' | 'here' | 'waiting' | 'running' | 'todo'
export type Tests = 'none' | 'ok' | 'stale' | 'failed'
export type Panel = 'stage' | 'review' | 'errors' | 'warnings' | 'problem'

export type Finding = { file?: string; message: string }

/** What `canon band` prints. */
export type BandFacts = {
  product: string | null
  stage: string | null
  stages: { id: string; state: StageMark }[]
  waiting: { record: string; stage: string } | null
  running: { record: string; stage: string | null; startedAt: string; spendUsd: number; capUsd: number } | null
  problem: { id: string; title: string; source: string | null; priority: string | null; file: string } | null
  errors: Finding[]
  warnings: Finding[]
}

export type CacheFacts = { lastAt: number; tokens: number; model: string | null }

export type UsageWindow = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    canon: {
      facts: BandFacts | null
      isLoaded: boolean
      windows: UsageWindow[]
      cache: CacheFacts | null
      taskUsd: number
      tests: Tests
      panel: Panel | null
      isExtending: boolean
    }
  }
}
