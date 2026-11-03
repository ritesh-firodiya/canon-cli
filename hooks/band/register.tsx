import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import {
  afterEdit,
  callUsd,
  afterTestRun,
  canExtend,
  cacheView,
  capitalise,
  coldLabel,
  duration,
  extendLabel,
  fileLink,
  isNarrow,
  isInside,
  isTestCommand,
  money,
  movedTo,
  panelLines,
  reloadUsd,
  stageWord,
  testsLabel,
  usdLabel,
  windowViews,
} from './facts'
import { latestModel } from '../../cli/src/usage/models'
import { CLASSIFIER_SYSTEM, EFFORTS, TIERS, classifierPrompt, isRoutable, parseSize, pick, routeLabel, routeMode, tierOf } from './routing'
import type { Applied, BandFacts, CacheFacts, Chosen, Effort, Panel, Route, Tests, Tier, UsageWindow } from './types'

// The band above the prompt: the work in one line, in colour only when something needs you.
// Cache and usage logic follow ribbon (MIT, robonuggets/ribbon); test state follows ponytail's band (MIT, DietrichGebert/ponytail).

const TICK_MS = 30_000
const EXTEND_MESSAGE = 'Reply with only: ok'
const CLASSIFIER_TIMEOUT_MS = 3000
const CLASSIFIER_MAX_TOKENS = 5
const WORK_ROWS = 8

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

/** Runs a `canon work` choice from a click, then redraws. A refusal shows, since the person is looking. */
async function runWork($: EngineInterface, root: string, args: string[]): Promise<void> {
  const run = await $.process.run(['canon', 'work', ...args, '--repo', root]).catch(() => undefined)
  if (run?.exitCode !== 0) await $.ui.toast(run?.stderr.trim() || 'canon could not run')
  await refreshFacts($)
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
  const known = model ?? (await $.session.model())
  await update($, cache, c => ({
    lastAt: lastAt ?? c?.lastAt ?? 0,
    tokens: usage.context.tokens && usage.context.tokens > 0 ? usage.context.tokens : (c?.tokens ?? 0),
    model: known || c?.model || null,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refreshFacts($)
    // A `canon run` agent has its own model and cap per stage, and a headless run has nobody to override a pick.
    await update($, isRouting, () => e.isInteractive)
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
    if (!(await isRoutingOn($)) || !isRoutable(e.text, e.origin.kind === 'plugin')) return next(e)
    const mine = await read($, chosen)
    // Nothing to decide when the person chose both.
    if (!mine.model || !mine.effort) await decide($, e.text)
    return next(e)
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
    const result = await next(e)
    if (result.deny !== undefined) return result
    if (e.agentId === undefined) {
      if (e.tool === 'Bash') await followWork($, movedTo(e.command, await $.session.cwd()))
      if (e.tool === 'Edit' || e.tool === 'Write') await followWork($, e.file_path)
    }
    // shortcut: only Edit and Write move the stage, so a file a Bash command writes says nothing; run canon work --stage then.
    if ((e.tool === 'Edit' || e.tool === 'Write') && !result.isError && (await read($, facts))?.features?.includes('process')) {
      await $.process.run(['canon', 'work', '--edit', e.file_path]).catch(() => undefined)
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
    const task = await read($, taskUsd)
    const choice = await read($, chosen)
    const lastRoute = await read($, route)
    const running = await read($, applied)
    const cached = await read($, cache)

    const toggle = (name: Panel) => () => update($, panel, value => (value === name ? null : name))
    const extend = async () => {
      await update($, isExtending, () => true)
      void $.prompt.submit({ text: EXTEND_MESSAGE })
    }

    const mode = routeMode(choice, lastRoute?.size ?? null)
    const routeWord = running ? routeLabel(mode, tierOf(running.model) ?? running.model, running.effort) : null
    const pickButton = routeWord ? (
      <Button key="route" plain onPress={toggle('route')}>
        <Text color={mode === 'you' ? GREEN : undefined} dimColor={mode !== 'you'}>{routeWord}</Text>
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

    // Without `process` the band is usage, cache and extend: no product, stage or checks.
    const hasProcess = Boolean(f?.features?.includes('process'))
    const work = hasProcess && f?.product
      ? [
          <Text key="product">{f.product}{f.stage ? ' · ' : ''}</Text>,
          f.stage ? <Button key="stage" plain label={capitalise(f.stage)} onPress={toggle('stage')} /> : null,
          f.waiting ? <Button key="waiting" plain onPress={toggle('review')}><Text backgroundColor={AMBER} color={AMBER_INK} bold> WAITING ON YOU </Text></Button> : null,
          f.errors.length ? <Button key="errors" plain onPress={toggle('errors')}><Text backgroundColor={RED_BG} color={RED} bold> {f.errors.length} ERROR{f.errors.length === 1 ? '' : 'S'} </Text></Button> : null,
          f.running ? <Text key="running" color={BLUE} bold>running {duration(now - Date.parse(f.running.startedAt))}</Text> : null,
          <Button key="problem" plain dimColor={!f.selected} label={f.problem?.id ?? 'pick work'} onPress={toggle('work')} />,
          pickButton,
          f.running ? <Text key="spend" color={spendColor(f.running.spendUsd, f.running.capUsd)}>{money(f.running.spendUsd)} of {money(f.running.capUsd)}</Text> : null,
          !f.running && !f.waiting && task > 0 ? <Text key="task" dimColor>task {money(task)}</Text> : null,
        ]
      : [pickButton]

    const health = hasProcess && f?.product
      ? [
          f.warnings.length ? <Button key="warnings" plain onPress={toggle('warnings')}><Text color={AMBER}>{f.warnings.length} warning{f.warnings.length === 1 ? '' : 's'}</Text></Button> : null,
          !f.errors.length && !f.warnings.length ? <Text key="checks" color={GREEN}>checks ok</Text> : null,
          testState === 'ok' ? <Text key="tests" color={GREEN}>{testsLabel(testState)}</Text> : null,
          testState === 'stale' ? <Text key="tests" color={AMBER}>{testsLabel(testState)}</Text> : null,
          testState === 'failed' ? <Text key="tests" color={RED} bold>{testsLabel(testState)}</Text> : null,
        ]
      : []

    const limits = [
      ...usage.map(w => (w.isLow ? <Text key={w.label} color={RED} bold>{w.label}</Text> : <Text key={w.label} color={GREEN}>{w.label}</Text>)),
      view?.mode === 'cold' ? <Text key="cache" color={AMBER}>{coldLabel(view.nextUsd)}</Text> : null,
      view?.mode === 'warm' ? <Text key="cache" color={GREEN}>cache {view.minutesLeft}m</Text> : null,
      extending ? <Text key="extending" dimColor>extending...</Text> : null,
      !extending && view?.mode === 'warm' && canExtend(view, e.props.isWorking) ? <Button key="extend" plain dimColor label={extendLabel(view.extendUsd)} onPress={extend} /> : null,
    ]

    const row = (key: string, left: RenderChildren[], right: RenderChildren[]) => (
      <Box key={key} flexDirection="row" gap={2} width={e.props.bodyColumns}>
        {left}
        <Box key="grow" flexGrow={1} />
        {right}
      </Box>
    )

    const rows = isNarrow(e.props.bodyColumns)
      ? [row('work', work, []), row('limits', health, limits)]
      : [row('work', work, [...health, ...limits])]

    const stages = open === 'stage' && f ? (
      <Box key="stages" flexDirection="row" flexWrap="wrap">
        {f.stages.map((s, i) => {
          const word = (
            <Text key={s.id} color={s.state === 'waiting' || s.state === 'running' || s.state === 'here' ? AMBER : undefined} dimColor={s.state === 'todo'} bold={s.state === 'waiting'}>
              {i ? ' · ' : ''}{stageWord(s.id, s.state)}
            </Text>
          )
          return f.selected && f.root ? <Button key={`stage-${s.id}`} plain onPress={() => runWork($, f.root as string, ['--stage', s.id])}>{word}</Button> : word
        })}
      </Box>
    ) : null
    const openLink = (key: string, file: string) => (f?.root ? <Text key={key}><Link href={fileLink(f.root, file)} label="open" /></Text> : null)
    const allWork = f?.work ?? []
    const workPanel = open === 'work' && f?.root ? (
      <Box key="work" flexDirection="column">
        {f.problem ? <Text key="current">{panelLines('problem', f).join('   ')}</Text> : null}
        {allWork.length ? null : <Text key="none" dimColor>Nothing open. Start with canon new.</Text>}
        {allWork.slice(0, WORK_ROWS).map(row => (
          <Box key={row.id} flexDirection="row" gap={2}>
            <Button key={`pick-${row.id}`} plain onPress={() => runWork($, f.root as string, [row.id])}>
              <Text color={row.id === f.selected ? AMBER : undefined}>{row.id}</Text>
            </Button>
            <Text key="title">{row.title}</Text>
            {row.stage ? <Text key="at" dimColor>{row.waiting ? `${row.stage} waiting` : row.stage}</Text> : null}
            {openLink(`open-${row.id}`, row.file)}
          </Box>
        ))}
        {allWork.length > WORK_ROWS ? <Text key="more" dimColor>{allWork.length - WORK_ROWS} more: canon queue, then canon work ID</Text> : null}
        {f.selected ? <Button key="clear-work" plain dimColor label="select nothing" onPress={() => runWork($, f.root as string, ['--clear'])} /> : null}
      </Box>
    ) : null
    const lines = open && open !== 'stage' && open !== 'route' && open !== 'work' && f ? panelLines(open, f) : []

    const mine = (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        {rows}
        {stages}
        {routePanel}
        {workPanel}
        {lines.map(line => <Text key={line}>{line}</Text>)}
        {open === 'review' && f?.problem ? openLink('open-review', f.problem.file) : null}
      </Box>
    )
    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  }).catch(($, e, next) => next(e))
}
