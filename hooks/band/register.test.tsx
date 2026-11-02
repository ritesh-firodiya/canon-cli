import { expect, mock, test } from 'claude-code/testing'

import { afterEdit, afterTestRun, cacheView, canExtend, coldLabel, extendLabel, isNarrow, isTestCommand, panelLines, windowViews } from './facts'
import type { BandFacts } from './types'

const FACTS: BandFacts = {
  product: 'shop',
  stage: 'design',
  stages: [{ id: 'plan', state: 'ok' }, { id: 'design', state: 'waiting' }],
  waiting: { record: 'PROB-0012', stage: 'design' },
  running: null,
  problem: { id: 'PROB-0012', title: 'Ads too frequent', source: 'reviews', priority: 'p1', file: '.context/problems/0012.md' },
  errors: [{ file: 'a.md', message: 'missing last-verified' }],
  warnings: [],
}

const OPUS = 'claude-opus-5-5'
const render = (surface: 'terminal' | 'desktop', columns = 140, isWorking = false) =>
  ({ plugin: 'canon', component: 'AbovePrompt', surface, props: { hasSurvey: false, isWorking, maxRows: 12, bodyColumns: columns, scroll: { offset: 0, bodyRows: 12 }, view: {} } }) as const

const NOW = Date.parse('2026-11-02T10:00:00Z')

function engine(on: any, band: BandFacts | null, frozen = false) {
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w/shop' }))
  on('session.model', () => ({ value: OPUS }))
  on('process.run', () => ({ value: band ? { exitCode: 0, stdout: JSON.stringify(band), stderr: '' } : { exitCode: 1, stdout: '', stderr: 'no' } }))
  if (frozen) {
    on('clock.now', () => ({ value: NOW }))
    on('clock.every', () => ({ value: undefined }))
  } else {
    mock.clock(on)
  }
  mock.store(on)
}

test('the cache is warm for an hour, and each state prices what it costs', () => {
  const warm = cacheView({ lastAt: 1_000_000, tokens: 1_000_000, model: OPUS }, 1_000_000 + 7 * 60000)
  expect(warm).toEqual({ mode: 'warm', minutesLeft: 53, extendUsd: 0.2 })
  const cold = cacheView({ lastAt: 1_000_000, tokens: 1_000_000, model: OPUS }, 1_000_000 + 60 * 60000)
  expect(cold).toEqual({ mode: 'cold', nextUsd: 8 })
  expect(extendLabel(0.2)).toBe('extend ~$0.20')
  expect(coldLabel(8)).toBe('cold · next ~$8.00')
})

test('with nothing cached, or an unknown model, nothing false is shown', () => {
  expect(cacheView(null, 1)).toBeNull()
  expect(cacheView({ lastAt: 0, tokens: 5, model: OPUS }, 1)).toBeNull()
  expect(cacheView({ lastAt: 1, tokens: 5, model: 'new-model' }, 2)).toEqual({ mode: 'warm', minutesLeft: 60, extendUsd: null })
  expect(extendLabel(null)).toBe('extend')
  expect(extendLabel(0.001)).toBe('extend <$0.01')
})

test('extend shows only on a warm cache with no reply running', () => {
  const warm = { mode: 'warm', minutesLeft: 5, extendUsd: 0.1 } as const
  expect(canExtend(warm, false)).toBe(true)
  expect(canExtend(warm, true)).toBe(false)
  expect(canExtend({ mode: 'cold', nextUsd: 1 }, false)).toBe(false)
  expect(canExtend(null, false)).toBe(false)
})

test('usage shows what is left, low only under 15%, with the reset only then', () => {
  const now = Date.parse('2026-11-02T00:00:00Z')
  const views = windowViews(
    [
      { kind: 'five_hour', percentUsed: 4 },
      { kind: 'seven_day', percentUsed: 91, resetsAt: '2026-11-05T09:00:00Z' },
      { kind: 'other', percentUsed: 1 },
    ],
    now,
  )
  expect(views).toEqual([{ label: '7D 9% LOW 3d 9h', isLow: true }, { label: '5H 96%', isLow: false }])
})

test('a test run sets the state, and a later code edit makes it stale', () => {
  expect(isTestCommand('pnpm test')).toBe(true)
  expect(isTestCommand('git status')).toBe(false)
  expect(afterTestRun(true)).toBe('failed')
  expect(afterEdit('ok', 'a.ts')).toBe('stale')
  expect(afterEdit('ok', 'a.md')).toBe('ok')
  expect(afterEdit('none', 'a.ts')).toBe('none')
})

test('a panel tells you the command, and no panel approves anything', () => {
  expect(panelLines('review', FACTS)[1]).toContain('canon approve design --record PROB-0012')
  expect(panelLines('errors', FACTS)).toEqual(['error  a.md  missing last-verified'])
  expect(panelLines('problem', FACTS)[0]).toBe('PROB-0012  Ads too frequent')
  expect(panelLines('warnings', FACTS)).toEqual([])
})

test('a narrow terminal uses two rows', () => {
  expect(isNarrow(80)).toBe(true)
  expect(isNarrow(120)).toBe(false)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`on ${surface}, waiting work shows the product, the gate and its record`, async ($, on) => {
    engine(on, FACTS)
    await $.session.start({ cwd: '/w/shop', surface, isInteractive: true })
    const ui = await $.ui.mount(render(surface))
    expect((await ui.find({ type: 'Text', text: /shop/ }))?.text).toContain('shop')
    expect(await ui.find({ key: 'waiting' })).toBeDefined()
    expect(await ui.find({ key: 'problem' })).toBeDefined()
    await ui.unmount()
  })

  test(`on ${surface}, a click on an error opens its list`, async ($, on) => {
    engine(on, FACTS)
    await $.session.start({ cwd: '/w/shop', surface, isInteractive: true })
    const ui = await $.ui.mount(render(surface))
    await ui.press({ key: 'errors' })
    expect((await ui.find({ type: 'Text', text: /missing last-verified/ }))?.text).toContain('a.md')
    await ui.unmount()
  })

  test(`on ${surface}, outside a product only that is said`, async ($, on) => {
    engine(on, { ...FACTS, product: null, stage: null, waiting: null, errors: [] })
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    const ui = await $.ui.mount(render(surface))
    expect((await ui.find({ type: 'Text', text: /no product here/ }))).toBeDefined()
    await ui.unmount()
  })

  test(`on ${surface}, when canon cannot run the band says so`, async ($, on) => {
    engine(on, null)
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    const ui = await $.ui.mount(render(surface))
    expect((await ui.find({ type: 'Text', text: /canon unavailable/ }))).toBeDefined()
    await ui.unmount()
  })
}

async function resumed($: any, on: any, secondsAway: number, sent: string[] = []) {
  engine(on, FACTS, true)
  on('prompt.submit', (_: unknown, e: any) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: secondsAway, context_tokens: 1_000_000, model: OPUS })
}

test('a click on extend sends one tiny message', async ($, on) => {
  const sent: string[] = []
  await resumed($, on, 7 * 60, sent)
  const ui = await $.ui.mount(render('terminal'))
  expect(await ui.find({ type: 'Text', text: /cache 53m/ })).toBeDefined()
  await ui.press({ key: 'extend' })
  expect(sent).toEqual(['Reply with only: ok'])
  expect(await ui.find({ key: 'extend' })).toBeUndefined()
  await ui.unmount()
})

test('no extend button while a reply runs', async ($, on) => {
  await resumed($, on, 7 * 60)
  const ui = await $.ui.mount(render('terminal', 140, true))
  expect(await ui.find({ key: 'extend' })).toBeUndefined()
  await ui.unmount()
})

test('no extend button on a cold cache, which shows its price', async ($, on) => {
  await resumed($, on, 2 * 60 * 60)
  const ui = await $.ui.mount(render('terminal'))
  expect(await ui.find({ key: 'extend' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /cold · next ~\$8\.00/ })).toBeDefined()
  await ui.unmount()
})
