import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import {
  afterEdit,
  afterEditText,
  callUsd,
  afterTestRun,
  canExtend,
  cacheView,
  capitalise,
  coldLabel,
  contextView,
  cut,
  duration,
  extendLabel,
  fileLink,
  infoLine,
  isNarrow,
  isChangingCall,
  isGatedPage,
  isInside,
  isTestCommand,
  isWeighSkill,
  money,
  movedTo,
  nextSize,
  panelLines,
  replyRule,
  reloadUsd,
  stageWord,
  testsLabel,
  usdLabel,
  WEIGH_FIRST,
  windowViews,
} from './facts'
import { latestModel } from '../../cli/src/setup/models/latest'
import { CLASSIFIER_SYSTEM, EFFORTS, TIERS, classifierPrompt, isRoutable, parseSize, pick, routeLabel, routeMode, tierOf } from './routing'
import type { Applied, BandFacts, CacheFacts, Chosen, Effort, Info, Level, Panel, ReplySize, Route, Tests, Tier, UsageWindow } from './types'

// The band above the prompt: the work on the left, how Claude runs and what is left on the right, in colour only when something needs you.
// Cache and usage logic follow ribbon (MIT, robonuggets/ribbon); test state follows ponytail's band (MIT, DietrichGebert/ponytail).

const TICK_MS = 30_000
const GATE_TIMEOUT_MS = 20_000
const EXTEND_MESSAGE = 'Reply with only: ok'
const CLASSIFIER_TIMEOUT_MS = 3000
const CLASSIFIER_MAX_TOKENS = 5
const TITLE_MAX = 40
const TITLE_MAX_NARROW = 28

const WARN_SPEND = 0.7

const AMBER = '#f0b429'
const AMBER_INK = '#241a00'
const RED_BG = '#4a1f1c'
const RED = '#ff7b72'
const BLUE = '#8cc4ff'
const GREEN = '#56d364'

const facts = atom({ plugin: 'canon', key: 'facts' } as const, null as BandFacts | null)
const workPath = atom({ plugin: 'canon', key: 'workPath' } as const, null as string | null)
const isRouting = atom({ plugin: 'canon', key: 'isRouting' } as const, false)
const isFresh = atom({ plugin: 'canon', key: 'isFresh' } as const, true)
const route = atom({ plugin: 'canon', key: 'route' } as const, null as Route | null)
const chosen = atom({ plugin: 'canon', key: 'chosen' } as const, { model: null, effort: null } as Chosen)
const applied = atom({ plugin: 'canon', key: 'applied' } as const, null as Applied | null)
const windows = atom({ plugin: 'canon', key: 'windows' } as const, [] as UsageWindow[])
const cache = atom({ plugin: 'canon', key: 'cache' } as const, null as CacheFacts | null)
const taskUsd = atom({ plugin: 'canon', key: 'taskUsd' } as const, 0)
const tests = atom({ plugin: 'canon', key: 'tests' } as const, 'none' as Tests)
const panel = atom({ plugin: 'canon', key: 'panel' } as const, null as Panel | null)
const isExtending = atom({ plugin: 'canon', key: 'isExtending' } as const, false)
const contextUsed = atom({ plugin: 'canon', key: 'contextUsed' } as const, null as number | null)
const isAwake = atom({ plugin: 'canon', key: 'isAwake' } as const, false)
const replySize = atom({ plugin: 'canon', key: 'replySize' } as const, 'M' as ReplySize)
// Per typed prompt: a large one must run weigh before its first change.
const weigh = atom({ plugin: 'canon', key: 'weigh' } as const, { isNeeded: false, isDone: false })

const LEVEL_COLOR: Record<Level, string> = { ok: GREEN, warn: AMBER, bad: RED }
const TEST_LEVEL: Record<Tests, Level> = { none: 'ok', ok: 'ok', stale: 'warn', failed: 'bad' }

// The caffeinate child behind ☀; ☼ when there is none. Module state, so a reload, which kills it, starts asleep again.
// -w ties caffeinate to the process that started it, so a crash or kill -9 of Claude Code cannot leave the Mac awake.
// -d keeps the display on, so the screen never locks; -i and -s keep the system up, on battery and on power.
const CAFFEINATE = 'exec caffeinate -dis -w "$PPID"'

let awakeChild: ReturnType<EngineInterface['process']['spawn']> | null = null

// shortcut: caffeinate is macOS only, so elsewhere a click says it could not start; hide the sun off macOS if anyone uses it there.
async function setAwake($: EngineInterface, isOn: boolean): Promise<void> {
  const before = awakeChild
  awakeChild = null
  // Ending the loop ends the child; not awaited, since the loop sits on a read that only the child's end settles.
  void before?.return(undefined as never)
  await update($, isAwake, () => isOn)
  if (!isOn) return
  const child = $.process.spawn({ argv: ['/bin/sh', '-c', CAFFEINATE] })
  awakeChild = child
  void (async () => {
    try {
      for await (const _ of child) {
        // caffeinate prints nothing; the loop only marks its life.
      }
    } catch {
      await $.ui.toast('Could not keep this Mac awake: caffeinate did not start.')
    }
    if (awakeChild !== child) return
    awakeChild = null
    await update($, isAwake, () => false)
  })()
}

async function refreshFacts($: EngineInterface): Promise<void> {
  const path = (await read($, workPath)) ?? (await $.session.cwd())
  const run = await $.process.run(['canon', 'band', path]).catch(() => undefined)
  if (run?.exitCode !== 0) return void update($, facts, () => null)
  try {
    const parsed = JSON.parse(run.stdout) as BandFacts
    await update($, facts, () => parsed)
  } catch {
    await update($, facts, () => null)
  }
}

// The band follows the work, so a session in a parent folder, or one moving between products, shows the right one.
async function followWork($: EngineInterface, path: string | null): Promise<void> {
  if (!path || isInside(path, (await read($, facts))?.product)) return
  const previous = await read($, workPath)
  await update($, workPath, () => path)
  await refreshFacts($)
  // A path in no product, like a temp file, is not a move: keep showing the product it was on.
  if (!(await read($, facts))?.product) {
    await update($, workPath, () => previous)
    await refreshFacts($)
  }
}

// shortcut: rewrites the whole log per prompt, since $.fs has no append; use `canon` to log if the file ever grows large.
async function logRoute($: EngineInterface, entry: Route): Promise<void> {
  const home = (await $.env.get('CANON_HOME')) ?? `${await $.env.get('HOME')}/.canon`
  const file = `${home}/routes.jsonl`
  const before = await $.fs.read(file).catch(() => '')
  await $.fs.write(file, `${before}${JSON.stringify({ at: new Date(await $.clock.now()).toISOString(), size: entry.size, isFailed: entry.isFailed, decideUsd: entry.decideUsd })}\n`)
}

/** Asks Haiku how hard a prompt is. A failed or unclear answer leaves the session's own settings. */
async function decide($: EngineInterface, text: string): Promise<void> {
  const model = await latestModel('haiku', (await $.env.get('ANTHROPIC_API_KEY')) ?? undefined)
  const answer = await $.model
    .complete({ model, system: CLASSIFIER_SYSTEM, prompt: classifierPrompt(text), maxTokens: CLASSIFIER_MAX_TOKENS, timeoutMs: CLASSIFIER_TIMEOUT_MS })
    .catch(() => undefined)
  const size = answer?.isAnswered ? parseSize(answer.text) : null
  const entry: Route = { size, isFailed: size === null, decideUsd: answer ? callUsd(model, answer.usage.input_tokens, answer.usage.output_tokens) : 0 }
  await update($, route, () => entry)
  await logRoute($, entry).catch(() => undefined)
}

const spendColor = (spent: number, cap: number): string => (spent >= cap ? RED : spent >= cap * WARN_SPEND ? AMBER : GREEN)

// Off unless the repo names it in `features:`. A session with no product has nothing to name it in.
async function isRoutingOn($: EngineInterface): Promise<boolean> {
  return (await read($, isRouting)) && Boolean((await read($, facts))?.features?.includes('routing'))
}

async function refreshUsage($: EngineInterface, lastAt: number | null, model: string | null): Promise<void> {
  const usage = await $.session.usage()
  await update($, windows, () => usage.rateLimits.map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt })))
  await update($, taskUsd, value => usage.cost?.usd ?? value)
  await update($, contextUsed, value => usage.context.percent ?? value)
  const known = model ?? (await $.session.model())
  await update($, cache, c => ({
    lastAt: lastAt ?? c?.lastAt ?? 0,
    tokens: usage.context.tokens && usage.context.tokens > 0 ? usage.context.tokens : (c?.tokens ?? 0),
    model: known || c?.model || null,
  }))
}

type ToolCall = Parameters<EngineInterface['tool']['call']>[0]

/** The knowledge gate: a page reaches .context only if every rule the repo has still holds with it. */
async function gateRefusal($: EngineInterface, e: ToolCall): Promise<string | null> {
  if ((e.tool !== 'Edit' && e.tool !== 'Write') || !isGatedPage(e.file_path)) return null
  const before = e.tool === 'Edit' ? await $.fs.read(e.file_path).catch(() => null) : null
  const content = e.tool === 'Write' ? e.content : before === null ? null : afterEditText(before, e.old_string, e.new_string, Boolean(e.replace_all))
  if (content === null) return null
  const run = await $.process.run(['canon', 'gate', e.file_path], { stdin: content, timeoutMs: GATE_TIMEOUT_MS }).catch(() => undefined)
  // No canon, or a canon without the gate: the write goes on, and `canon check` still judges it later.
  if (!run || run.exitCode !== 1 || !run.stdout.trim()) return null
  return `The knowledge gate refused this page. Fix it, or propose the change to the person instead of writing it:\n${run.stdout.trim()}`
}

// Panels only for reading close by themselves; one with choices to press stays until closed.
const STAYS_OPEN = new Set<Panel>(['route', 'review'])
const READ_MS = 5000
const READ_MS_PER_LINE = 1500
let shown = 0

/** Opens a panel, or closes it with null. A reading panel closes after time to read it, unless another opened since. */
async function showPanel($: EngineInterface, name: Panel | null): Promise<void> {
  const mine = ++shown
  await update($, panel, () => name)
  if (!name || STAYS_OPEN.has(name)) return
  const lines = name === 'errors' || name === 'warnings' ? ((await read($, facts))?.[name].length ?? 1) : 1
  $.clock.after(Math.max(READ_MS, lines * READ_MS_PER_LINE), async () => {
    if (shown === mine) await update($, panel, () => null)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refreshFacts($)
    // A `canon run` agent has its own model and cap per stage, and a headless run has nobody to override a pick.
    await update($, isRouting, () => e.isInteractive)
    await setAwake($, false)
    if (await $.env.get('CANON_RUN')) await update($, isRouting, () => false)
    $.clock.every(TICK_MS, async () => {
      // A run moves on its own, so only then are its facts read again between turns.
      if ((await read($, facts))?.running) await refreshFacts($)
      $.ui.invalidate('ui.render')
    })
    return next(e)
  }).catch(($, e, next) => next(e))

  // A resumed session knows how long it was away; a cleared one starts over.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (e.source === 'clear' || e.source === 'compact') {
      await update($, cache, () => null)
      await update($, contextUsed, () => null)
      if (e.source === 'clear') {
        await update($, workPath, () => null)
        await update($, route, () => null)
        await update($, applied, () => null)
        await update($, isFresh, () => true)
        await update($, tests, () => 'none' as Tests)
        await update($, panel, () => null)
      }
    } else if ((e.source === 'resume' || e.source === 'fork') && typeof e.seconds_since_last_response === 'number') {
      const now = await $.clock.now()
      const seconds = e.seconds_since_last_response
      await update($, isFresh, () => false)
      await update($, cache, () => ({
        lastAt: now - seconds * 1000,
        tokens: typeof e.context_tokens === 'number' ? e.context_tokens : 0,
        model: typeof e.model === 'string' ? e.model : null,
      }))
    }
    return result
  }).catch(($, e, next) => next(e))

  // /model is the person choosing, so it holds like a choice on the band.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    await update($, chosen, c => ({ ...c, model: tierOf(e.to_model) }))
    return result
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const isTyped = isRoutable(e.text, e.origin.kind === 'plugin')
    // Beside the prompt, not in the system prompt, so a new size keeps the cache.
    const sized = isTyped ? { ...e, context: [...(e.context ?? []), replyRule(await read($, replySize))] } : e
    if (isTyped) await update($, weigh, () => ({ isNeeded: false, isDone: false }))
    if (!isTyped || !(await isRoutingOn($))) return next(sized)
    const mine = await read($, chosen)
    // Nothing to decide when the person chose both.
    if (!mine.model || !mine.effort) await decide($, e.text)
    const isLarge = (await read($, route))?.size === 'large'
    await update($, weigh, () => ({ isNeeded: isLarge, isDone: false }))
    return next(sized)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      yield* next(e)
      return
    }
    const session = tierOf(await $.session.model())
    const isOn = await isRoutingOn($)
    const routing = isOn && tierOf(e.model) === session
    const planned = routing
      ? pick({
          size: (await read($, route))?.size ?? null,
          chosen: await read($, chosen),
          isFresh: await read($, isFresh),
          current: tierOf((await read($, applied))?.model) ?? session,
          tokens: (await read($, cache))?.tokens ?? 0,
        })
      : { model: null, effort: null }
    // A different tier here means a skill's model or a fallback: only then is e.model left to the engine.
    const model = planned.model && planned.model !== tierOf(e.model) ? planned.model : e.model
    const effort = planned.effort ?? e.effort
    const now = await $.clock.now()
    // Each main request reads or writes the cache, so its start restarts the hour.
    await update($, cache, c => ({ lastAt: now, tokens: c?.tokens ?? 0, model }))
    await update($, applied, () => (isOn ? { model, ...(typeof effort === 'string' ? { effort } : {}) } : null))
    yield* next({ ...e, model, ...(effort === undefined ? {} : { effort }) })
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && e.tool === 'Skill' && isWeighSkill(e.skill)) await update($, weigh, w => ({ ...w, isDone: true }))
    const due = await read($, weigh)
    if (e.agentId === undefined && due.isNeeded && !due.isDone && isChangingCall(e.tool, e.tool === 'Bash' ? e.command : undefined)) return { deny: WEIGH_FIRST }
    const refusal = await gateRefusal($, e)
    if (refusal) return { deny: refusal }
    const result = await next(e)
    if (result.deny !== undefined) return result
    if (e.agentId === undefined) {
      if (e.tool === 'Bash') await followWork($, movedTo(e.command, await $.session.cwd()))
      if (e.tool === 'Edit' || e.tool === 'Write') await followWork($, e.file_path)
    }
    if (e.tool === 'Bash' && isTestCommand(e.command)) await update($, tests, () => afterTestRun(Boolean(result.isError)))
    if ((e.tool === 'Edit' || e.tool === 'Write') && !result.isError) await update($, tests, value => afterEdit(value, e.file_path))
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    await update($, isExtending, () => false)
    await update($, isFresh, () => false)
    await refreshUsage($, await $.clock.now(), e.usage?.model ?? null)
    await refreshFacts($)
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Other mods share this slot: theirs draw below.
    const below = await next(e).catch(() => undefined)
    const { Box, Button, Link, Text } = $.ui.resolve(e)
    const f = await read($, facts)
    const now = await $.clock.now()
    const open = await read($, panel)
    const extending = await read($, isExtending)
    const view = cacheView(await read($, cache), now)
    const usage = windowViews(await read($, windows), now)
    const testState = await read($, tests)
    const sessionUsd = await read($, taskUsd)
    const context = contextView(await read($, contextUsed))
    const awake = await read($, isAwake)
    const size = await read($, replySize)
    const choice = await read($, chosen)
    const lastRoute = await read($, route)
    const running = await read($, applied)
    const cached = await read($, cache)

    const toggle = (name: Panel) => async () => showPanel($, (await read($, panel)) === name ? null : name)
    // An action says what it did, so a second click acts again instead of closing.
    const say = (name: Info) => showPanel($, name)
    const extend = async () => {
      await update($, isExtending, () => true)
      await say('cache')
      void $.prompt.submit({ text: EXTEND_MESSAGE })
    }

    const mode = routeMode(choice, lastRoute?.size ?? null)
    const routeWord = running ? routeLabel(mode, tierOf(running.model) ?? running.model, running.effort) : null
    const pickButton = routeWord ? (
      <Button key="route" plain onPress={toggle('route')}>
        <Text color={mode === 'you' ? AMBER : undefined} dimColor={mode !== 'you'}>{routeWord}</Text>
      </Button>
    ) : null

    const choiceRow = <T extends string>(title: string, name: 'model' | 'effort', options: readonly T[], current: T | null) => (
      <Box key={`choose-${name}`} flexDirection="row" gap={2}>
        <Text dimColor>{title}</Text>
        <Button key={`${name}-auto`} plain onPress={() => update($, chosen, c => ({ ...c, [name]: null }))}>
          <Text color={current === null ? GREEN : undefined}>auto</Text>
        </Button>
        {options.map(option => (
          <Button key={`${name}-${option}`} plain onPress={() => update($, chosen, c => ({ ...c, [name]: option }))}>
            <Text color={current === option ? GREEN : undefined}>{option}</Text>
          </Button>
        ))}
      </Box>
    )
    const reload = reloadUsd(cached)
    const routePanel = open === 'route' ? (
      <Box key="route-panel" flexDirection="column">
        {lastRoute ? (
          <Text>{lastRoute.isFailed ? 'Could not decide for this prompt. Used your normal settings.' : `This prompt: ${lastRoute.size} work. Decided by Haiku, ${usdLabel(lastRoute.decideUsd)}.`}</Text>
        ) : null}
        {choiceRow('Model ', 'model', TIERS as readonly Tier[], choice.model)}
        {reload === null ? null : <Text dimColor>Changing model mid-session reloads the chat: ~{money(reload)}. Changing effort keeps the cache.</Text>}
        {choiceRow('Effort', 'effort', EFFORTS as readonly Effort[], choice.effort)}
      </Box>
    ) : null

    // Without `process` the band is the session's: no product, stage, task or checks.
    const hasProcess = Boolean(f?.features?.includes('process'))
    const narrow = isNarrow(e.props.bodyColumns)
    const isWork = hasProcess && Boolean(f?.product)
    const item = (key: Panel, label: string, color?: string, onPress: () => unknown = toggle(key)) => (
      <Button key={key} plain onPress={onPress}><Text color={color} dimColor={!color}>{label}</Text></Button>
    )

    const left = [
      <Button key="awake" plain onPress={async () => { await setAwake($, !awake); await say('awake') }}>
        <Text color={awake ? GREEN : undefined} bold={awake}>{awake ? '☀︎' : '☼'}</Text>
      </Button>,
      f?.running ? item('cost', `${money(f.running.spendUsd)} of ${money(f.running.capUsd)}`, spendColor(f.running.spendUsd, f.running.capUsd)) : item('cost', money(sessionUsd)),
      isWork && f ? <Text key="product">{f.product}{f.stage ? ' › ' : ''}</Text> : null,
      isWork && f?.stage ? <Button key="stage" plain label={capitalise(f.stage)} onPress={toggle('stage')} /> : null,
      isWork && f?.running ? <Text key="running" color={BLUE} bold>▶ running {duration(now - Date.parse(f.running.startedAt))}</Text> : null,
      isWork && f?.problem && f.root ? <Text key="task" dimColor><Link href={fileLink(f.root, f.problem.file)} label={`▸ ${cut(f.problem.title, narrow ? TITLE_MAX_NARROW : TITLE_MAX)}`} /></Text> : null,
    ]

    const how = [
      isWork && f?.waiting ? <Button key="waiting" plain onPress={toggle('review')}><Text backgroundColor={AMBER} color={AMBER_INK} bold> ▲ WAITING ON YOU </Text></Button> : null,
      <Button key="size" plain onPress={async () => { await update($, replySize, nextSize); await say('size') }}><Text color={AMBER} bold>{size}</Text></Button>,
      pickButton,
      isWork && f?.errors.length ? item('errors', `✗ ${f.errors.length}`, RED) : null,
      isWork && f && !f.errors.length && f.warnings.length ? item('warnings', `! ${f.warnings.length}`, AMBER) : null,
      isWork && f && !f.errors.length && !f.warnings.length ? item('checks', '✓ checks', GREEN) : null,
      isWork && testState !== 'none' ? item('tests', testsLabel(testState), LEVEL_COLOR[TEST_LEVEL[testState]]) : null,
    ]

    const warm = view?.mode === 'warm' ? view : null
    const limits = [
      ...usage.map(w => item(w.name as Info, w.label, LEVEL_COLOR[w.level])),
      context ? item('ctx', context.label, LEVEL_COLOR[context.level]) : null,
      view?.mode === 'cold' ? item('cache', coldLabel(view.nextUsd), AMBER) : null,
      extending ? <Text key="extending" dimColor>extending...</Text> : null,
      !extending && warm && canExtend(warm, e.props.isWorking) ? item('cache', extendLabel(warm.minutesLeft, warm.extendUsd), GREEN, extend) : null,
      !extending && warm && !canExtend(warm, e.props.isWorking) ? <Text key="cache-time" color={GREEN}>{extendLabel(warm.minutesLeft, null)}</Text> : null,
    ]

    const row = (key: string, start: RenderChildren[], end: RenderChildren[]) => (
      <Box key={key} flexDirection="row" gap={2} width={e.props.bodyColumns}>
        {start}
        <Box key="grow" flexGrow={1} />
        {end}
      </Box>
    )
    const rows = narrow ? [row('work', left, []), row('limits', how, limits)] : [row('work', left, [...how, ...limits])]

    const stages = open === 'stage' && f ? (
      <Box key="stages" flexDirection="row" flexWrap="wrap">
        {f.stages.map((s, i) => (
          <Text key={s.id} color={s.state === 'waiting' || s.state === 'running' || s.state === 'here' ? AMBER : undefined} dimColor={s.state === 'todo'} bold={s.state === 'waiting'}>
            {i ? ' · ' : ''}{stageWord(s.id, s.state)}
          </Text>
        ))}
      </Box>
    ) : null
    const openLink = (key: string, file: string) => (f?.root ? <Text key={key}><Link href={fileLink(f.root, file)} label="open" /></Text> : null)
    const isListPanel = open === 'review' || open === 'errors' || open === 'warnings'
    const info = { isAwake: awake, size, sessionUsd, running: f?.running ?? null, tests: testState, windows: usage, context, cache: view }
    const lines = !open || open === 'stage' || open === 'route' ? [] : isListPanel ? (f ? panelLines(open, f) : []) : [infoLine(open, info)]

    const mine = (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        {rows}
        {stages}
        {routePanel}
        {lines.map(line => <Text key={line}>{line}</Text>)}
        {open === 'review' && f?.problem ? openLink('open-review', f.problem.file) : null}
      </Box>
    )
    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  }).catch(($, e, next) => next(e))
}
