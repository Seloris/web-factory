import { expect, test } from 'claude-code/testing'

import { projectOf } from '../hooks/helper'
import { withAutonomous } from '../hooks/register'

const SESSION = JSON.stringify({
  rootKey: 'C--p',
  usage: { tokens: { input: 1000, cacheRead: 1200000, cacheWrite: 300000, output: 500 } },
  runs: [
    {
      id: 's:1', agentId: null, since: '2026-10-27T10:02:00Z', request: 'Add a filter', phase: 'job-done', status: 'A filter',
      recap: { text: 'A filter' }, commits: [{ sha: 'abc1234', subject: 'feat(home): a filter' }],
      next: [{ text: 'Construire les 2 étapes', prompt: '/selo-flow:pilot .planning/blueprints/x.md' }],
    },
  ],
})
const PROJECT = JSON.stringify({
  selo: true,
  manifest: { name: 'todo' },
  blueprints: [
    { name: 'due', file: '.planning/blueprints/due.md', title: 'Due dates', state: 'ready', components: ['api', 'web'], mockup: null, next: { label: 'Build', prompt: '/selo-flow:build .planning/blueprints/due.md', pilot: '/selo-flow:pilot .planning/blueprints/due.md --autonomous' } },
    { name: 'old', file: '.planning/blueprints/old.md', title: 'Old one', state: 'done', components: [], next: null },
  ],
  mockups: [{ file: '.planning/mockups/m.html', title: 'Filtres', validated: true, committed: false }],
})

const PLUGINS = JSON.stringify({ version: 2, plugins: { 'selo-flow@selo': [{ scope: 'user', version: '2.15.0' }, { scope: 'project', projectPath: '/p', version: '2.16.0' }], 'selo-feed@selo': [{ scope: 'user', version: '2.13.0' }] } })

const engine = (on: Parameters<Parameters<typeof test>[1]>[1], fills: string[]) => {
  on('command.register', () => ({ value: { command: 'recap' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's' }))
  on('env.get', (_, e) => ({ value: e.name === 'USERPROFILE' ? '/home/me' : undefined }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_, e) => ({ value: e.path.includes('installed_plugins') ? PLUGINS : e.path.includes('projects') ? PROJECT : SESSION }))
  on('clock.now', () => ({ value: Date.parse('2026-10-27T10:10:00Z') }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 455400, window: 1000000, percent: 46 }, rateLimits: [] } }))
  on('session.cwd', () => ({ value: '/p' }))
  // git, as the session's diff asks it: the base, the files by status, the untracked ones, the line counts.
  on('process.run', (_, e) => {
    const args = e.argv.slice(1).join(' ')
    const stdout = args.startsWith('rev-parse') ? 'base000\n'
      : args.startsWith('diff --name-status') ? 'M\tb.ts\nM\tc.ts\nD\td.ts\n'
      : args.startsWith('ls-files') ? 'a.ts\n'
      : args.startsWith('diff --shortstat') ? ' 4 files changed, 12 insertions(+), 3 deletions(-)\n'
      : ''
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
  on('prompt.fill', (_, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  on('ui.toast', () => ({ value: undefined }))
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
  props: { title: 'Selo', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the band: a data line, then the buttons; each fills the prompt box', async ($, on) => {
  const fills: string[] = []
  engine(on, fills)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    if (surface === 'desktop') {
      const source = ((await band.find({ type: 'Svg' })) as { props: { source: string } }).props.source
      for (const re of [/>\+1</, />~2</, />−1</, /\+12 −3 lignes/, />1,5 M</, /1 prompt/, />46 %</, /455 k \/ 1,0 M/]) expect([String(re), re.test(source)]).toEqual([String(re), true])
    } else {
      for (const re of [/^\+1$/, /^~2$/, /^-1$/, /\+12 −3 lignes · 1 commit · 1,5 M tokens/]) expect(await band.find({ type: 'Text', text: re })).toBeDefined()
    }
    expect(await band.find({ key: 'next' })).toBeDefined()
    await band.unmount()
  }
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'autopilot' })
  await band.press({ key: 'mockup' })
  await band.press({ key: 'opt-autonomous' })
  await band.press({ key: 'autopilot' })
  await band.press({ key: 'next' })
  await band.press({ key: 'fastlane' })
  expect(fills).toEqual(['/selo-flow:pilot ', '/selo-flow:mockup ', '/selo-flow:pilot --autonomous ', '/selo-flow:pilot .planning/blueprints/x.md --autonomous', '/selo-flow:fastlane --autonomous '])
  await band.unmount()
})

test('the Plans tab: blueprints and mockups together, each copies its flag', async ($, on) => {
  const fills: string[] = []
  const copies: string[] = []
  engine(on, fills)
  on('ui.copy', (_, e) => {
    copies.push(e.text)
    return { value: { isCopied: true } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await pane.find({ key: 'tab-launch' })).toBeUndefined()
  await pane.press({ key: 'tab-plans' })
  expect(await pane.find({ type: 'Text', text: /Due dates/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^Filtres$/ })).toBeDefined()
  await pane.press({ key: 'bp-next-due' })
  await pane.press({ key: 'mk-build-.planning/mockups/m.html' })
  await pane.press({ key: 'bp-copy-due' })
  await pane.press({ key: 'mk-copy-.planning/mockups/m.html' })
  expect(fills).toEqual(['/selo-flow:build .planning/blueprints/due.md', '/selo-flow:pilot Filtres --mockup .planning/mockups/m.html'])
  expect(copies).toEqual(['--blueprint .planning/blueprints/due.md', '--mockup .planning/mockups/m.html'])
  await pane.unmount()
})

test('commands: the toggles land where the skills take them', () => {
  expect(withAutonomous('/selo-flow:build x.md', true)).toBe('/selo-flow:build x.md --autonomous')
  expect(withAutonomous('/selo-flow:review x.md', true)).toBe('/selo-flow:review x.md')
  expect(projectOf({ selo: false }).isSelo).toBe(false)
})

test('the header names the selo plugins: the project selo-flow, else the user one, and selo-feed', async ($, on) => {
  engine(on, [])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'tab-session' })
  const source = ((await pane.find({ type: 'Svg' })) as { props: { source: string } }).props.source
  expect(source.includes('selo-flow 2.16.0 · selo-feed 2.13.0')).toBe(true)
  await pane.unmount()
})
