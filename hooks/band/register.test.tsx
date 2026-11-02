import { expect, mock, test } from 'claude-code/testing'

import { isInside, movedTo, afterEdit, afterTestRun, cacheView, canExtend, coldLabel, extendLabel, isNarrow, isTestCommand, panelLines, windowViews } from './facts'
import { classifierPrompt, isRoutable, parseSize, pick, routeLabel, routeMode, tierOf } from './routing'
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
  features: ['process'],
}

const OPUS = 'claude-opus-5-5'
const render = (surface: 'terminal' | 'desktop', columns = 140, isWorking = false) =>
  ({ plugin: 'canon', component: 'AbovePrompt', surface, props: { hasSurvey: false, isWorking, maxRows: 12, bodyColumns: columns, scroll: { offset: 0, bodyRows: 12 }, view: {} } }) as const

const NOW = Date.parse('2026-11-02T10:00:00Z')

function engine(on: any, band: BandFacts | null, frozen = false, env: Record<string, string> = {}) {
  on('env.get', (_: unknown, e: any) => ({ value: env[e.name] }))
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

  test(`on ${surface}, without process the band shows no product, stage or checks`, async ($, on) => {
    engine(on, { ...FACTS, features: [] })
    await $.session.start({ cwd: '/w/shop', surface, isInteractive: true })
    const ui = await $.ui.mount(render(surface))
    expect(await ui.find({ type: 'Text', text: /shop/ })).toBeUndefined()
    expect(await ui.find({ key: 'waiting' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /checks ok/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`on ${surface}, when canon cannot run the band still draws, with no product`, async ($, on) => {
    engine(on, null)
    await $.session.start({ cwd: '/w', surface, isInteractive: true })
    const ui = await $.ui.mount(render(surface))
    expect(await ui.find({ key: 'waiting' })).toBeUndefined()
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

test('a Bash command moves the band when it changes folder', () => {
  expect(movedTo('cd shop && pnpm test', '/w')).toBe('/w/shop')
  expect(movedTo('cd /w/a && cd /w/b', '/w')).toBe('/w/b')
  expect(movedTo('git -C /w/shop status', '/w')).toBe('/w/shop')
  expect(movedTo('ls /w/shop', '/w')).toBeNull()
  expect(movedTo('cd ~/shop', '/w')).toBeNull()
  expect(movedTo('echo cd shop', '/w')).toBeNull()
})

test('a path inside the shown product needs no new read, and a similar name is not inside', () => {
  expect(isInside('/w/shop/a.ts', 'shop')).toBe(true)
  expect(isInside('/w/shop', 'shop')).toBe(true)
  expect(isInside('/w/shop-two/a.ts', 'shop')).toBe(false)
  expect(isInside('/w/a.ts', null)).toBe(false)
})

function following(on: any) {
  const paths: string[] = []
  on('env.get', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w' }))
  on('session.model', () => ({ value: OPUS }))
  mock.clock(on)
  mock.store(on)
  on('tool.call', () => ({ result: {} }))
  on('process.run', (_: unknown, e: any) => {
    const path = e.argv[2]
    paths.push(path)
    const product = path.startsWith('/w/one') ? 'one' : path.startsWith('/w/two') ? 'two' : null
    return { value: { exitCode: 0, stdout: JSON.stringify({ ...FACTS, product, waiting: null, errors: [], features: ['process'] }), stderr: '' } }
  })
  return paths
}

test('from a parent folder the band follows edits between products, and ignores a path in no product', async ($, on) => {
  const paths = following(on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(render('terminal'))

  await $.tool.call({ tool: 'Edit', file_path: '/w/one/a.ts', old_string: 'a', new_string: 'b' })
  expect(await ui.find({ type: 'Text', text: /^one/ })).toBeDefined()

  const reads = paths.length
  await $.tool.call({ tool: 'Edit', file_path: '/w/one/b.ts', old_string: 'a', new_string: 'b' })
  expect(paths.length).toBe(reads)

  await $.tool.call({ tool: 'Bash', command: 'cd /tmp/x && ls' })
  expect(await ui.find({ type: 'Text', text: /^one/ })).toBeDefined()

  await $.tool.call({ tool: 'Bash', command: 'cd two && ls' })
  expect(await ui.find({ type: 'Text', text: /^two/ })).toBeDefined()
  await ui.unmount()
})

const NONE = { model: null, effort: null }

test('the first prompt of a session picks by size', () => {
  const base = { chosen: NONE, isFresh: true, current: 'opus' as const, tokens: 1000 }
  expect(pick({ ...base, size: 'small' })).toEqual({ model: 'haiku', effort: 'low' })
  expect(pick({ ...base, size: 'medium' })).toEqual({ model: 'sonnet', effort: 'medium' })
  expect(pick({ ...base, size: 'large' })).toEqual({ model: 'opus', effort: 'high' })
})

test('mid-session the model only moves up, while effort follows each prompt', () => {
  const base = { chosen: NONE, isFresh: false, tokens: 1000 }
  expect(pick({ ...base, size: 'small', current: 'opus' })).toEqual({ model: 'opus', effort: 'low' })
  expect(pick({ ...base, size: 'large', current: 'haiku' })).toEqual({ model: 'opus', effort: 'high' })
})

test('Haiku is not picked for a chat too large for it', () => {
  expect(pick({ chosen: NONE, isFresh: true, current: null, tokens: 150_000, size: 'small' }).model).toBe('sonnet')
})

test('a failed decision keeps what is running, and the person always wins', () => {
  expect(pick({ chosen: NONE, isFresh: true, current: 'opus', tokens: 1, size: null })).toEqual({ model: 'opus', effort: null })
  expect(pick({ chosen: { model: 'opus', effort: 'high' }, isFresh: false, current: 'opus', tokens: 1, size: 'small' })).toEqual({ model: 'opus', effort: 'high' })
  expect(pick({ chosen: { model: 'haiku', effort: null }, isFresh: false, current: 'opus', tokens: 1, size: 'medium' })).toEqual({ model: 'haiku', effort: 'medium' })
})

test('only a clear first word counts as an answer', () => {
  expect(parseSize('Small')).toBe('small')
  expect(parseSize('large.')).toBe('large')
  expect(parseSize('It is large')).toBeNull()
  expect(parseSize('')).toBeNull()
})

test('slash commands and messages from a mod are not decided on, and long prompts are cut', () => {
  expect(isRoutable('fix the bug', false)).toBe(true)
  expect(isRoutable('/clear', false)).toBe(false)
  expect(isRoutable('ok', true)).toBe(false)
  expect(classifierPrompt('x'.repeat(5000)).length).toBeLessThan(2100)
})

test('a model id finds its tier, and the label says who chose', () => {
  expect(tierOf('claude-opus-5-5')).toBe('opus')
  expect(tierOf('opus[1m]')).toBe('opus')
  expect(tierOf('other')).toBeNull()
  expect(routeMode(NONE, 'small')).toBe('auto')
  expect(routeMode(NONE, null)).toBe('default')
  expect(routeMode({ model: 'opus', effort: null }, 'small')).toBe('you')
  expect(routeLabel('auto', 'sonnet', 'medium')).toBe('auto: sonnet · medium')
  expect(routeLabel('you', 'opus', 'high')).toBe('you: opus · high')
  expect(routeLabel('default', 'opus', undefined)).toBe('auto: opus (default)')
})

function routed(on: any, env: Record<string, string> = {}, features: string[] = ['routing']) {
  const asked: string[] = []
  engine(on, { ...FACTS, features }, false, env)
  on('fs.read', () => ({ value: '' }))
  on('fs.write', () => ({ value: undefined }))
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text }))
  on('model.complete', (_: unknown, e: any) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true, text: 'small', usage: { input_tokens: 10, output_tokens: 1 } } }
  })
  return asked
}

test('an interactive session decides on a typed prompt, but not on a slash command', async ($, on) => {
  const asked = routed(on)
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: '/clear', origin: { kind: 'composer' } })
  expect(asked.length).toBe(0)
  await $.prompt.submit({ text: 'what is this?', origin: { kind: 'composer' } })
  expect(asked.length).toBe(1)
})

test('routing is off unless the repo turns it on: nothing is sent and no pick shows', async ($, on) => {
  const asked = routed(on, {}, [])
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'what is this?', origin: { kind: 'composer' } })
  expect(asked.length).toBe(0)
  const ui = await $.ui.mount(render('terminal'))
  expect(await ui.find({ key: 'route' })).toBeUndefined()
  await ui.unmount()
})

test('a headless session is never routed', async ($, on) => {
  const asked = routed(on)
  await $.session.start({ cwd: '/w/shop', surface: null, isInteractive: false })
  await $.prompt.submit({ text: 'what is this?', origin: { kind: 'composer' } })
  expect(asked.length).toBe(0)
})

test('a canon run agent is never routed, so its stage model and cap hold', async ($, on) => {
  const asked = routed(on, { CANON_RUN: '1' })
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'what is this?', origin: { kind: 'composer' } })
  expect(asked.length).toBe(0)
})
