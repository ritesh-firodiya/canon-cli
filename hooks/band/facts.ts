// Pure helpers for the band: no `$`, so the tests call them directly.

import { priceOf } from '../../cli/src/usage/prices'
import type { BandFacts, CacheFacts, Panel, Tests, UsageWindow } from './types'

export const TTL_MS = 60 * 60 * 1000
const LOW_AT = 15
const PER_MILLION = 1_000_000
const NARROW_BELOW = 110

// The test runners ponytail's band knows (MIT, DietrichGebert/ponytail).
const TEST_COMMAND = /\b(npm (run )?test|pnpm (run )?test|yarn test|bun test|npx (jest|vitest)|jest|vitest|pytest|python3? -m pytest|go test|cargo test|mvn test|gradle test|rspec|phpunit|dotnet test|node --test|deno test|make test)\b/
const CODE_FILE = /\.(py|[cm]?[jt]sx?|go|rs|rb)$/

export const isTestCommand = (command: string): boolean => TEST_COMMAND.test(command)
export const isCodeFile = (file: string): boolean => CODE_FILE.test(file)

export const afterTestRun = (failed: boolean): Tests => (failed ? 'failed' : 'ok')
// Code changed after a run: its result no longer says anything.
export const afterEdit = (tests: Tests, file: string): Tests => (tests !== 'none' && isCodeFile(file) ? 'stale' : tests)

export const testsLabel = (tests: Tests): string => (tests === 'none' ? '' : `tests ${tests}`)

export const money = (usd: number): string => `$${usd.toFixed(2)}`
const CENT = 0.01
const round = (usd: number): string => (usd < CENT ? '<$0.01' : `$${usd.toFixed(2)}`)

export const isNarrow = (columns: number): boolean => columns < NARROW_BELOW

export function duration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export interface WindowView {
  label: string
  isLow: boolean
}

const NAMES: Record<string, string> = { seven_day: '7D', five_hour: '5H' }
const ORDER: Record<string, number> = { seven_day: 0, five_hour: 1 }

/** Usage left: the reset time only when it is low, since that is when it matters. */
export function windowViews(windows: readonly UsageWindow[], now: number): WindowView[] {
  return [...windows]
    .filter(w => NAMES[w.kind])
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))
    .map(w => {
      const left = Math.max(0, Math.round(100 - w.percentUsed))
      const isLow = left < LOW_AT
      const reset = isLow && w.resetsAt ? Date.parse(w.resetsAt) - now : NaN
      const name = NAMES[w.kind]
      return { label: `${name} ${left}%${isLow ? ` LOW${Number.isNaN(reset) ? '' : ` ${duration(reset)}`}` : ''}`, isLow }
    })
}

export type CacheView =
  | { mode: 'warm'; minutesLeft: number; extendUsd: number | null }
  | { mode: 'cold'; nextUsd: number | null }

/** Warm for an hour after the last request. Null before there is anything cached. */
export function cacheView(cache: CacheFacts | null, now: number): CacheView | null {
  if (!cache || cache.lastAt <= 0 || cache.tokens <= 0) return null
  const idle = Math.max(0, now - cache.lastAt)
  const price = cache.model ? priceOf(cache.model, cache.tokens) : null
  if (idle >= TTL_MS) return { mode: 'cold', nextUsd: price ? (cache.tokens * price.write1h) / PER_MILLION : null }
  return { mode: 'warm', minutesLeft: Math.ceil((TTL_MS - idle) / 60000), extendUsd: price ? (cache.tokens * price.cacheRead) / PER_MILLION : null }
}

export const extendLabel = (usd: number | null): string => (usd === null ? 'extend' : `extend ${usd < CENT ? '' : '~'}${round(usd)}`)
export const coldLabel = (usd: number | null): string => (usd === null ? 'cold' : `cold · next ${usd < CENT ? '' : '~'}${round(usd)}`)

/** Extend shows only when it can do something: the cache is warm and no reply is running. */
export const canExtend = (view: CacheView | null, isBusy: boolean): boolean => view?.mode === 'warm' && !isBusy

/** What a click folds open under the band. Each line is plain text. */
export function panelLines(panel: Panel, facts: BandFacts): string[] {
  const where = (f: { file?: string; message: string }, level: string) => `${level}  ${f.file ? `${f.file}  ` : ''}${f.message}`
  if (panel === 'errors') return facts.errors.map(f => where(f, 'error'))
  if (panel === 'warnings') return facts.warnings.map(f => where(f, 'warning'))
  if (panel === 'review') {
    if (!facts.waiting) return []
    return [
      `Review ${facts.problem?.file ?? facts.waiting.record}`,
      `Then approve it yourself  canon approve ${facts.waiting.stage} --record ${facts.waiting.record} --note "what you reviewed"`,
    ]
  }
  if (panel === 'problem') {
    const p = facts.problem
    if (!p) return []
    return [`${p.id}  ${p.title}`, `Source  ${p.source ?? 'unknown'}   Priority  ${p.priority ?? 'none'}`, `Doc  ${p.file}`]
  }
  return []
}

const WORDS: Record<string, string> = { ok: ' ok', waiting: ' waiting on you', running: ' running', here: ' in progress', todo: '' }
export const stageWord = (id: string, state: string): string => `${id[0]?.toUpperCase() ?? ''}${id.slice(1)}${WORDS[state] ?? ''}`
export const capitalise = (word: string): string => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`

const MOVES = /(?:^|&&|;|\|\|)\s*cd\s+([^\s;&|]+)|\bgit\s+-C\s+([^\s;&|]+)/g

/** The last place a Bash command moved to, absolute. A path starting with ~ or $ cannot be read here. */
export function movedTo(command: string, cwd: string): string | null {
  const last = [...command.matchAll(MOVES)].at(-1)
  const path = (last?.[1] ?? last?.[2])?.replace(/^['"]|['"]$/g, '')
  if (!path || /^[~$]/.test(path)) return null
  return path.startsWith('/') ? path : `${cwd}/${path}`
}

/** Whether a path is already inside the product the band shows, so nothing needs reading again. */
export const isInside = (path: string, product: string | null | undefined): boolean => Boolean(product) && `${path}/`.includes(`/${product}/`)

/** What moving a live chat to another model costs: all of it is written to the cache again. */
export function reloadUsd(cache: CacheFacts | null): number | null {
  const price = cache?.model ? priceOf(cache.model, cache.tokens) : null
  return cache && price && cache.tokens > 0 ? (cache.tokens * price.write1h) / PER_MILLION : null
}

/** What a small model call cost, at list price. */
export function callUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceOf(model, inputTokens)
  return price ? (inputTokens * price.input + outputTokens * price.output) / PER_MILLION : 0
}

export const usdLabel = (usd: number): string => `about $${usd.toFixed(usd < CENT ? 4 : 2)}`
