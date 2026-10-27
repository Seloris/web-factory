import { expect, test } from 'claude-code/testing'

import { chaptersOf, duration, flowOf } from '../hooks/register'

const SESSION = JSON.stringify({
  runs: [
    { id: 's:3', agentId: null, since: '2026-10-27T10:31:00Z', request: 'Why is the build slow?', phase: 'turn-ended', status: 'The lint takes 40 s', recap: null, commits: [] },
    { id: 's:2', agentId: 'a1', request: 'reviewer', phase: 'job-done', status: 'clean', commits: [] },
    {
      id: 's:1', agentId: null, since: '2026-10-27T10:02:00Z', request: 'Add a filter', phase: 'job-done', status: 'A filter on the list',
      recap: { text: 'A filter on the list', changelogEntry: 'Added — The list filters open todos.' },
      commits: [{ sha: 'abc1234', subject: 'feat(home): a filter' }],
    },
  ],
})

const engine = (on: Parameters<Parameters<typeof test>[1]>[1], file: string | null, now = 1) => {
  on('command.register', () => ({ value: { command: 'recap' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's' }))
  on('env.get', (_, e) => ({ value: e.name === 'USERPROFILE' ? '/home/me' : undefined }))
  on('fs.exists', (_, e) => ({ value: file !== null && e.path.replace(/\\/g, '/').endsWith('/home/me/.claude/selo/sessions/s.json') }))
  on('fs.read', () => ({ value: file ?? '' }))
  on('clock.now', () => ({ value: now }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 455400, window: 1000000, percent: 46 }, rateLimits: [] } }))
}

const BAND = {
  plugin: 'selo-feed',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const PANE = {
  plugin: 'selo-feed',
  component: 'Pane',
  requestId: 'selo-recap',
  props: { title: 'Récap', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// What a pane says: its texts on the terminal, its SVG's source on desktop.
const said = async (pane: { find: (q: object) => Promise<unknown> }, re: RegExp) => {
  const svg = (await pane.find({ type: 'Svg' })) as { type?: string; props?: { source?: string } } | undefined
  if (svg?.type === 'Svg') return re.test((svg.props?.source ?? '').replace(/&amp;/g, '&'))
  return (await pane.find({ type: 'Text', text: re })) !== undefined
}

test('the band and the pane show the main runs, the latest last, on every surface', async ($, on) => {
  engine(on, SESSION)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ key: 'toggle' })).toBeDefined()
    await band.unmount()

    const pane = await $.ui.mount({ ...PANE, surface })
    expect([surface, String(/Tour terminé/), await said(pane, /Tour terminé/)]).toEqual([surface, String(/Tour terminé/), true])
    expect([surface, String(/abc1234/), await said(pane, /abc1234/)]).toEqual([surface, String(/abc1234/), true])
    expect([surface, String(/A filter on the list/), await said(pane, /A filter on the list/)]).toEqual([surface, String(/A filter on the list/), true])
    expect([surface, String(/clean/), await said(pane, /clean/)]).toEqual([surface, String(/clean/), false])
    await pane.unmount()
  }
})

test('the newest first: maintenant, the current prompt, then the past ones', async ($, on) => {
  engine(on, SESSION)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const source = ((await pane.find({ type: 'Svg' })) as { props: { source: string } }).props.source
  const order = ['maintenant', 'Why is the build slow?', 'Add a filter'].map(s => source.indexOf(s))
  expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))).toBe(true)
  await pane.unmount()
})

test('no export file: the band is still there, and its button opens then closes the pane', async ($, on) => {
  engine(on, null)
  const calls: string[] = []
  on('ui.open', (_, e) => {
    calls.push(`open ${e.id}`)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    calls.push(`close ${e.id}`)
    return { value: undefined }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'toggle' })
  expect(calls).toEqual(['open selo-recap'])
  expect(await band.find({ type: 'Button', text: /^[◨◫]$/ })).toBeDefined()
  await band.press({ key: 'toggle' })
  expect(calls).toEqual(['open selo-recap', 'close selo-recap'])
  expect(await band.find({ type: 'Button', text: /^[◨◫]$/ })).toBeDefined()
  await band.unmount()
})

const at = (m: number, sec = 0) => `2026-10-27T13:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.000Z`
const PILOT = [
  { agentId: 'a2', agentType: 'runner', task: 'npx vitest run checkout', since: at(54, 5), updatedAt: at(54, 30), phase: 'working' },
  { agentId: 'a1', agentType: 'reviewer', task: 'relecture du blueprint', since: at(49, 40), updatedAt: at(50, 40), phase: 'job-done' },
  {
    id: 's:1', agentId: null, since: at(47, 58), flow: 'pilot', mode: 'autonomous', phase: 'working', request: 'checkout', trailCut: false,
    trail: [
      { at: at(47, 58), skill: 'pilot', step: null, substep: null, phase: 'working' },
      { at: at(48, 28), skill: 'blueprint', step: null, substep: null, phase: 'working' },
      { at: at(50, 58), skill: 'blueprint', step: null, substep: null, phase: 'awaiting-commit' },
      { at: at(52, 58), skill: 'blueprint', step: null, substep: null, phase: 'working' },
      { at: at(53, 58), skill: 'build', step: 'stage:1', substep: 'tests', phase: 'working' },
    ],
  },
]

test('the flow: one chapter per step, the wait in it, the subagents where they started', () => {
  const chapters = chaptersOf(flowOf(PILOT)!, Date.parse(at(55, 10)))
  expect(chapters.map(c => [c.name, c.detail, duration(c.ms), duration(c.waitMs), c.agents.map(a => a.type).join(), c.isCurrent])).toEqual([
    ['pilot', 'choisit la voie', '30 s', '0 s', '', false],
    ['blueprint', '', '5 min 30', '2 min', 'reviewer', false],
    ['build', 'Étape 1 · tests', '1 min 12', '0 s', 'runner', true],
  ])
})

test('a running turn shows its steps, on every surface', async ($, on) => {
  engine(on, JSON.stringify({ runs: PILOT }), Date.parse(at(55, 10)))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface })
    expect([surface, String(/blueprint/), await said(pane, /blueprint/)]).toEqual([surface, String(/blueprint/), true])
    expect([surface, String(/Étape 1 · tests/), await said(pane, /Étape 1 · tests/)]).toEqual([surface, String(/Étape 1 · tests/), true])
    await pane.unmount()
  }
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await said(desk, /En cours · 7 min 12/)).toBe(true)
  expect(await said(desk, /En direct/)).toBe(true)
  await desk.unmount()
})

test('the band shows the current flow, each lane once in a row, and where it stands', async ($, on) => {
  engine(on, JSON.stringify({ runs: PILOT }), Date.parse(at(55, 10)))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({
    plugin: 'selo-feed',
    component: 'AbovePrompt',
    surface: 'desktop',
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  } as const)
  const source = ((await band.find({ type: 'Svg' })) as { props: { source: string } }).props.source
  expect(/>pilot<.*> › <.*>blueprint<.*> › <.*>build</.test(source)).toBe(true)
  expect(source.includes('Étape 1 · tests · 1 min 12')).toBe(true)
  await band.unmount()
})
