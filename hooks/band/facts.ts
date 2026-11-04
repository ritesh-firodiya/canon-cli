// Pure helpers for the band: no `$`, so the tests call them directly.

import { priceOf } from '../../cli/src/setup/models/prices'
import type { BandFacts, CacheFacts, Info, Level, Panel, ReplySize, Tests, UsageWindow } from './types'

export const TTL_MS = 60 * 60 * 1000
const LOW_AT = 20
const WARN_AT = 40
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

const TESTS: Record<Tests, string> = { none: '', ok: '✓ tests', stale: '~ tests', failed: '✗ tests' }
export const testsLabel = (tests: Tests): string => TESTS[tests]

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
  name: string
  left: number
  /** Only when it is low, since that is when it matters. */
  reset: string | null
  label: string
  level: Level
}

/** How much is left decides the colour: red when it is about to run out. */
export const levelOf = (left: number): Level => (left < LOW_AT ? 'bad' : left < WARN_AT ? 'warn' : 'ok')

const NAMES: Record<string, string> = { seven_day: '7D', five_hour: '5H' }
const ORDER: Record<string, number> = { seven_day: 0, five_hour: 1 }

/** Usage left: the reset time only when it is low, since that is when it matters. */
export function windowViews(windows: readonly UsageWindow[], now: number): WindowView[] {
  return [...windows]
    .filter(w => NAMES[w.kind])
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))
    .map(w => {
      const left = Math.max(0, Math.round(100 - w.percentUsed))
      const level = levelOf(left)
      const name = NAMES[w.kind] as string
      const reset = level === 'bad' && w.resetsAt ? duration(Date.parse(w.resetsAt) - now) : null
      return { name, left, reset, label: `${name} ${left}%${reset ? ` ${reset}` : ''}`, level }
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

/** Room left in the context window, from the share the engine says is used. */
export function contextView(percentUsed: number | null): WindowView | null {
  if (percentUsed === null) return null
  const left = Math.max(0, 100 - Math.round(percentUsed))
  return { name: 'ctx', left, reset: null, label: `ctx ${left}%`, level: levelOf(left) }
}

const about = (usd: number): string => `${usd < CENT ? '' : '~'}${round(usd)}`
export const extendLabel = (minutes: number, usd: number | null): string => `↻ ${minutes}m${usd === null ? '' : ` +${round(usd)}`}`
export const coldLabel = (usd: number | null): string => (usd === null ? '◌ cold' : `◌ cold ${about(usd)}`)

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
  return []
}

export const SIZES: readonly ReplySize[] = ['S', 'M', 'L']
export const nextSize = (size: ReplySize): ReplySize => SIZES[(SIZES.indexOf(size) + 1) % SIZES.length] as ReplySize

const SIZE_WORDS: Record<ReplySize, string> = {
  S: 'one to three lines, no headings or tables',
  M: 'the answer first, then a short bullet list',
  L: 'the answer first, then steps, reasons and trade-offs',
}

/** What the model reads beside each prompt, so the size holds without touching the cached system prompt. */
export const replyRule = (size: ReplySize): string => `Reply size ${size}: write ${SIZE_WORDS[size]}. The person set this on the band; it overrides other length guidance.`

export interface InfoFacts {
  isAwake: boolean
  size: ReplySize
  sessionUsd: number
  running: BandFacts['running']
  tests: Tests
  windows: readonly WindowView[]
  context: WindowView | null
  cache: CacheView | null
}

/** The one line a click on a short item shows, so a glyph never has to be guessed. */
export function infoLine(info: Info, f: InfoFacts): string {
  const limit = (name: string, what: string) => {
    const w = f.windows.find(entry => entry.name === name)
    return w ? `${name}: ${w.left}% of your ${what} limit is left.${w.reset ? ` It resets in ${w.reset}.` : ''}` : `${name}: no reading yet.`
  }
  if (info === 'awake') return f.isAwake ? '☀ Awake: this Mac will not sleep while this session is open. Click again to let it sleep.' : '☼ This session is not keeping the Mac awake. Click to keep it awake while this session is open.'
  if (info === 'size') return `Reply size ${f.size}: ${SIZE_WORDS[f.size]}. Click again for the next size.`
  if (info === 'cost') return f.running ? `This run has spent ${money(f.running.spendUsd)} of its ${money(f.running.capUsd)} cap.` : `This session has spent ${money(f.sessionUsd)}.`
  if (info === 'checks') return '✓ canon check found nothing wrong in this repo.'
  if (info === 'tests') return { none: '', ok: '✓ Tests passed, and no code changed since.', stale: '~ Code changed since tests last ran. Run them again.', failed: '✗ The last test run failed.' }[f.tests]
  if (info === '7D') return limit('7D', 'weekly')
  if (info === '5H') return limit('5H', 'five-hour')
  if (info === 'ctx') return f.context ? `ctx: ${f.context.left}% of the context window is left. Under ${LOW_AT}%, compact or start a new session.` : 'ctx: no reading yet.'
  if (f.cache?.mode === 'cold') return `◌ Cache is cold: the next reply reads the whole chat again${f.cache.nextUsd === null ? '' : `, about ${round(f.cache.nextUsd)}`}.`
  if (f.cache?.mode === 'warm') return `↻ Cache warm for ${f.cache.minutesLeft} more minutes.${f.cache.extendUsd === null ? '' : ` A click keeps it warm for an hour, for ${round(f.cache.extendUsd)}.`}`
  return ''
}

/** A title cut to fit, so one long name cannot push the band off the line. */
export const cut = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

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

/** A link to a record's page, for the terminal or surface to open. */
export const fileLink = (root: string, file: string): string => `file://${encodeURI(`${root}/${file}`).replace(/[?#]/g, encodeURIComponent)}`

export const usdLabel = (usd: number): string => `about $${usd.toFixed(usd < CENT ? 4 : 2)}`

/** A page the knowledge gate judges: markdown under a product's .context, outside the folders with their own checks. */
export const isGatedPage = (path: string): boolean => /\/\.context\/(?!designs\/|packs\/).*\.md$/.test(path)

/** What an Edit leaves in a file, or null when its text is not there and the tool will refuse it anyway. */
export function afterEditText(text: string, oldText: string, newText: string, isAll: boolean): string | null {
  if (!text.includes(oldText)) return null
  return isAll ? text.split(oldText).join(newText) : text.replace(oldText, () => newText)
}

// Commands that only look: a large prompt may read freely before it is weighed.
const LOOKS = /^\s*(ls|cat|head|tail|grep|rg|find|wc|pwd|echo|which|stat|du|tree|git (status|log|diff|show|branch|blame)|canon (check|learn|queue|pipeline|records|band|models|gate|work)|gh (run|pr|issue) (list|view))\b/
const SEGMENTS = /&&|\|\||;|\|/

/** A call that changes something, which a large prompt makes only after weigh has run. */
export function isChangingCall(tool: string, command?: string): boolean {
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return true
  if (tool !== 'Bash' || command === undefined) return false
  return command.split(SEGMENTS).some(part => part.trim() !== '' && !LOOKS.test(part))
}

export const isWeighSkill = (skill: string): boolean => /(^|:)weigh$/.test(skill)

export const WEIGH_FIRST = 'This prompt looked large, so canon asks for the weigh skill before any change. Run the weigh skill on the request, give its verdict, then go on.'

// Words that say nothing about which page answers: a prompt's own grammar, and asks like "please" or "show".
const STOP = new Set('about after again also another because been before being between both could does doing done each from have having here into just like make more most much need only other over please same should show some such than that their them then there these they this those through very what when where which while will with would your'.split(' '))
const MIN_WORD = 4
const MAX_WORDS = 5

/** The words of a prompt worth searching for, longest first: they are the rarest. */
export function keywordsOf(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? []
  return [...new Set(words.filter(w => w.length >= MIN_WORD && !STOP.has(w)))].sort((a, b) => b.length - a.length).slice(0, MAX_WORDS)
}

export interface Hit { file: string; title: string; score: number }

/**
 * The pages that match most of the words, then score best. With two or more words a page must match two,
 * so one common word alone never attaches a page.
 */
export function rankHits(perWord: readonly (readonly Hit[])[], limit = 3): Hit[] {
  const byFile = new Map<string, { hit: Hit; words: number; score: number }>()
  for (const hits of perWord) for (const hit of hits) {
    const seen = byFile.get(hit.file) ?? { hit, words: 0, score: 0 }
    byFile.set(hit.file, { hit: seen.hit, words: seen.words + 1, score: seen.score + hit.score })
  }
  const need = perWord.length >= 2 ? 2 : 1
  return [...byFile.values()].filter(e => e.words >= need).sort((a, b) => b.words - a.words || b.score - a.score).slice(0, limit).map(e => e.hit)
}

/** A qmd hit as a path the agent can Read: qmd://<collection>/<path> sits under <root>/.context/. */
export const hitPath = (root: string, file: string): string => `${root}/.context/${file.replace(/^qmd:\/\/[^/]+\//, '')}`

export const knowledgeNote = (lines: readonly string[]): string =>
  `canon found knowledge that may answer this. Read what applies before you answer, and cite it:\n${lines.join('\n')}`
