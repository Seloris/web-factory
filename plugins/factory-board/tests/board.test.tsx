import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { activeStep, afterCommit, classifyTurn, commitFeature, committed, describeRun, exportPath, featureState, isRunOfPlan, isStepDone, newPlans, nextAction, onNewPlan, parseFactoryCommand, parsePlan, parseSpec, projectActivity, readModels, runLastStep, runPlan, runStep, runTitle, setModels, stamp, tickReview, withPlan } from '../hooks/planning'
import type { FactoryBoard, FactoryBoardExport, FactoryBoardFeature, FactoryBoardRun } from '../types'

const ROOT = '/repo'
/** The repository's git common dir, the same from every worktree. */
const REPO = '/repo/.git'
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

const NEW_PLAN_FOLDER = '.planning/features/demo/dev-plans/20261017-100000-rework-counter'

const TAGS_SPEC = `# Tags — PRD

> **Status**: Approved
`

const BASE_FILES: Record<string, string> = {
  [`${ROOT}/.planning/features/demo/00_spec.md`]: SPEC,
  [`${ROOT}/${PLAN_FOLDER}/plan.md`]: PLAN,
  [`${ROOT}/${OLD_PLAN_FOLDER}/plan.md`]: OLD_PLAN,
  [`${ROOT}/.planning/features/tags/00_spec.md`]: TAGS_SPEC,
  [`${ROOT}/factory.yaml`]: 'project: demo\nbase_branch: "develop"  # the base\n',
}

const GIT_LOG = ['b71e04\tfeat(demo): api — counter endpoint', '9c0d1e\tchore: init', ''].join('\n')

/** The engine resolves a path against the host before the hooks see it: back to the test's spelling. */
const norm = (path: string): string => path.split('\\').join('/').replace(/^[A-Za-z]:/, '')

/** A project on disk, git included, answered from memory. Returns the store the mod writes to, its mocked clock on it. */
function mockProject(on: On, options: { log?: string; range?: string; files?: Record<string, string> } = {}): Map<string, unknown> & { clock: ReturnType<typeof mock.clock> } {
  const files = options.files ?? BASE_FILES
  const isDir = (path: string) => Object.keys(files).some(p => p.startsWith(`${path}/`))
  on('session.root', () => ({ value: ROOT }))
  on('session.id', () => ({ value: 'session-aaaa-1111' }))
  on('fs.exists', ($, e) => {
    const path = norm(e.path)
    return { value: path in files || isDir(path) }
  })
  on('fs.read', ($, e) => {
    // The mod's own manifest, wherever the plugin sits on this machine.
    if (norm(e.path).endsWith('/.claude-plugin/plugin.json')) return { value: '{ "name": "factory-board", "version": "9.9.9" }' }
    const text = files[norm(e.path)]
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.list', ($, e) => {
    const path = norm(e.path)
    const names = new Map<string, 'file' | 'dir'>()
    for (const p of Object.keys(files)) {
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
    if (argv.startsWith('git rev-parse --git-common-dir')) return ok('.git\n')
    if (argv.startsWith('git rev-parse')) return ok('feat/demo\n')
    if (argv === 'git log --format=%s develop..HEAD') return ok(options.range ?? 'feat(demo): api — counter endpoint\ndocs(demo): plan\ndocs(demo): spec\n')
    if (argv.startsWith('git status')) return ok(' M api/src/app.ts\n?? notes.md\n')
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
  const clock = mock.clock(on, { now: 1_000_000 })
  return Object.assign(store, { clock })
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
  expect(plan.reviewDone).toBe(false)
})

test('parsePlan counts a declined validation item as settled', () => {
  const plan = parsePlan('## Validation\n\n- [x] Review: done\n- [-] Browser test: not run (declined)\n- [ ] Tests: suite green\n')
  expect(plan.validationDone).toBe(2)
  expect(plan.validationTotal).toBe(3)
  expect(plan.reviewDone).toBe(true)
})

test('a plan is finalized once its stages and its Review are ticked, whatever the optional items', () => {
  const finished = (validation: string) => {
    const parsed = parsePlan(`## Progress\n\n### Stage 1 — api\n- [x] Domain: done\n\n## Validation\n\n${validation}`)
    return { ...parsed, title: 'Demo', folder: PLAN_FOLDER, isDraft: false }
  }
  expect(featureState(true, finished('- [x] Review: done\n- [ ] Browser test: not run\n- [-] Tests: declined\n'))).toBe('done')
  expect(featureState(true, finished('- [ ] Review: pending\n- [x] Tests: green\n'))).toBe('review')
  expect(featureState(true, finished('- [x] Tests: green\n'))).toBe('review')
  expect(featureState(true, finished('- [-] Review: declined\n'))).toBe('review')
  expect(featureState(true, finished('- [x] Revue : faite\n'))).toBe('done')
  const board = (validation: string): FactoryBoard => {
    const plan = finished(validation)
    const feature: FactoryBoardFeature = { slug: 'demo', title: 'Demo', hasSpec: true, specStatus: null, plans: [plan], plan, state: featureState(true, plan) }
    return { root: ROOT, branch: 'feat/demo', baseBranch: 'main', aheadCount: 2, changedCount: 0, features: [feature], runs: [], scannedAt: 0, error: null }
  }
  expect(committed(board('- [ ] Review: pending\n'), board('- [x] Review: done\n- [ ] Browser test: not run\n'))).toEqual(['demo · plan finalisé'])
  expect(committed(board('- [x] Review: done\n'), board('- [x] Review: done\n'))).toEqual([])
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
  // A bare slug stands alone or before an option; a free request names no feature yet.
  expect(parseFactoryCommand('/factory:autopilot demo — until plan')?.feature).toBe('demo')
  expect(parseFactoryCommand(`/factory:autopilot ${PLAN_FOLDER} — with browser test`)?.folder).toBe(PLAN_FOLDER)
  expect(parseFactoryCommand('/factory:write-spec add tags to the todos — autonomous')?.feature).toBeNull()
  expect(parseFactoryCommand('/factory:autopilot add tags to the todos')?.feature).toBeNull()
  expect(commitFeature('git commit -m "docs(tags): spec — tags on todos"')).toBe('tags')
  expect(commitFeature('git commit -m "chore: notes"')).toBeNull()
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
  const autopilot = { label: '⚡ Autopilot', prompt: `/factory:autopilot ${PLAN_FOLDER}` }
  expect(nextAction(feature('spec', null as never))).toEqual({ label: 'Écrire le plan', prompt: '/factory:write-plan demo', autopilot: { label: '⚡ Autopilot', prompt: '/factory:autopilot demo' } })
  expect(nextAction(feature('running'))).toEqual({ label: 'Stage 2 — web', prompt: `/factory:implement ${PLAN_FOLDER} — stage 2 (web)`, autopilot })
  const untouched = { ...plan, stages: plan.stages.map(s => ({ ...s, done: 0 })) }
  expect(nextAction(feature('plan', untouched))).toEqual({
    label: 'Stage 1 — api',
    prompt: `/factory:implement ${PLAN_FOLDER} — stage 1 (api)`,
    all: { label: "Tout d'un coup (stages 1–2)", prompt: `/factory:implement ${PLAN_FOLDER} — stages 1-2 (api, web), chained` },
    autopilot,
  })
  expect(nextAction(feature('running', { ...plan, isDraft: true }))?.prompt).toBe('/factory:write-plan demo')
  expect(nextAction(feature('review'))?.prompt).toBe(`/factory:implement ${PLAN_FOLDER} — final review`)
  // The browser test is the autopilot's option only; a feature without a spec has no autopilot.
  expect(nextAction(feature('review'), { browser: true })?.autopilot?.prompt).toBe(`/factory:autopilot ${PLAN_FOLDER} — with browser test`)
  expect(nextAction({ ...feature('empty', null as never), hasSpec: false })?.autopilot).toBeUndefined()
  expect(nextAction(feature('done'))).toBeNull()
})

test('the review checkbox adds its marker to the stage prompts only', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const untouched = { ...plan, stages: plan.stages.map(s => ({ ...s, done: 0 })) }
  const demo: FactoryBoardFeature = { slug: 'demo', title: 'Demo', hasSpec: true, specStatus: null, plans: [untouched], plan: untouched, state: 'plan' }
  const reviewed = nextAction(demo, { review: true })
  expect(reviewed).toEqual({
    label: 'Stage 1 — api',
    prompt: `/factory:implement ${PLAN_FOLDER} — stage 1 (api) — with review`,
    all: { label: "Tout d'un coup (stages 1–2)", prompt: `/factory:implement ${PLAN_FOLDER} — stages 1-2 (api, web), chained — with review` },
    autopilot: { label: '⚡ Autopilot', prompt: `/factory:autopilot ${PLAN_FOLDER}` },
  })
  expect(runStep(parseFactoryCommand(reviewed!.prompt)!, demo)).toBe('stage:1')
  expect(runLastStep(parseFactoryCommand(reviewed!.all!.prompt)!)).toBe('stage:2')
  const finalReview = { ...plan, stages: plan.stages.map(s => ({ ...s, done: s.total })), validationDone: 0 }
  const review: FactoryBoardFeature = { ...demo, plans: [finalReview], plan: finalReview, state: 'review' }
  expect(nextAction(review, { review: true })?.prompt).toBe(`/factory:implement ${PLAN_FOLDER} — final review`)
  expect(nextAction(demo)?.prompt).toBe(`/factory:implement ${PLAN_FOLDER} — stage 1 (api)`)
})

test('committed names a stage whose commit reached the branch', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const board = (sha: string | null): FactoryBoard => ({
    root: ROOT,
    repo: REPO,
    branch: 'feat/demo', baseBranch: 'main', aheadCount: 2, changedCount: 0,
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
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^ v9\.9\.9  repo$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^feat\/demo$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\+3 commit\(s\) depuis develop/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 fichier\(s\) non commité\(s\)/ })).toBeDefined()
    // The branch's commits name `demo`, whose latest plan is not finalized: no squash yet.
    expect(await ui.find({ key: 'squash' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /squash une fois le plan finalisé/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ v9\.9\.9/ })).toBeDefined()
    expect((await ui.find({ key: 'filter:all' }))?.text).toContain('2 features')
    expect((await ui.find({ key: 'filter:no-plan' }))?.text).toContain('1 sans plan')
    expect((await ui.find({ key: 'stages-left' }))?.text).toContain('1 stage')
    expect(await ui.find({ key: 'row:demo', text: /demo/ })).toBeDefined()
    expect(await ui.find({ key: 'row:tags', text: /tags/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ en cours $/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ spec seule $/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /spec validée/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^1\/2$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Spec$/ })).toBeUndefined()
    // The filter chips add up: each press adds its features, a second press takes them away, `features` clears them all.
    await ui.press({ key: 'filter:no-plan' })
    expect(await ui.find({ key: 'row:demo' })).toBeUndefined()
    expect(await ui.find({ key: 'row:tags' })).toBeDefined()
    await ui.press({ key: 'filter:running' })
    expect(await ui.find({ key: 'row:demo' })).toBeDefined()
    expect(await ui.find({ key: 'row:tags' })).toBeDefined()
    await ui.press({ key: 'filter:no-plan' })
    expect(await ui.find({ key: 'row:demo' })).toBeDefined()
    expect(await ui.find({ key: 'row:tags' })).toBeUndefined()
    await ui.press({ key: 'filter:all' })
    expect(await ui.find({ key: 'row:demo' })).toBeDefined()
    expect(await ui.find({ key: 'row:tags' })).toBeDefined()
    expect((await ui.find({ key: 'prepare:demo' }))?.text).toBe('Stage 2 — web')
    expect(await ui.find({ key: 'step:demo:stage:1' })).toBeUndefined()

    await ui.press({ key: 'row:demo' })
    expect((await ui.find({ key: 'step:demo:spec' }))?.text).toContain('brouillon')
    expect((await ui.find({ key: 'step:demo:plan' }))?.text).toContain('commité')
    expect((await ui.find({ key: 'step:demo:stage:1' }))?.text).toContain('b71e04')
    expect((await ui.find({ key: 'step:demo:stage:2' }))?.text).toContain('1/3')
    expect((await ui.find({ key: 'step:demo:review' }))?.text).toContain('0/2')
    expect(await ui.find({ key: 'step:demo:close' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: new RegExp(`/factory:implement ${PLAN_FOLDER}`) })).toBeDefined()
    expect(await ui.find({ key: 'copy:demo' })).toBeDefined()
    expect(await ui.find({ key: 'review:demo' })).toBeDefined()
    expect(await ui.find({ key: 'session:demo' })).toBeUndefined()
    expect(await ui.find({ key: 'mark-review:demo' })).toBeUndefined()

    await ui.press({ key: 'prepare:demo' })
    expect(filled.at(-1)).toBe(`/factory:implement ${PLAN_FOLDER} — stage 2 (web)`)
    // The autopilot of the rest of the feature, with the browser test when ticked; a new feature from the header.
    await ui.press({ key: 'autopilot:demo' })
    expect(filled.at(-1)).toBe(`/factory:autopilot ${PLAN_FOLDER}`)
    await ui.press({ key: 'browser-test:demo' })
    await ui.press({ key: 'autopilot:demo' })
    expect(filled.at(-1)).toBe(`/factory:autopilot ${PLAN_FOLDER} — with browser test`)
    await ui.press({ key: 'browser-test:demo' })
    await ui.press({ key: 'new-autopilot' })
    expect(filled.at(-1)).toBe('/factory:autopilot ')

    expect(await ui.find({ type: 'Text', text: /· 2 plans$/ })).toBeDefined()
    expect(await ui.find({ key: 'plan:demo' })).toBeDefined()
    await ui.press({ key: 'new-plan:demo' })
    expect(filled.at(-1)).toBe('/factory:write-plan demo')
    await ui.select({ key: 'plan:demo', value: OLD_PLAN_FOLDER })
    expect(await ui.find({ key: 'prepare:demo' })).toBeUndefined()
    // A finalized feature is folded away, unless it is the card unfolded.
    expect(await ui.find({ type: 'Text', text: /plan finalisé/ })).toBeDefined()
    expect(await ui.find({ key: 'show-done' })).toBeUndefined()
    expect((await ui.find({ key: 'step:demo:stage:1' }))?.text).toContain('non committé')
    expect(await ui.find({ key: 'step:demo:stage:2' })).toBeUndefined()
    expect((await ui.find({ key: 'step:demo:spec' }))?.text).toContain('brouillon')
    await ui.select({ key: 'plan:demo', value: PLAN_FOLDER })

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
  expect(started).toMatchObject({ feature: 'demo', folder: PLAN_FOLDER, command: 'implement', step: 'stage:2', status: 'running', root: ROOT, repo: REPO })

  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  const ended = store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>
  expect(ended.status).toBe('waiting')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'live:session-aaaa-1111:1000000', text: /Stage 2 — web\s+1\/3/ })).toBeDefined()
  const card = (await ui.find({ key: 'card:session-aaaa-1111:1000000' }))?.text
  expect(card).toMatch(/attend une réponse/)
  expect(card).toMatch(/○ demo\s+Stage 2 — web 1\/3/)
  expect(card).toMatch(/attend une réponse · 0 min\s+cette session/)
  await ui.press({ key: 'live:session-aaaa-1111:1000000' })
  expect(await ui.find({ key: 'run:session-aaaa-1111:1000000', text: /\d\d\/\d\d \d\d:\d\d · 0 min · cette session.*attend une réponse/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Sessions actives · 1$/ })).toBeDefined()

  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(demo): spec"' } as never)
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('done')
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer' })
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('done')
  expect(await ui.find({ key: 'live:session-aaaa-1111:1000000' })).toBeUndefined()
  expect(await ui.find({ key: 'run:session-aaaa-1111:1000000', text: /· cette session$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Sessions actives/ })).toBeUndefined()
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

test('a factory skill called through the Skill tool records the run like a typed prompt', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Skill' }, () => ({ result: {} as never }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  // A subagent's call records nothing; the bare name and the prefixed one both count.
  await $.tool.call({ tool: 'Skill', skill: 'factory:write-plan', args: 'tags', agentId: 'agent-1' } as never)
  expect([...store.keys()]).toEqual([])
  await $.tool.call({ tool: 'Skill', skill: 'factory:implement', args: `${PLAN_FOLDER} — stages 1-2 (api, web), chained — with review` } as never)
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'demo', folder: PLAN_FOLDER, command: 'implement', step: 'stage:1', lastStep: 'stage:2', status: 'running', repo: REPO })
  await $.tool.call({ tool: 'Skill', skill: 'write-plan', args: 'tags' } as never)
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'tags', command: 'write-plan', step: 'plan' })
  await $.tool.call({ tool: 'Skill', skill: 'commit' } as never)
  expect([...store.keys()]).toHaveLength(1)
})

test('a live run followed by a newer run of its loop is done, ended when the next one started; another loop’s run stays live', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Skill' }, () => ({ result: {} as never }))
  on('agent.spawn', () => ({ agentId: 'agent-1', model: 'sonnet' }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  // A subagent's run, then the main loop's spec with nothing to commit, then its plan.
  await $.agent.spawn({ prompt: '/factory:write-plan tags' })
  await store.clock.advance(1000)
  await $.tool.call({ tool: 'Skill', skill: 'factory:write-spec', args: 'demo' } as never)
  await store.clock.advance(17_000)
  await $.tool.call({ tool: 'Skill', skill: 'factory:write-plan', args: 'demo' } as never)
  await store.clock.advance(60_000)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(demo): plan"' } as never)

  expect(store.get('run:session-aaaa-1111:1001000')).toMatchObject({ step: 'spec', status: 'done', updatedAt: 1_018_000 })
  expect(store.get('run:session-aaaa-1111:1018000')).toMatchObject({ step: 'plan', status: 'done' })
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'tags', status: 'running', agentId: 'agent-1' })
})

test('a /factory: brief given to a subagent through the Agent tool is a run of that subagent, done at its commit', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ agentId: 'agent-1', model: 'sonnet' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  // A brief without a /factory: line records nothing, nor does a spawn from inside a subagent.
  await $.agent.spawn({ prompt: 'Read README.md and report.' })
  await $.agent.spawn({ prompt: `/factory:write-plan tags`, parentAgentId: 'agent-0' } as never)
  expect([...store.keys()]).toEqual([])
  await $.agent.spawn({ prompt: `Implement the stage:\n\`/factory:implement ${PLAN_FOLDER} — stage 2 (web) — with review\`\nCommit it, then report.` })
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'demo', folder: PLAN_FOLDER, command: 'implement', step: 'stage:2', status: 'running', agentId: 'agent-1' })

  // The main loop's turn end and commit are not the subagent's.
  await $.turn.complete({ answer: 'spawned', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs: notes"' } as never)
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('running')
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat(demo): web — counter page"', agentId: 'agent-1' } as never)
  expect((store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>).status).toBe('done')
})

test('a subagent that returns without committing leaves its run waiting', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ agentId: 'agent-1', model: 'sonnet' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: `/factory:write-spec tags` })
  await $.turn.complete({ answer: 'blocked', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'agent-1' } as never)
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'tags', step: 'spec', status: 'waiting', agentId: 'agent-1' })
})

test('an autopilot from a plan folder is one run moved along its subagents, done once the last one committed', async ($, on) => {
  const store = mockProject(on)
  let spawned = 0
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('agent.spawn', () => ({ agentId: `agent-${++spawned}`, model: 'sonnet' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  on('prompt.fill', () => ({ isFilled: true }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  await $.prompt.submit({ text: `/factory:autopilot ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
  const pilot = () => store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>
  expect(pilot()).toMatchObject({ feature: 'demo', folder: PLAN_FOLDER, command: 'autopilot', step: 'stage:2', status: 'running' })

  // The stage's subagent: its run on the stage row, the pipeline at that step.
  await store.clock.advance(1000)
  await $.agent.spawn({ prompt: `Read the skill, then act as if the person typed:\n/factory:implement ${PLAN_FOLDER} — stage 2 (web) — with review — autonomous\nReport the commit.` })
  expect(store.get('run:session-aaaa-1111:1001000')).toMatchObject({ feature: 'demo', command: 'implement', step: 'stage:2', status: 'running', agentId: 'agent-1' })
  expect(pilot().step).toBe('stage:2')

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: /^Autopilot · Stage 2 — web$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /● en cours · 0 min/ })).toBeDefined()
  expect(await band.find({ key: 'next-step' })).toBeUndefined()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // The session list shows the pipeline, not its subagent; the card wears the autopilot pill and offers no prompt.
  expect(await pane.find({ key: 'live:session-aaaa-1111:1000000', text: /Autopilot · Stage 2 — web/ })).toBeDefined()
  expect(await pane.find({ key: 'live:session-aaaa-1111:1001000' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /⚡ autopilot · Stage 2 — web/ })).toBeDefined()
  expect(await pane.find({ key: 'prepare:demo' })).toBeUndefined()
  await pane.press({ key: 'row:demo' })
  expect(await pane.find({ key: 'autopilot:demo' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /Autopilot en cours sur cette feature/ })).toBeDefined()
  expect(await pane.find({ key: 'run:session-aaaa-1111:1001000', text: /cette session/ })).toBeDefined()
  expect(await pane.find({ key: 'run:session-aaaa-1111:1000000' })).toBeUndefined()

  await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat(demo): web — counter page"', agentId: 'agent-1' } as never)
  expect((store.get('run:session-aaaa-1111:1001000') as Record<string, unknown>).status).toBe('done')
  expect(pilot().status).toBe('running')

  // The final review's subagent moves the pipeline to its last step; the main turn's end ends it, done.
  await store.clock.advance(1000)
  await $.agent.spawn({ prompt: `/factory:implement ${PLAN_FOLDER} — final review — autonomous` })
  expect(pilot().step).toBe('review')
  await $.turn.complete({ answer: 'reviewed', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'agent-2' } as never)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "chore(demo): validation — review"', agentId: 'agent-2' } as never)
  await $.turn.complete({ answer: 'report', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(pilot().status).toBe('done')
  expect(await band.find({ type: 'Text', text: /✓ terminé/ })).toBeDefined()
  expect(await pane.find({ key: 'live:session-aaaa-1111:1000000' })).toBeUndefined()
  await band.unmount()
  await pane.unmount()
})

test('an autopilot from a request takes its feature at the spec commit, and stops as interrupted with a resume button', async ($, on) => {
  const store = mockProject(on)
  let spawned = 0
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('agent.spawn', () => ({ agentId: `agent-${++spawned}`, model: 'sonnet' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  const filled: string[] = []
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  await $.prompt.submit({ text: '/factory:autopilot add tags to the todos', wait: false, origin: { kind: 'composer' } })
  const pilot = () => store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>
  expect(pilot()).toMatchObject({ feature: null, folder: null, command: 'autopilot', step: 'spec', status: 'running' })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: /nouvelle feature/ })).toBeDefined()

  await store.clock.advance(1000)
  await $.agent.spawn({ prompt: '/factory:write-spec add tags to the todos — autonomous' })
  expect(store.get('run:session-aaaa-1111:1001000')).toMatchObject({ feature: null, command: 'write-spec', step: 'spec', agentId: 'agent-1' })
  // The spec's commit names the feature: the subagent's run and the pipeline take it.
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(tags): spec — tags on todos"', agentId: 'agent-1' } as never)
  expect(store.get('run:session-aaaa-1111:1001000')).toMatchObject({ feature: 'tags', status: 'done' })
  expect(pilot()).toMatchObject({ feature: 'tags', step: 'spec', status: 'running' })

  // The plan's subagent stops without committing: the pipeline is interrupted with it, and resumes from its slug.
  await store.clock.advance(1000)
  await $.agent.spawn({ prompt: '/factory:write-plan tags — autonomous' })
  expect(pilot().step).toBe('plan')
  await $.turn.complete({ answer: 'blocked', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'agent-2' } as never)
  await $.turn.complete({ answer: 'stopped', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(pilot()).toMatchObject({ status: 'interrupted', step: 'plan' })
  expect((store.get('run:session-aaaa-1111:1002000') as Record<string, unknown>).status).toBe('interrupted')
  expect(await band.find({ type: 'Text', text: /arrêté · à reprendre/ })).toBeDefined()
  expect((await band.find({ key: 'next-step' }))?.text).toBe("Reprendre l'autopilot")
  await band.press({ key: 'next-step' })
  expect(filled.at(-1)).toBe('/factory:autopilot tags')
  await band.unmount()
})

for (const resumed of ['before', 'after'] as const) {
  test(`an autopilot that ends its turn on a subagent resumed in the background goes on at its hand-back (resumed ${resumed} the turn's end)`, async ($, on) => {
    const store = mockProject(on)
    let spawned = 0
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('prompt.submit', ($, e) => ({ text: e.text }))
    on('agent.spawn', () => ({ agentId: `agent-${++spawned}`, model: 'sonnet' }))
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
    await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

    await $.prompt.submit({ text: `/factory:autopilot ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
    const pilot = () => store.get('run:session-aaaa-1111:1000000') as Record<string, unknown>
    const stage = () => store.get('run:session-aaaa-1111:1001000') as Record<string, unknown>
    await store.clock.advance(1000)
    await $.agent.spawn({ prompt: `/factory:implement ${PLAN_FOLDER} — stage 2 (web) — with review — autonomous` })
    // The subagent returns without its commit; the main loop resumes it in the background and ends its turn.
    await $.turn.complete({ answer: 'review pending', durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'agent-1' } as never)
    const resume = () => $.turn.start({ text: '', turnId: 't3', agentId: 'agent-1' } as never)
    if (resumed === 'before') await resume()
    await $.turn.complete({ answer: 'waiting for its report', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
    if (resumed === 'after') await resume()
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat(demo): web — counter page"', agentId: 'agent-1' } as never)
    expect(stage().status).toBe('done')

    // The hand-back opens a main turn: the pipeline is live again and follows its next subagent.
    await $.turn.start({ text: '', turnId: 't4' })
    await store.clock.advance(1000)
    await $.agent.spawn({ prompt: `/factory:implement ${PLAN_FOLDER} — final review — autonomous` })
    expect(pilot()).toMatchObject({ status: 'running', step: 'review' })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: /arrêté/ })).toBeUndefined()
    expect(await band.find({ key: 'next-step' })).toBeUndefined()
    await band.unmount()
  })
}

test('a run from another worktree of the same repository is listed, a run of another repository is not', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const run = (sessionId: string, root: string, repo?: string) => ({ sessionId, root, ...(repo && { repo }), feature: 'demo', folder: PLAN_FOLDER, command: 'implement', step: 'stage:2', status: 'waiting' as const, since: 900_000, updatedAt: 900_000 })
  store.set('run:worktree-1111:900000', run('worktree-1111', '/repo/.claude/worktrees/wt', REPO))
  store.set('run:other-2222:900000', run('other-2222', '/other', '/other/.git'))
  store.set('run:legacy-3333:900000', run('legacy-3333', ROOT))
  store.set('run:legacy-4444:900000', run('legacy-4444', '/repo/.claude/worktrees/wt'))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'live:worktree-1111:900000' })).toBeDefined()
  expect(await ui.find({ key: 'live:legacy-3333:900000' })).toBeDefined()
  expect(await ui.find({ key: 'live:other-2222:900000' })).toBeUndefined()
  expect(await ui.find({ key: 'live:legacy-4444:900000' })).toBeUndefined()
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
  expect(['spec', 'plan', 'stage:1', 'stage:2', 'review'].map(s => isStepDone(demo, s))).toEqual([true, true, true, false, false])
  expect(isStepDone(empty, 'spec')).toBe(false)
  const command = (text: string) => parseFactoryCommand(text)!
  expect(runStep(command(`/factory:implement ${PLAN_FOLDER}`), demo)).toBe('stage:2')
  expect(runStep(command(`/factory:implement ${PLAN_FOLDER} — final review`), demo)).toBe('review')
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
  // An autopilot starts at the feature's step, or at the spec from a request.
  expect(runStep(command(`/factory:autopilot ${PLAN_FOLDER}`), demo)).toBe('stage:2')
  expect(runStep(command('/factory:autopilot add tags'), undefined)).toBe('spec')
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

  // A live `write-plan demo`: the card leaves the plans for the new one, which only its live run shows on.
  const writing = { ...run('plan', null), command: 'write-plan', status: 'running' as const }
  expect(onNewPlan(demo, [run('plan', null)])).toBeNull()
  expect(onNewPlan({ ...demo, plans: [{ ...latest, isDraft: true }, old] }, [writing])).toBeNull()
  const onNew = onNewPlan(demo, [writing])
  expect(onNew).toMatchObject({ plan: null, state: 'spec' })
  expect(isRunOfPlan(writing, onNew as FactoryBoardFeature)).toBe(true)
  expect(isRunOfPlan(run('plan', null), onNew as FactoryBoardFeature)).toBe(false)

  const board = (plans: typeof demo.plans): FactoryBoard => ({ root: ROOT, repo: null, branch: null, baseBranch: 'main', aheadCount: null, changedCount: 0, features: [{ ...demo, plans }], runs: [], scannedAt: 0, error: null })
  expect(newPlans(null, board([latest, old]))).toEqual([])
  expect(newPlans(board([old]), board([old]))).toEqual([])
  expect(newPlans(board([old]), board([latest, old]))).toEqual(['demo'])
})

test('a new plan being written takes the card, and the plan that appears is followed', async ($, on) => {
  const files = { ...BASE_FILES }
  const store = mockProject(on, { files })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'row:demo' })
  await ui.select({ key: 'plan:demo', value: OLD_PLAN_FOLDER })
  await $.prompt.submit({ text: '/factory:write-plan demo', wait: false, origin: { kind: 'composer' } })
  expect(store.get('run:session-aaaa-1111:1000000')).toMatchObject({ feature: 'demo', folder: null, step: 'plan', status: 'running' })

  expect(await ui.find({ type: 'Text', text: /^ nouveau plan en cours $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Nouveau plan en cours d’écriture/ })).toBeDefined()
  expect(await ui.find({ key: 'step:demo:plan', text: /Plan.*en cours/ })).toBeDefined()
  expect(await ui.find({ key: 'step:demo:stage:1' })).toBeUndefined()
  expect(await ui.find({ key: 'plan:demo' })).toBeUndefined()
  expect(await ui.find({ key: 'new-plan:demo' })).toBeUndefined()
  expect(await ui.find({ key: 'prepare:demo' })).toBeUndefined()

  files[`${ROOT}/${NEW_PLAN_FOLDER}/plan.md`] = PLAN
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(demo): plan"' } as never)
  expect(await ui.find({ type: 'Text', text: /^20261017-100000-rework-counter · 3 plans$/ })).toBeDefined()
  expect((await ui.find({ key: 'prepare:demo' }))?.text).toBe('Stage 2 — web')
  expect(await ui.find({ key: 'run:session-aaaa-1111:1000000', text: /· cette session$/ })).toBeDefined()
  await ui.unmount()
})

test('tickReview ticks the Validation’s Review item only, the line endings kept', () => {
  const plan = '## Progress\n\n### Stage 1 — api\n- [ ] Review the endpoint\n\n## Validation\n\n- [ ] Review: the reviewer\n- [ ] Tests: green\n'
  const ticked = plan.replace('- [ ] Review: the', '- [x] Review: the')
  expect(tickReview(plan)).toBe(ticked)
  expect(parsePlan(ticked).reviewDone).toBe(true)
  expect(tickReview(plan.split('\n').join('\r\n'))).toBe(ticked.split('\n').join('\r\n'))
  expect(tickReview('## Validation\n\n- [-] Revue : refusée\n')).toBe('## Validation\n\n- [x] Revue : refusée\n')
  expect(tickReview('## Validation\n\n- [x] Review: done\n')).toBeNull()
  expect(tickReview('## Validation\n\n- [ ] Tests: green\n')).toBeNull()
  expect(tickReview('## Progress\n\n- [ ] Review: not here\n')).toBeNull()
})

test('the final review is marked done from the pane: Review ticked in plan.md, the plan finalized', async ($, on) => {
  const finished = PLAN.replace(/- \[ \] (pages|ui):/g, '- [x] $1:')
  const files = { ...BASE_FILES, [`${ROOT}/${PLAN_FOLDER}/plan.md`]: finished }
  mockProject(on, { files })
  const written: string[] = []
  on('fs.write', ($, e) => {
    files[norm(e.path)] = e.text
    written.push(norm(e.path))
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'row:demo' })
  expect((await ui.find({ key: 'prepare:demo' }))?.text).toBe('Revue finale')
  expect(await ui.find({ key: 'session:demo' })).toBeUndefined()
  await ui.press({ key: 'mark-review:demo' })
  expect(written).toEqual([`${ROOT}/${PLAN_FOLDER}/plan.md`])
  expect(files[`${ROOT}/${PLAN_FOLDER}/plan.md`]).toBe(finished.replace('- [ ] Review:', '- [x] Review:'))
  expect(await ui.find({ type: 'Text', text: /plan finalisé/ })).toBeDefined()
  expect(await ui.find({ key: 'prepare:demo' })).toBeUndefined()
  expect(await ui.find({ key: 'mark-review:demo' })).toBeUndefined()
  // Folded, the finalized feature leaves a line that shows it beside the others; the chips then take groups away.
  await ui.press({ key: 'row:demo' })
  expect(await ui.find({ key: 'row:demo' })).toBeUndefined()
  await ui.press({ key: 'show-done' })
  expect(await ui.find({ key: 'row:demo' })).toBeDefined()
  expect(await ui.find({ key: 'row:tags' })).toBeDefined()
  await ui.press({ key: 'filter:no-plan' })
  expect(await ui.find({ key: 'row:demo' })).toBeDefined()
  expect(await ui.find({ key: 'row:tags' })).toBeUndefined()
  await ui.unmount()
})

test('readModels reads every shape of models, setModels writes only the roles off the preset', () => {
  const standard = readModels('')
  expect(standard.planner).toBe('opus')
  expect(standard.runner).toBe('haiku')
  expect(readModels('name: a\nmodels: standard  # preset\ncomponents:\n')).toEqual(standard)
  expect(readModels('models:\n  preset: standard\n  planner: fable # big\n  reviewer: "sonnet"\ncomponents:\n').planner).toBe('fable')
  expect(readModels('models:\r\n  preset: standard\r\n  reviewer: sonnet\r\n').reviewer).toBe('sonnet')
  expect(readModels('models: {preset: standard, implementer: opus}\n').implementer).toBe('opus')

  const yaml = 'name: a\nbase_branch: main\nmodels: standard\ncomponents:\n  - name: api\n'
  const set = setModels(yaml, { ...standard, planner: 'fable' })
  expect(set).toBe('name: a\nbase_branch: main\nmodels:\n  preset: standard\n  planner: fable\ncomponents:\n  - name: api\n')
  expect(readModels(set).planner).toBe('fable')
  // Back on the preset: the map folds to its name.
  expect(setModels(set, standard)).toBe(yaml)
  // A missing key goes before `components:`; the line endings are kept.
  expect(setModels('name: a\r\ncomponents:\r\n', { ...standard, runner: 'sonnet' })).toBe('name: a\r\nmodels:\r\n  preset: standard\r\n  runner: sonnet\r\ncomponents:\r\n')
  expect(setModels('name: a\n', standard)).toBe('name: a\nmodels: standard\n')
  // The blank line before the next key stays.
  expect(setModels('models:\n  planner: fable\n\ncomponents:\n', standard)).toBe('models: standard\n\ncomponents:\n')
})

test('the configuration screen sets a role’s model in factory.yaml', async ($, on) => {
  const files = { ...BASE_FILES }
  mockProject(on, { files })
  on('fs.write', ($, e) => {
    files[norm(e.path)] = e.text
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'config' })
  expect(await ui.find({ key: 'row:demo' })).toBeUndefined()
  expect(await ui.find({ key: 'role:planner', text: /planner/ })).toBeDefined()
  await ui.select({ key: 'model:planner', value: 'fable' })
  expect(files[`${ROOT}/factory.yaml`]).toBe('project: demo\nbase_branch: "develop"  # the base\nmodels:\n  preset: standard\n  planner: fable\n')
  await ui.press({ key: 'config' })
  expect(await ui.find({ key: 'row:demo' })).toBeDefined()
  await ui.unmount()
})

test('runPlan names the plan a run works on', () => {
  const parsed = parsePlan(PLAN)
  const plan = { ...parsed, title: parsed.title ?? 'Demo', folder: PLAN_FOLDER, isDraft: false }
  const old = { ...plan, folder: OLD_PLAN_FOLDER }
  const feature: FactoryBoardFeature = { slug: 'demo', title: 'Demo', hasSpec: true, specStatus: null, plans: [plan, old], plan, state: 'running' }
  const run = (command: string, step: string, folder: string | null) => ({ sessionId: 's', root: ROOT, feature: 'demo', folder, command, step, status: 'running' as const, since: 0, updatedAt: 0 })
  expect(runPlan(run('implement', 'stage:2', OLD_PLAN_FOLDER), feature)).toBe(old)
  expect(runPlan(run('implement', 'stage:2', null), feature)).toBe(plan)
  expect(runPlan(run('write-spec', 'spec', null), feature)).toBeUndefined()
  expect(runPlan(run('write-plan', 'plan', null), feature)).toBeNull()
  expect(runPlan(run('write-plan', 'plan', null), { ...feature, plans: [{ ...plan, isDraft: true }] })?.isDraft).toBe(true)
  expect(runTitle(run('implement', 'stage:2', null), feature)).toBe('Stage 2 — web')
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
  // A run stored before the close step went away.
  expect(describeRun(run('implement', 'close'), feature)).toBe('Implémentation · demo')
  expect(describeRun(run('implement', 'review'), feature)).toBe('Revue finale · demo')
  expect(describeRun(run('review', 'plan'), feature)).toBe('Revue du plan · demo')
  expect(describeRun(run('autopilot'), feature)).toBe('Autopilot · Stage 2 — web · demo')
  expect(describeRun({ ...run('autopilot', 'spec'), feature: null }, undefined)).toBe('Autopilot · Spec · nouvelle feature')
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
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 42_000, window: 200_000, percent: 21 }, rateLimits: [] } }))
  const filled: string[] = []
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /aucune étape factory/ })).toBeDefined()
  expect((await ui.find({ key: 'toggle-pane' }))?.text).toBe('Fermer le tableau')

  await ui.press({ key: 'toggle-pane' })
  expect(closed).toEqual(['factory-board'])
  expect((await ui.find({ key: 'toggle-pane' }))?.text).toBe('Ouvrir le tableau')

  await $.prompt.submit({ text: `/factory:implement ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
  expect(await ui.find({ type: 'Text', text: /^Stage 2 — web$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ 1\/3$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /● en cours · 0 min/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /tokens/ })).toBeDefined()
  expect(await ui.find({ key: 'next-step' })).toBeUndefined()

  // The run's commit ends it: the band offers the plan's next step without the pane.
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat(demo): web — counter page"' } as never)
  expect((await ui.find({ key: 'next-step' }))?.text).toBe('Stage 2 — web')
  await ui.press({ key: 'next-step' })
  expect(filled.at(-1)).toBe(`/factory:implement ${PLAN_FOLDER} — stage 2 (web)`)
  await ui.unmount()
})

/** Mounts the pane on a project, presses `Squasher` when it shows: the prompt it prepared, null without the button. */
async function squashPrompt($: Parameters<Parameters<typeof test>[1]>[0], on: On, options: Parameters<typeof mockProject>[1]): Promise<string | null> {
  mockProject(on, options)
  const filled: string[] = []
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const button = await ui.find({ key: 'squash' })
  if (button !== undefined) await ui.press({ key: 'squash' })
  await ui.unmount()
  return button === undefined ? null : (filled.at(-1) ?? null)
}

test('the squash of a branch whose feature has its plan finalized closes that plan', async ($, on) => {
  const { [`${ROOT}/${PLAN_FOLDER}/plan.md`]: _, ...finalized } = BASE_FILES
  expect(await squashPrompt($, on, { files: finalized })).toBe(`/factory:implement ${OLD_PLAN_FOLDER} — close the branch`)
})

test('the squash of a branch whose commits name no feature closes the branch without a plan', async ($, on) => {
  expect(await squashPrompt($, on, { range: 'chore(ci): cache\nchore(ci): node 20\n' })).toBe('/factory:implement close the branch feat/demo')
})

test('a branch of one commit offers no squash', async ($, on) => {
  expect(await squashPrompt($, on, { range: 'chore(ci): cache\n' })).toBeNull()
})

test('exportPath names a project as ~/.claude/projects names its folder, a worktree apart', () => {
  expect(exportPath('C:\\Users\\me\\.claude', 'C:\\WS\\ia-projects\\claude-companion')).toBe('C:\\Users\\me\\.claude/factory-board/C--WS-ia-projects-claude-companion.json')
  expect(exportPath('/home/me/.claude/', 'C:/WS/ia-projects/claude-companion/.claude/worktrees/live-e15e79/')).toBe('/home/me/.claude/factory-board/C--WS-ia-projects-claude-companion--claude-worktrees-live-e15e79.json')
})

test('the board is exported for companion apps: the pane’s timeline, prompts and live sessions', async ($, on) => {
  const store = mockProject(on)
  mock.env(on, { HOME: '/home/me' })
  const written = new Map<string, string>()
  on('fs.write', ($, e) => {
    written.set(norm(e.path), e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

  const read = () => JSON.parse(written.get('/home/me/.claude/factory-board/-repo.json') ?? 'null') as FactoryBoardExport
  const first = read()
  expect(first.schemaVersion).toBe(2)
  expect(first.activity.phase).toBe('idle')
  expect(first.root).toBe(ROOT)
  expect(first.markers).toEqual({ review: ' — with review', browser: ' — with browser test' })
  expect(first.squash).toEqual({ prompt: `/factory:implement ${PLAN_FOLDER} — close the branch`, isReady: false })
  const demo = first.features.find(f => f.slug === 'demo')
  expect(demo?.plan?.folder).toBe(PLAN_FOLDER)
  expect(demo?.plans).toEqual([PLAN_FOLDER, OLD_PLAN_FOLDER])
  expect(demo?.next?.prompt).toBe(`/factory:implement ${PLAN_FOLDER} — stage 2 (web)`)
  expect(demo?.steps.map(s => `${s.step} ${s.marker} ${s.detail}`)).toEqual(['spec done brouillon', 'plan done commité', 'stage:1 done b71e04', 'stage:2 next 1/3', 'review pending 0/2'])
  expect(first.features.find(f => f.slug === 'tags')?.next?.prompt).toBe('/factory:write-plan tags')

  // A live autopilot on the feature: no prompt offered, its step running, the pipeline in the live sessions.
  store.set('run:other:999000', { sessionId: 'other', root: ROOT, repo: REPO, feature: 'demo', folder: PLAN_FOLDER, command: 'autopilot', step: 'stage:2', status: 'running', since: 999_000, updatedAt: 999_000 })
  await store.clock.advance(10_000)
  const second = read()
  const piloted = second.features.find(f => f.slug === 'demo')
  expect(piloted?.next).toBeNull()
  expect(piloted?.autopilot?.sessionId).toBe('other')
  expect(piloted?.steps.find(s => s.step === 'stage:2')?.marker).toBe('running')
  expect(second.live.map(r => r.command)).toEqual(['autopilot'])
  expect(second.activity).toMatchObject({ phase: 'working', sessionId: 'other', feature: 'demo', step: 'stage:2' })
  expect(second.sessions.map(r => `${r.sessionId} ${r.phase}`)).toEqual(['other working'])
})

test('a failed export leaves the board working', async ($, on) => {
  mockProject(on)
  mock.env(on, { HOME: '/home/me' })
  on('fs.write', () => {
    throw new Error('EACCES')
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'row:demo' })).toBeDefined()
  await ui.unmount()
})

const COMMIT_QUESTION = 'Spec prête. On committe ?\n\n```\ndocs(demo): spec — the demo\n\nBody line.\n```\n'
const DONE_TURN = 'Stage livré.\n\n---\n## ✅ JOB DONE\n> Liste branchée sur l’API, 12 tests verts.\n`abc1234` feat(demo): stage 2 — web · branch `feat/demo` · not pushed\n'

test('classifyTurn reads a commit question, the done footer and its recap, any other question', () => {
  expect(classifyTurn(COMMIT_QUESTION, { status: 'waiting' })).toEqual({ phase: 'awaiting-commit', pendingCommit: 'docs(demo): spec — the demo\n\nBody line.', recap: null })
  expect(classifyTurn(DONE_TURN, { status: 'done' })).toEqual({ phase: 'job-done', pendingCommit: null, recap: { text: 'Liste branchée sur l’API, 12 tests verts.', commits: [{ sha: 'abc1234', subject: 'feat(demo): stage 2 — web' }] } })
  expect(classifyTurn('## ✅ JOB DONE\n`abc1234` fix(x): y · branch `b` · not pushed', { status: 'done' }).recap).toEqual({ text: null, commits: [{ sha: 'abc1234', subject: 'fix(x): y' }] })
  expect(classifyTurn('Quelle option ?\n\n```ts\nconst a = 1\n```', { status: 'waiting' }).phase).toBe('awaiting-answer')
  // A done run keeps its recap through a turn with no footer.
  expect(classifyTurn('Merci.', { status: 'done' })).toEqual({ phase: 'job-done', pendingCommit: null })
})

test('projectActivity puts forward the session that most needs the person', () => {
  const run = (sessionId: string, status: FactoryBoardRun['status'], phase: FactoryBoardRun['phase'], updatedAt: number): FactoryBoardRun =>
    ({ sessionId, root: ROOT, feature: 'demo', folder: null, command: 'implement', step: 'stage:2', status, phase, since: updatedAt, updatedAt })
  expect(projectActivity([]).phase).toBe('idle')
  const runs = [run('a', 'running', 'working', 30), run('b', 'waiting', 'awaiting-commit', 10), run('c', 'done', 'job-done', 40), run('d', 'interrupted', 'awaiting-answer', 50)]
  expect(projectActivity(runs)).toMatchObject({ phase: 'awaiting-commit', sessionId: 'b' })
  expect(projectActivity(runs.slice(2))).toMatchObject({ phase: 'job-done', sessionId: 'c' })
})

test('a turn ending on a commit question waits for the commit, the yes works, the footer marks the job done', async ($, on) => {
  const store = mockProject(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  const run = () => store.get('run:session-aaaa-1111:1000000') as FactoryBoardRun

  await $.prompt.submit({ text: `/factory:implement ${PLAN_FOLDER}`, wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer: COMMIT_QUESTION, durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(run()).toMatchObject({ status: 'waiting', phase: 'awaiting-commit', pendingCommit: 'docs(demo): spec — the demo\n\nBody line.' })

  await $.turn.start({ text: 'oui', turnId: 't2' })
  expect(run()).toMatchObject({ status: 'running', phase: 'working' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "docs(demo): spec"' } as never)
  await $.turn.complete({ answer: DONE_TURN, durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer' })
  expect(run()).toMatchObject({ status: 'done', phase: 'job-done', pendingCommit: null, recap: { text: 'Liste branchée sur l’API, 12 tests verts.' } })
})
