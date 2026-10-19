import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { activeStep, afterCommit, committed, describeRun, featureState, isRunOfPlan, isStepDone, newPlans, nextAction, onNewPlan, parseFactoryCommand, parsePlan, parseSpec, runLastStep, runPlan, runStep, runTitle, stamp, tickReview, withPlan } from '../hooks/planning'
import type { FactoryBoard, FactoryBoardFeature } from '../types'

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

/** A project on disk, git included, answered from memory. Returns the store the mod writes to. */
function mockProject(on: On, options: { log?: string; range?: string; files?: Record<string, string> } = {}): Map<string, unknown> {
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
    // The filter chips: only the matching features stay, the active chip clears on a second press.
    await ui.press({ key: 'filter:no-plan' })
    expect(await ui.find({ key: 'row:demo' })).toBeUndefined()
    expect(await ui.find({ key: 'row:tags' })).toBeDefined()
    await ui.press({ key: 'filter:all' })
    expect(await ui.find({ key: 'row:demo' })).toBeDefined()
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
