import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { committed, nextAction, parseFactoryCommand, parsePlan, parseSpec } from '../hooks/planning'
import type { FactoryBoard, FactoryBoardFeature } from '../types'

const ROOT = '/repo'
const PLAN_FOLDER = '.planning/features/demo/dev-plans/20261016-120000-add-counter'

const SPEC = `# Demo counter (Compteur de démo) — PRD

> **Slug**: \`demo\`
> **Status**: Draft

## TL;DR
`

const PLAN = `# Demo counter

Feature: \`demo\` · Components: \`api\`, \`web\`

## Context

## Progress

### Stage 1 — api
Commit: \`feat(demo): api — counter endpoint\`
- [x] Domain: counter entity
- [x] Api: GET and POST /counter

### Stage 2 — web
Commit: \`feat(demo): web — counter page\`
- [x] Prepare: client regenerated
- [ ] pages: counter page
- [ ] ui: increment button

## Validation

- [ ] Review: the \`reviewer\` agent on the plan's implementation
- [ ] Browser test: the change tested in \`web\`
`

const TAGS_SPEC = `# Tags — PRD

> **Status**: Approved
`

const FILES: Record<string, string> = {
  [`${ROOT}/.planning/features/demo/00_spec.md`]: SPEC,
  [`${ROOT}/${PLAN_FOLDER}/plan.md`]: PLAN,
  [`${ROOT}/.planning/features/tags/00_spec.md`]: TAGS_SPEC,
}

const GIT_LOG = ['b71e04\tfeat(demo): api — counter endpoint', '9c0d1e\tchore: init', ''].join('\n')

/** The engine resolves a path against the host before the hooks see it: back to the test's spelling. */
const norm = (path: string): string => path.split('\\').join('/').replace(/^[A-Za-z]:/, '')

/** A project on disk, git included, answered from memory. Returns the store the mod writes to. */
function mockProject(on: On, options: { log?: string } = {}): Map<string, unknown> {
  const paths = Object.keys(FILES)
  const isDir = (path: string) => paths.some(p => p.startsWith(`${path}/`))
  on('session.root', () => ({ value: ROOT }))
  on('session.id', () => ({ value: 'session-aaaa-1111' }))
  on('fs.exists', ($, e) => {
    const path = norm(e.path)
    return { value: path in FILES || isDir(path) }
  })
  on('fs.read', ($, e) => {
    const text = FILES[norm(e.path)]
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.list', ($, e) => {
    const path = norm(e.path)
    const names = new Map<string, 'file' | 'dir'>()
    for (const p of paths) {
      if (!p.startsWith(`${path}/`)) continue
      const rest = p.slice(path.length + 1)
      const [head] = rest.split('/')
      if (head) names.set(head, rest.includes('/') ? 'dir' : 'file')
    }
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('process.run', ($, e) => {
    const argv = e.argv.join(' ')
    const ok = (stdout: string) => ({
      value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    if (argv.startsWith('git rev-parse')) return ok('feat/demo\n')
    if (argv.startsWith('git status')) return ok('')
    if (argv.startsWith('git log')) return ok(options.log ?? GIT_LOG)
    return ok('')
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  const store = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  mock.clock(on, { now: 1_000_000 })
  return store
}

const PANE = {
  plugin: 'factory-board',
  component: 'Pane',
  requestId: 'factory-board',
  props: {
    title: 'Factory',
    isFocused: false,
    bodyColumns: 90,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('parsePlan reads the stages, their commits and the validation', () => {
  const plan = parsePlan(PLAN)
  expect(plan.title).toBe('Demo counter')
  expect(plan.stages).toHaveLength(2)
  expect(plan.stages[0]).toEqual({
    number: 1,
    title: 'api',
    commit: 'feat(demo): api — counter endpoint',
    sha: null,
    done: 2,
    total: 2,
  })
  expect(plan.stages[1]?.done).toBe(1)
  expect(plan.stages[1]?.total).toBe(3)
  expect(plan.validationDone).toBe(0)
  expect(plan.validationTotal).toBe(2)
})

test('parseSpec reads the title without the PRD suffix and the status', () => {
  expect(parseSpec(SPEC)).toEqual({ title: 'Demo counter (Compteur de démo)', status: 'Draft' })
})

test('parseFactoryCommand finds the feature and the plan folder', () => {
  expect(parseFactoryCommand(`/factory:implement ${PLAN_FOLDER}`)).toEqual({
    skill: 'implement',
    args: PLAN_FOLDER,
    feature: 'demo',
    folder: PLAN_FOLDER,
  })
  expect(parseFactoryCommand('/factory:write-plan tags')?.feature).toBe('tags')
  expect(parseFactoryCommand('/factory:review plan .planning\\features\\demo\\dev-plans\\x-add-y')?.folder).toBe(
    '.planning/features/demo/dev-plans/x-add-y',
  )
  expect(parseFactoryCommand('/factory:implement Add a cutoff time')?.feature).toBeNull()
  expect(parseFactoryCommand('fix the tests')).toBeNull()
})

test('nextAction follows the feature state', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const feature = (state: FactoryBoardFeature['state'], p = plan): FactoryBoardFeature => ({
    slug: 'demo',
    title: 'Demo',
    specStatus: null,
    plan: p,
    state,
  })
  expect(nextAction(feature('spec', null as never))?.prompt).toBe('/factory:write-plan demo')
  expect(nextAction(feature('running'))).toEqual({ label: 'Stage 2 — web', prompt: `/factory:implement ${PLAN_FOLDER}` })
  expect(nextAction(feature('running', { ...plan, isDraft: true }))?.prompt).toBe('/factory:write-plan demo')
  expect(nextAction(feature('review'))?.prompt).toBe(`/factory:implement ${PLAN_FOLDER} — final review`)
  expect(nextAction(feature('done'))?.prompt).toBe(`/factory:implement ${PLAN_FOLDER} — close the branch`)
})

test('committed names a stage whose commit reached the branch', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const board = (sha: string | null): FactoryBoard => ({
    root: ROOT,
    branch: 'feat/demo',
    runs: [],
    scannedAt: 0,
    error: null,
    features: [
      {
        slug: 'demo',
        title: 'Demo',
        specStatus: null,
        state: 'running',
        plan: { ...plan, stages: plan.stages.map((s, i) => (i === 0 ? { ...s, sha } : s)) },
      },
    ],
  })
  expect(committed(board(null), board('b71e04'))).toEqual(['demo · stage 1 committé (b71e04)'])
  expect(committed(board('b71e04'), board('b71e04'))).toEqual([])
  expect(committed(null, board(null))).toEqual([])
})

test('the pane lists the features, unfolds the stages and prepares the prompt', async ($, on) => {
  mockProject(on)
  const filled: string[] = []
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /feat\/demo/ }))?.text).toContain('2 feature(s)')
    expect(await ui.find({ key: 'row:demo', text: /en cours/ })).toBeDefined()
    expect(await ui.find({ key: 'row:tags', text: /spec seule/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1\/2 stages · validation 0\/2/ })).toBeDefined()

    await ui.press({ key: 'row:demo' })
    expect((await ui.find({ key: 'stage:demo:1' }))?.text).toContain('b71e04')
    expect((await ui.find({ key: 'stage:demo:2' }))?.text).toContain('1/3')
    expect((await ui.find({ key: 'prepare:demo' }))?.text).toBe('Stage 2 — web')

    await ui.press({ key: 'prepare:demo' })
    expect(filled.at(-1)).toBe(`/factory:implement ${PLAN_FOLDER}`)

    await ui.press({ key: 'row:demo' })
    expect(await ui.find({ key: 'stage:demo:1' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a /factory: prompt records the run, the turn end marks it waiting, the session end drops it', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  await $.prompt.submit({ text: `/factory:implement ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
  const started = store.get('run:session-aaaa-1111') as Record<string, unknown>
  expect(started).toMatchObject({ feature: 'demo', folder: PLAN_FOLDER, command: 'implement', status: 'running', root: ROOT })

  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  const ended = store.get('run:session-aaaa-1111') as Record<string, unknown>
  expect(ended.status).toBe('waiting')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'run:session-aaaa-1111', text: /attend une réponse/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /feat\/demo/ }))?.text).toContain('1 en attente')
  await ui.unmount()

  await $.session.end({ sessionId: 'session-aaaa-1111', reason: 'other', resume: { sessionId: 'session-aaaa-1111' } as never })
  expect(store.has('run:session-aaaa-1111')).toBe(false)
})

test('a plain prompt records nothing', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'explique-moi ce fichier', wait: false, origin: { kind: 'composer' } })
  expect([...store.keys()]).toEqual([])
})
