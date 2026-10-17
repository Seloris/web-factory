import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { activeStep, afterCommit, committed, describeRun, isRunOfPlan, isStepDone, nextAction, parseFactoryCommand, parsePlan, parseSpec, runLastStep, runStep, sessionRequest, stamp, withPlan } from '../hooks/planning'
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

/** An older plan of the same spec, finished: every stage and every validation item ticked. */
const OLD_PLAN_FOLDER = '.planning/features/demo/dev-plans/20261001-090000-init-demo'
const OLD_PLAN = `# Demo init

## Progress

### Stage 1 — api
Commit: \`feat(demo): api — init\`
- [x] Domain: init

## Validation

- [x] Review: done
`

const TAGS_SPEC = `# Tags — PRD

> **Status**: Approved
`

const FILES: Record<string, string> = {
  [`${ROOT}/.planning/features/demo/00_spec.md`]: SPEC,
  [`${ROOT}/${PLAN_FOLDER}/plan.md`]: PLAN,
  [`${ROOT}/${OLD_PLAN_FOLDER}/plan.md`]: OLD_PLAN,
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

const BAND = {
  plugin: 'factory-board',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 90,
    scroll: { offset: 0, bodyRows: 9 },
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

test('parsePlan counts a declined validation item as settled', () => {
  const plan = parsePlan('## Validation\n\n- [x] Review: done\n- [-] Browser test: not run (declined)\n- [ ] Tests: suite green\n')
  expect(plan.validationDone).toBe(2)
  expect(plan.validationTotal).toBe(3)
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
    hasSpec: true,
    specStatus: null,
    plans: p ? [p] : [],
    plan: p,
    state,
  })
  expect(nextAction(feature('spec', null as never))?.prompt).toBe('/factory:write-plan demo')
  expect(nextAction(feature('running'))).toEqual({ label: 'Stage 2 — web', prompt: `/factory:implement ${PLAN_FOLDER} — stage 2 (web)` })
  const untouched = { ...plan, stages: plan.stages.map(s => ({ ...s, done: 0 })) }
  expect(nextAction(feature('plan', untouched))).toEqual({
    label: 'Stage 1 — api',
    prompt: `/factory:implement ${PLAN_FOLDER} — stage 1 (api)`,
    all: { label: "Tout d'un coup (stages 1–2)", prompt: `/factory:implement ${PLAN_FOLDER} — stages 1-2 (api, web), chained` },
  })
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
        hasSpec: true,
        specStatus: null,
        state: 'running',
        plans: [{ ...plan, stages: plan.stages.map((s, i) => (i === 0 ? { ...s, sha } : s)) }],
        plan: null,
      },
    ],
  })
  expect(committed(board(null), board('b71e04'))).toEqual(['demo · stage 1 committé (b71e04)'])
  expect(committed(board('b71e04'), board('b71e04'))).toEqual([])
  expect(committed(null, board(null))).toEqual([])
})

test('the pane counts the features, lists them, unfolds the stages and prepares the prompt', async ($, on) => {
  mockProject(on)
  const filled: string[] = []
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /feat\/demo/ }))?.text).toContain('repo · feat/demo')
    expect((await ui.find({ key: 'tile:features' }))?.text).toContain('2')
    expect((await ui.find({ key: 'tile:no-plan' }))?.text).toContain('1')
    expect((await ui.find({ key: 'tile:stages-left' }))?.text).toContain('1')
    expect(await ui.find({ key: 'row:demo', text: /demo/ })).toBeDefined()
    expect(await ui.find({ key: 'row:tags', text: /tags/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /● en cours/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /● spec seule/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /spec validée/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /█{4}░{4} 1\/2/ })).toBeDefined()
    expect((await ui.find({ key: 'prepare:demo' }))?.text).toBe('Stage 2 — web')
    expect(await ui.find({ key: 'step:demo:stage:1' })).toBeUndefined()

    await ui.press({ key: 'row:demo' })
    expect((await ui.find({ key: 'step:demo:spec' }))?.text).toContain('brouillon')
    expect((await ui.find({ key: 'step:demo:plan' }))?.text).toContain('commité')
    expect((await ui.find({ key: 'step:demo:stage:1' }))?.text).toContain('b71e04')
    expect((await ui.find({ key: 'step:demo:stage:2' }))?.text).toContain('1/3')
    expect((await ui.find({ key: 'step:demo:review' }))?.text).toContain('0/2')
    expect(await ui.find({ key: 'step:demo:close' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: new RegExp(`/factory:implement ${PLAN_FOLDER}`) })).toBeDefined()
    expect(await ui.find({ key: 'copy:demo' })).toBeDefined()
    expect(await ui.find({ key: 'review:demo' })).toBeDefined()

    await ui.press({ key: 'prepare:demo' })
    expect(filled.at(-1)).toBe(`/factory:implement ${PLAN_FOLDER} — stage 2 (web)`)

    expect((await ui.find({ type: 'Text', text: /^Plans \(2\)$/ }))?.text).toBe('Plans (2)')
    await ui.press({ key: 'new-plan:demo' })
    expect(filled.at(-1)).toBe('/factory:write-plan demo')
    await ui.select({ key: 'plan:demo', value: OLD_PLAN_FOLDER })
    expect((await ui.find({ key: 'prepare:demo' }))?.text).toBe('Fermer la branche')
    expect((await ui.find({ key: 'step:demo:stage:1' }))?.text).toContain('non committé')
    expect(await ui.find({ key: 'step:demo:stage:2' })).toBeUndefined()
    expect((await ui.find({ key: 'step:demo:spec' }))?.text).toContain('brouillon')
    await ui.select({ key: 'plan:demo', value: PLAN_FOLDER })

    await ui.press({ key: 'session:demo' })
    expect(submitted.at(-1)).toBe(sessionRequest(`/factory:implement ${PLAN_FOLDER} — stage 2 (web)`))
    expect(submitted.at(-1)).toContain('start_session')

    await ui.press({ key: 'row:demo' })
    expect(await ui.find({ key: 'step:demo:stage:1' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a /factory: prompt records the run, the turn end marks it waiting, a commit marks it done, the session end keeps it', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  await $.prompt.submit({ text: `/factory:implement ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
  const started = store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>
  expect(started).toMatchObject({ feature: 'demo', folder: PLAN_FOLDER, command: 'implement', step: 'stage:2', status: 'running', root: ROOT })

  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  const ended = store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>
  expect(ended.status).toBe('waiting')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'live:session-aaaa-1111:1000000', text: /Stage 2 — web · demo/ })).toBeDefined()
  expect((await ui.find({ key: 'card:session-aaaa-1111:1000000' }))?.text).toMatch(/attend une réponse.*cette session · Implémentation/)
  await ui.press({ key: 'live:session-aaaa-1111:1000000' })
  expect(await ui.find({ key: 'run:session-aaaa-1111:1000000', text: /Implémentation.*attend une réponse/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /feat\/demo/ }))?.text).toContain('1 en attente')

  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(demo): spec"' } as never)
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('done')
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer' })
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('done')
  expect(await ui.find({ key: 'live:session-aaaa-1111:1000000' })).toBeUndefined()
  expect(await ui.find({ key: 'run:session-aaaa-1111:1000000', text: /✓.*Implémentation/ })).toBeDefined()
  await ui.unmount()

  await $.session.end({ sessionId: 'session-aaaa-1111', reason: 'other', resume: { sessionId: 'session-aaaa-1111' } as never })
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('done')
})

test('a session that ends while its run waits leaves it interrupted in the history', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: '/factory:write-plan tags', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.session.end({ sessionId: 'session-aaaa-1111', reason: 'other', resume: { sessionId: 'session-aaaa-1111' } as never })
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'tags', step: 'plan', status: 'interrupted' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'row:tags' })
  expect(await ui.find({ key: 'step:tags:plan', text: /Plan.*interrompue/ })).toBeDefined()
  expect((await ui.find({ key: 'prepare:tags' }))?.text).toBe('Écrire le plan')
  await ui.unmount()
})

test('a plain prompt records nothing', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'explique-moi ce fichier', wait: false, origin: { kind: 'composer' } })
  expect([...store.keys()]).toEqual([])
})

test('the timeline steps follow the feature: active step, done steps, the step a prompt lands on', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const demo: FactoryBoardFeature = { slug: 'demo', title: 'Demo', hasSpec: true, specStatus: 'Draft', plans: [plan], plan, state: 'running' }
  const empty: FactoryBoardFeature = { slug: 'new', title: 'new', hasSpec: false, specStatus: null, plans: [], plan: null, state: 'empty' }
  expect(activeStep(demo)).toBe('stage:2')
  expect(activeStep(empty)).toBe('spec')
  expect(activeStep({ ...demo, plan: { ...plan, isDraft: true } })).toBe('plan')
  expect(['spec', 'plan', 'stage:1', 'stage:2', 'review', 'close'].map(s => isStepDone(demo, s))).toEqual([true, true, true, false, false, false])
  expect(isStepDone(empty, 'spec')).toBe(false)
  const command = (text: string) => parseFactoryCommand(text)!
  expect(runStep(command(`/factory:implement ${PLAN_FOLDER}`), demo)).toBe('stage:2')
  expect(runStep(command(`/factory:implement ${PLAN_FOLDER} — final review`), demo)).toBe('review')
  expect(runStep(command(`/factory:implement ${PLAN_FOLDER} — close the branch`), demo)).toBe('close')
  expect(runStep(command(`/factory:review plan ${PLAN_FOLDER}`), demo)).toBe('plan')
  expect(runStep(command(`/factory:implement ${PLAN_FOLDER} — stage 1 (api)`), demo)).toBe('stage:1')
  const chained = command(`/factory:implement ${PLAN_FOLDER} — stages 1-2 (api, web), chained`)
  expect(runStep(chained, demo)).toBe('stage:1')
  expect(runLastStep(chained)).toBe('stage:2')
  expect(runLastStep(command(`/factory:implement ${PLAN_FOLDER} — stage 2 (web)`))).toBeNull()
  const run = { sessionId: 's', root: ROOT, feature: 'demo', folder: PLAN_FOLDER, command: 'implement', status: 'running' as const, since: 0, updatedAt: 0 }
  expect(afterCommit({ ...run, step: 'stage:1', lastStep: 'stage:2' }, demo)).toEqual({ step: 'stage:2', status: 'running' })
  expect(afterCommit({ ...run, step: 'stage:2', lastStep: 'stage:2' }, demo)).toEqual({ step: 'stage:2', status: 'done' })
  expect(afterCommit({ ...run, step: 'stage:2', lastStep: null }, demo)).toEqual({ step: 'stage:2', status: 'done' })
  expect(runStep(command('/factory:write-spec new'), undefined)).toBe('spec')
  expect(stamp(Date.now())).toMatch(/^\d\d\/\d\d \d\d:\d\d$/)
})

test('withPlan follows a feature on one of its plans, and its runs with it', () => {
  const parse = (text: string, folder: string) => {
    const parsed = parsePlan(text)
    return { ...parsed, title: parsed.title ?? 'Demo', folder, isDraft: false }
  }
  const latest = parse(PLAN, PLAN_FOLDER)
  const old = parse(OLD_PLAN, OLD_PLAN_FOLDER)
  const demo: FactoryBoardFeature = { slug: 'demo', title: 'Demo', hasSpec: true, specStatus: null, plans: [latest, old], plan: latest, state: 'running' }
  expect(withPlan(demo, undefined)).toBe(demo)
  expect(withPlan(demo, '.planning/features/demo/dev-plans/gone')).toBe(demo)
  const onOld = withPlan(demo, OLD_PLAN_FOLDER)
  expect(onOld.plan?.folder).toBe(OLD_PLAN_FOLDER)
  expect(onOld.state).toBe('done')

  const run = (step: string, folder: string | null) => ({ sessionId: 's', root: ROOT, feature: 'demo', folder, command: 'implement', step, status: 'done' as const, since: 0, updatedAt: 0 })
  expect(isRunOfPlan(run('spec', null), onOld)).toBe(true)
  expect(isRunOfPlan(run('stage:1', OLD_PLAN_FOLDER), onOld)).toBe(true)
  expect(isRunOfPlan(run('stage:1', PLAN_FOLDER), onOld)).toBe(false)
  expect(isRunOfPlan(run('plan', null), onOld)).toBe(false)
  expect(isRunOfPlan(run('plan', null), demo)).toBe(true)
})

test('describeRun names the skill, the feature and the stage at hand', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const feature: FactoryBoardFeature = { slug: 'demo', title: 'Demo', hasSpec: true, specStatus: null, plans: [plan], plan, state: 'running' }
  const run = (command: string, step = 'stage:2') => ({
    sessionId: 's',
    root: ROOT,
    feature: 'demo',
    folder: null,
    command,
    step,
    status: 'running' as const,
    since: 0,
    updatedAt: 0,
  })
  expect(describeRun(run('implement'), feature)).toBe('Stage 2 — web · demo')
  expect(describeRun(run('write-plan'), feature)).toBe('Plan · demo')
  expect(describeRun(run('write-spec'), undefined)).toBe('Spec · demo')
  expect(describeRun(run('implement', 'close'), feature)).toBe('Clôture de la branche · demo')
  expect(describeRun(run('implement', 'review'), feature)).toBe('Revue finale · demo')
  expect(describeRun(run('review', 'plan'), feature)).toBe('Revue du plan · demo')
  // Stage 1 fully ticked, its commit not made yet: its session still finishes stage 1, not the plan's next stage.
  expect(describeRun(run('implement', 'stage:1'), feature)).toBe('Stage 1 — api · demo')
})

test('the band shows this session’s step and toggles the pane', async ($, on) => {
  mockProject(on)
  const closed: string[] = []
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /aucune étape factory/ })).toBeDefined()
  expect((await ui.find({ key: 'toggle-pane' }))?.text).toBe('Fermer le tableau')

  await ui.press({ key: 'toggle-pane' })
  expect(closed).toEqual(['factory-board'])
  expect((await ui.find({ key: 'toggle-pane' }))?.text).toBe('Ouvrir le tableau')

  await $.prompt.submit({ text: `/factory:implement ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
  expect(await ui.find({ type: 'Text', text: /Stage 2 — web · demo/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /● en cours/ })).toBeDefined()
  await ui.unmount()
})
