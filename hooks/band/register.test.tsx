import { expect, mock, test } from 'claude-code/testing'

import { afterEditText, fileLink, isChangingCall, isGatedPage, isInside, isWeighSkill, movedTo, afterEdit, afterTestRun, cacheView, canExtend, coldLabel, contextView, cut, extendLabel, infoLine, isNarrow, isTestCommand, nextSize, panelLines, replyRule, windowViews } from './facts'
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
  expect(extendLabel(53, 0.2)).toBe('↻ 53m +$0.20')
  expect(coldLabel(8)).toBe('◌ cold ~$8.00')
})

test('with nothing cached, or an unknown model, nothing false is shown', () => {
  expect(cacheView(null, 1)).toBeNull()
  expect(cacheView({ lastAt: 0, tokens: 5, model: OPUS }, 1)).toBeNull()
  expect(cacheView({ lastAt: 1, tokens: 5, model: 'new-model' }, 2)).toEqual({ mode: 'warm', minutesLeft: 60, extendUsd: null })
  expect(extendLabel(5, null)).toBe('↻ 5m')
  expect(extendLabel(5, 0.001)).toBe('↻ 5m +<$0.01')
})

test('extend shows only on a warm cache with no reply running', () => {
  const warm = { mode: 'warm', minutesLeft: 5, extendUsd: 0.1 } as const
  expect(canExtend(warm, false)).toBe(true)
  expect(canExtend(warm, true)).toBe(false)
  expect(canExtend({ mode: 'cold', nextUsd: 1 }, false)).toBe(false)
  expect(canExtend(null, false)).toBe(false)
})

test('usage shows what is left, red under 20% with the reset only then, amber under 40%', () => {
  const now = Date.parse('2026-11-02T00:00:00Z')
  const views = windowViews(
    [
      { kind: 'five_hour', percentUsed: 65 },
      { kind: 'seven_day', percentUsed: 91, resetsAt: '2026-11-05T09:00:00Z' },
      { kind: 'other', percentUsed: 1 },
    ],
    now,
  )
  expect(views).toEqual([
    { name: '7D', left: 9, reset: '3d 9h', label: '7D 9% 3d 9h', level: 'bad' },
    { name: '5H', left: 35, reset: null, label: '5H 35%', level: 'warn' },
  ])
})

test('the context shows the room left, and nothing before the first reading', () => {
  expect(contextView(38.4)).toMatchObject({ label: 'ctx 62%', level: 'ok' })
  expect(contextView(88)).toMatchObject({ label: 'ctx 12%', level: 'bad' })
  expect(contextView(null)).toBeNull()
})

test('a long title is cut to fit, and a short one is left alone', () => {
  expect(cut('Agents guess and ignore product rules when they plan', 40)).toBe('Agents guess and ignore product rules w…')
  expect(cut('Ads too frequent', 40)).toBe('Ads too frequent')
})

test('reply size goes S, M, L and round, and each size tells the model what to write', () => {
  expect([nextSize('S'), nextSize('M'), nextSize('L')]).toEqual(['M', 'L', 'S'])
  expect(replyRule('S')).toContain('one to three lines')
  expect(replyRule('L')).toContain('trade-offs')
})

test('a click on a short item says what it means in one line', () => {
  const base = { isAwake: false, size: 'M' as const, sessionUsd: 1.2, running: null, tests: 'stale' as const, windows: windowViews([{ kind: 'seven_day', percentUsed: 91, resetsAt: '2026-11-05T09:00:00Z' }], Date.parse('2026-11-02T00:00:00Z')), context: contextView(40), cache: null }
  expect(infoLine('awake', base)).toContain('not keeping the Mac awake')
  expect(infoLine('awake', { ...base, isAwake: true })).toContain('will not sleep')
  expect(infoLine('size', base)).toContain('short bullet list')
  expect(infoLine('cost', base)).toBe('This session has spent $1.20.')
  expect(infoLine('7D', base)).toBe('7D: 9% of your weekly limit is left. It resets in 3d 9h.')
  expect(infoLine('5H', base)).toBe('5H: no reading yet.')
  expect(infoLine('ctx', base)).toContain('60% of the context window is left')
  expect(infoLine('tests', base)).toContain('Run them again')
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
    expect(await ui.find({ type: 'Text', text: /WAITING ON YOU/ })).toBeDefined()
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
    expect(await ui.find({ key: 'checks' })).toBeUndefined()
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
  expect(await ui.find({ type: 'Text', text: /↻ 53m \+\$0\.20/ })).toBeDefined()
  await ui.press({ key: 'cache' })
  expect(sent).toEqual(['Reply with only: ok'])
  expect(await ui.find({ type: 'Text', text: /extending/ })).toBeDefined()
  await ui.unmount()
})

test('no extend button while a reply runs', async ($, on) => {
  await resumed($, on, 7 * 60)
  const ui = await $.ui.mount(render('terminal', 140, true))
  expect(await ui.find({ key: 'cache' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^↻ 53m$/ })).toBeDefined()
  await ui.unmount()
})

test('no extend button on a cold cache, which shows its price', async ($, on) => {
  const sent: string[] = []
  await resumed($, on, 2 * 60 * 60, sent)
  const ui = await $.ui.mount(render('terminal'))
  expect(await ui.find({ type: 'Text', text: /◌ cold ~\$8\.00/ })).toBeDefined()
  await ui.press({ key: 'cache' })
  expect(sent).toEqual([])
  expect(await ui.find({ type: 'Text', text: /next reply reads the whole chat again/ })).toBeDefined()
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
    if (e.argv[1] !== 'band') return { value: { exitCode: 0, stdout: '', stderr: '' } }
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

const PICKING: BandFacts = {
  ...FACTS,
  root: '/w/shop',
  selected: 'PROB-0012',
  work: [
    { id: 'PROB-0012', title: 'Ads too frequent', stage: 'design', waiting: 'design', file: '.context/problems/0012.md' },
    { id: 'PLAN-0003', title: 'Fewer ads', stage: 'plan', waiting: null, file: '.context/plans/0003 a#b.md' },
  ],
}

function picking(on: any, band: BandFacts = PICKING) {
  const calls: string[][] = []
  on('env.get', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w/shop' }))
  on('session.model', () => ({ value: OPUS }))
  mock.clock(on)
  mock.store(on)
  on('process.run', (_: unknown, e: any) => {
    calls.push(e.argv)
    return { value: { exitCode: 0, stdout: JSON.stringify(band), stderr: '' } }
  })
  on('tool.call', () => ({ result: {} }))
  return calls
}

test('the task shows in words and opens its page, and the band cannot change the task or move a stage', async ($, on) => {
  const calls = picking(on)
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(render('terminal'))
  expect(await ui.find({ type: 'Link', label: /Ads too frequent/ } as any)).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /PROB-0012/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', text: /pick work/ })).toBeUndefined()
  await ui.press({ key: 'stage' })
  expect(await ui.find({ key: 'stage-design' })).toBeUndefined()
  expect(calls.some(argv => argv[1] === 'work')).toBe(false)
  await ui.unmount()
})

test('the reply size starts at M, a click moves it on, and a typed prompt carries it', async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  picking(on)
  on('prompt.submit', (_: unknown, e: any) => {
    seen.push(e.context)
    return { text: e.text }
  })
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(render('terminal'))
  expect((await ui.find({ type: 'Text', text: /^M$/ }))).toBeDefined()
  await ui.press({ key: 'size' })
  expect((await ui.find({ type: 'Text', text: /^L$/ }))).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Reply size L/ })).toBeDefined()
  await $.prompt.submit({ text: 'why?', origin: { kind: 'composer' } })
  await $.prompt.submit({ text: '/clear', origin: { kind: 'composer' } })
  expect(seen[0]?.at(-1)).toContain('Reply size L')
  expect(seen[1]).toBeUndefined()
  await ui.unmount()
})

test('the moon keeps the Mac awake with caffeinate, and says so', async ($, on) => {
  const spawned: string[][] = []
  picking(on)
  on('process.spawn', async function* (_: unknown, e: any) {
    spawned.push(e.argv)
    return { value: { code: 0, signal: null } }
  })
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(render('terminal'))
  expect(await ui.find({ type: 'Text', text: /☼/ })).toBeDefined()
  await ui.press({ key: 'awake' })
  expect(spawned).toEqual([['/bin/sh', '-c', 'exec caffeinate -dis -w "$PPID"']])
  expect(await ui.find({ type: 'Text', text: /will not sleep|not keeping the Mac awake/ })).toBeDefined()
  await ui.unmount()
})

test('a click on the cost says what it counts', async ($, on) => {
  picking(on)
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(render('terminal'))
  await ui.press({ key: 'cost' })
  expect(await ui.find({ type: 'Text', text: /This session has spent \$0\.00/ })).toBeDefined()
  await ui.press({ key: 'cost' })
  expect(await ui.find({ type: 'Text', text: /This session has spent/ })).toBeUndefined()
  await ui.unmount()
})

test('a file link opens the page, even with odd characters in its name', () => {
  expect(fileLink('/w/shop', '.context/plans/0003 a#b.md')).toBe('file:///w/shop/.context/plans/0003%20a%23b.md')
})

test('an edit never asks canon to move a stage: nothing on the band selects work', async ($, on) => {
  const calls = picking(on)
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/w/shop/src/a.ts', old_string: 'a', new_string: 'b' })
  expect(calls.some(argv => argv[1] === 'work')).toBe(false)
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
  expect(routeLabel('auto', 'sonnet', 'medium')).toBe('son·med')
  expect(routeLabel('you', 'opus', 'high')).toBe('opus·hi')
  expect(routeLabel('default', 'opus', undefined)).toBe('opus ?')
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

test('the gate judges markdown under .context, outside designs and packs', () => {
  expect(isGatedPage('/w/shop/.context/wiki/a.md')).toBe(true)
  expect(isGatedPage('/w/shop/.context/designs/a.md')).toBe(false)
  expect(isGatedPage('/w/shop/src/a.md')).toBe(false)
  expect(isGatedPage('/w/shop/.context/wiki/a.html')).toBe(false)
  expect(afterEditText('a b a', 'a', 'c', false)).toBe('c b a')
  expect(afterEditText('a b a', 'a', '$&', true)).toBe('$& b $&')
  expect(afterEditText('a', 'x', 'y', false)).toBeNull()
})

test('a page the gate refuses is not written, and the reason reaches the agent', async ($, on) => {
  const gated: { argv: string[]; stdin?: string }[] = []
  let wrote = false
  on('env.get', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w/shop' }))
  on('session.model', () => ({ value: OPUS }))
  mock.clock(on)
  mock.store(on)
  // Typed loosely like the other mocks here: a test hook answers with a value alone.
  const anyOn = on as any
  anyOn('process.run', (_: unknown, e: any) => {
    if (e.argv[1] !== 'gate') return { value: { exitCode: 0, stdout: JSON.stringify(FACTS), stderr: '' } }
    gated.push({ argv: e.argv, stdin: e.init?.stdin })
    const isBad = String(e.init?.stdin).includes('copy')
    return { value: { exitCode: isBad ? 1 : 0, stdout: isBad ? 'warn  .context/wiki/b.md  repeats .context/wiki/a.md' : '', stderr: '' } }
  })
  on('tool.call', () => {
    wrote = true
    return { result: {} }
  })
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  const refused = await $.tool.call({ tool: 'Write', file_path: '/w/shop/.context/wiki/b.md', content: 'a copy' })
  expect(wrote).toBe(false)
  expect(JSON.stringify(refused)).toContain('repeats .context/wiki/a.md')
  await $.tool.call({ tool: 'Write', file_path: '/w/shop/.context/wiki/c.md', content: 'new' })
  expect(wrote).toBe(true)
  await $.tool.call({ tool: 'Write', file_path: '/w/shop/src/a.ts', content: 'copy' })
  expect(gated.map(g => g.argv[2])).toEqual(['/w/shop/.context/wiki/b.md', '/w/shop/.context/wiki/c.md'])
})

test('a change is a write or a command that does more than look', () => {
  expect(isChangingCall('Edit')).toBe(true)
  expect(isChangingCall('Read')).toBe(false)
  expect(isChangingCall('Bash', 'git status && ls -la | grep x')).toBe(false)
  expect(isChangingCall('Bash', 'canon check . && git commit -m x')).toBe(true)
  expect(isChangingCall('Bash', 'rm -rf build')).toBe(true)
  expect([isWeighSkill('canon-process:weigh'), isWeighSkill('weigh'), isWeighSkill('weighing')]).toEqual([true, true, false])
})

function sized(on: any, size: string) {
  const calls: string[] = []
  engine(on, { ...FACTS, features: ['routing'] })
  on('fs.read', () => ({ value: '' }))
  on('fs.write', () => ({ value: undefined }))
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text }))
  on('model.complete', () => ({ value: { isAnswered: true, text: size, usage: { input_tokens: 10, output_tokens: 1 } } }))
  on('tool.call', (_: unknown, e: any) => {
    calls.push(e.tool)
    return { result: {} }
  })
  return calls
}

test('a large prompt reads freely, but changes nothing until weigh has run', async ($, on) => {
  const calls = sized(on, 'large')
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'Give me a complete app', origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Read', file_path: '/w/shop/a.ts' })
  const refused = await $.tool.call({ tool: 'Write', file_path: '/w/shop/a.ts', content: 'x' })
  expect(JSON.stringify(refused)).toContain('weigh skill')
  expect(calls).toEqual(['Read'])
  await $.tool.call({ tool: 'Skill', skill: 'canon-process:weigh' })
  await $.tool.call({ tool: 'Write', file_path: '/w/shop/a.ts', content: 'x' })
  expect(calls).toEqual(['Read', 'Skill', 'Write'])
})

test('a small prompt is never held for weigh', async ($, on) => {
  const calls = sized(on, 'small')
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'fix the typo', origin: { kind: 'composer' } })
  await $.tool.call({ tool: 'Write', file_path: '/w/shop/a.ts', content: 'x' })
  expect(calls).toEqual(['Write'])
})

test('a panel for reading closes by itself, and one opened later is not closed early', async ($, on) => {
  on('env.get', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w/shop' }))
  on('session.model', () => ({ value: OPUS }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify({ ...FACTS, root: '/w/shop' }), stderr: '' } }))
  const clock = mock.clock(on)
  mock.store(on)
  await $.session.start({ cwd: '/w/shop', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(render('terminal'))
  await ui.press({ key: 'cost' })
  expect(await ui.find({ type: 'Text', text: /This session has spent/ })).toBeDefined()
  await clock.advance(4000)
  await ui.press({ key: 'size' })
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /Reply size/ })).toBeDefined()
  await clock.advance(4000)
  expect(await ui.find({ type: 'Text', text: /Reply size/ })).toBeUndefined()
  await ui.unmount()
})
