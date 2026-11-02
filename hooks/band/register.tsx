import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import {
  afterEdit,
  afterTestRun,
  canExtend,
  cacheView,
  capitalise,
  coldLabel,
  duration,
  extendLabel,
  isNarrow,
  isTestCommand,
  money,
  panelLines,
  stageWord,
  testsLabel,
  windowViews,
} from './facts'
import type { BandFacts, CacheFacts, Panel, Tests, UsageWindow } from './types'

// The band above the prompt: the work in one line, in colour only when something needs you.
// Cache and usage logic follow ribbon (MIT, robonuggets/ribbon); test state follows ponytail's band (MIT, DietrichGebert/ponytail).

const TICK_MS = 30_000
const EXTEND_MESSAGE = 'Reply with only: ok'

const AMBER = '#f0b429'
const AMBER_INK = '#241a00'
const RED_BG = '#4a1f1c'
const RED = '#ff7b72'
const BLUE = '#8cc4ff'

const facts = atom({ plugin: 'canon', key: 'facts' } as const, null as BandFacts | null)
const isLoaded = atom({ plugin: 'canon', key: 'isLoaded' } as const, false)
const windows = atom({ plugin: 'canon', key: 'windows' } as const, [] as UsageWindow[])
const cache = atom({ plugin: 'canon', key: 'cache' } as const, null as CacheFacts | null)
const taskUsd = atom({ plugin: 'canon', key: 'taskUsd' } as const, 0)
const tests = atom({ plugin: 'canon', key: 'tests' } as const, 'none' as Tests)
const panel = atom({ plugin: 'canon', key: 'panel' } as const, null as Panel | null)
const isExtending = atom({ plugin: 'canon', key: 'isExtending' } as const, false)

async function refreshFacts($: EngineInterface): Promise<void> {
  const cwd = await $.session.cwd()
  const run = await $.process.run(['canon', 'band', cwd]).catch(() => undefined)
  await update($, isLoaded, () => true)
  if (run?.exitCode !== 0) return void update($, facts, () => null)
  try {
    const parsed = JSON.parse(run.stdout) as BandFacts
    await update($, facts, () => parsed)
  } catch {
    await update($, facts, () => null)
  }
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
        await update($, tests, () => 'none' as Tests)
        await update($, panel, () => null)
      }
    } else if ((e.source === 'resume' || e.source === 'fork') && typeof e.seconds_since_last_response === 'number') {
      const now = await $.clock.now()
      const seconds = e.seconds_since_last_response
      await update($, cache, () => ({
        lastAt: now - seconds * 1000,
        tokens: typeof e.context_tokens === 'number' ? e.context_tokens : 0,
        model: typeof e.model === 'string' ? e.model : null,
      }))
    }
    return result
  }).catch(($, e, next) => next(e))

  // Each main request reads or writes the cache, so its start restarts the hour.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const now = await $.clock.now()
      await update($, cache, c => ({ lastAt: now, tokens: c?.tokens ?? 0, model: e.model }))
    }
    yield* next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined) return result
    if (e.tool === 'Bash' && isTestCommand(e.command)) await update($, tests, () => afterTestRun(Boolean(result.isError)))
    if ((e.tool === 'Edit' || e.tool === 'Write') && !result.isError) await update($, tests, value => afterEdit(value, e.file_path))
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    await update($, isExtending, () => false)
    await refreshUsage($, await $.clock.now(), e.usage?.model ?? null)
    await refreshFacts($)
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Other mods share this slot: theirs draw below.
    const below = await next(e).catch(() => undefined)
    const { Box, Button, Text } = $.ui.resolve(e)
    const f = await read($, facts)
    const loaded = await read($, isLoaded)
    const now = await $.clock.now()
    const open = await read($, panel)
    const extending = await read($, isExtending)
    const view = cacheView(await read($, cache), now)
    const usage = windowViews(await read($, windows), now)
    const testState = await read($, tests)
    const task = await read($, taskUsd)

    const toggle = (name: Panel) => () => update($, panel, value => (value === name ? null : name))
    const extend = async () => {
      await update($, isExtending, () => true)
      void $.prompt.submit({ text: EXTEND_MESSAGE })
    }

    const work = f?.product
      ? [
          <Text key="product">{f.product}{f.stage ? ' · ' : ''}</Text>,
          f.stage ? <Button key="stage" plain label={capitalise(f.stage)} onPress={toggle('stage')} /> : null,
          f.waiting ? <Button key="waiting" plain onPress={toggle('review')}><Text backgroundColor={AMBER} color={AMBER_INK} bold> WAITING ON YOU </Text></Button> : null,
          f.errors.length ? <Button key="errors" plain onPress={toggle('errors')}><Text backgroundColor={RED_BG} color={RED} bold> {f.errors.length} ERROR{f.errors.length === 1 ? '' : 'S'} </Text></Button> : null,
          f.running ? <Text key="running" color={BLUE} bold>running {duration(now - Date.parse(f.running.startedAt))}</Text> : null,
          f.problem && (f.running || f.waiting) ? <Button key="problem" plain dimColor label={f.problem.id} onPress={toggle('problem')} /> : null,
          f.running ? <Text key="spend">{money(f.running.spendUsd)} of {money(f.running.capUsd)}</Text> : null,
          !f.running && !f.waiting && task > 0 ? <Text key="task" dimColor>task {money(task)}</Text> : null,
        ]
      : [<Text key="none" dimColor>{f ? 'no product here' : loaded ? 'canon unavailable' : ''}</Text>]

    const health = f?.product
      ? [
          f.warnings.length ? <Button key="warnings" plain onPress={toggle('warnings')}><Text color={AMBER}>{f.warnings.length} warning{f.warnings.length === 1 ? '' : 's'}</Text></Button> : null,
          !f.errors.length && !f.warnings.length ? <Text key="checks" dimColor>checks ok</Text> : null,
          testState === 'ok' ? <Text key="tests" dimColor>{testsLabel(testState)}</Text> : null,
          testState === 'stale' ? <Text key="tests" color={AMBER}>{testsLabel(testState)}</Text> : null,
          testState === 'failed' ? <Text key="tests" color={RED} bold>{testsLabel(testState)}</Text> : null,
        ]
      : []

    const limits = [
      ...usage.map(w => (w.isLow ? <Text key={w.label} color={RED} bold>{w.label}</Text> : <Text key={w.label}>{w.label}</Text>)),
      view?.mode === 'cold' ? <Text key="cache" color={AMBER}>{coldLabel(view.nextUsd)}</Text> : null,
      view?.mode === 'warm' ? <Text key="cache" dimColor>cache {view.minutesLeft}m</Text> : null,
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
      ? [row('work', [<Text key="brand" bold>canon</Text>, ...work], []), row('limits', health, limits)]
      : [row('work', [<Text key="brand" bold>canon</Text>, ...work], [...health, ...limits])]

    const stages = open === 'stage' && f ? (
      <Box key="stages" flexDirection="row" flexWrap="wrap">
        {f.stages.map((s, i) => (
          <Text key={s.id} color={s.state === 'waiting' || s.state === 'running' || s.state === 'here' ? AMBER : undefined} dimColor={s.state === 'todo'} bold={s.state === 'waiting'}>
            {i ? ' · ' : ''}{stageWord(s.id, s.state)}
          </Text>
        ))}
      </Box>
    ) : null
    const lines = open && open !== 'stage' && f ? panelLines(open, f) : []

    const mine = (
      <Box flexDirection="column" width={e.props.bodyColumns}>
        {rows}
        {stages}
        {lines.map(line => <Text key={line}>{line}</Text>)}
      </Box>
    )
    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  }).catch(($, e, next) => next(e))
}
