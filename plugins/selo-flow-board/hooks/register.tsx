/**
 * selo-flow-board: a pane that follows selo-flow's features, their dev plans
 * and the sessions working on them, and prepares the next `/selo-flow:` prompt.
 *
 * Source of truth: `.planning/features/*` and git, rescanned on a timer, on
 * each `git commit` and on each turn's end. The mod keeps one thing of its
 * own, in `$.store`: the runs, which session worked on which step of which
 * feature, written when a `/selo-flow:` prompt is submitted and kept as history.
 */

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiPressArgument } from 'claude-code'

import type { SeloFlowBoard, SeloFlowBoardFeature, SeloFlowBoardFilter, SeloFlowBoardMarker, SeloFlowBoardPlan, SeloFlowBoardRun, SeloFlowBoardRunStatus, SeloFlowBoardStage, SeloFlowBoardStep } from '../types'
import { activeStep, afterCommit, classifyTurn, commitFeature, committed, describeRun, exportBoard, exportPath, featureAction, featureLabel, isOffWorkflow, OFF_WORKFLOW, featurePilot, followedFeatures, isStageDone, isStepDone, liveRuns, MODEL_CHOICES, MODEL_ROLES, newPlans, nextAction, parseSeloFlowCommand, runLastStep, runPlan, runStep, runTitle, setModels, stamp, stepDetail, stepMarker, stepRuns, stepTitle, steps, tickReview, withPlan } from './planning'
import { scanBoard } from './scan'

const PANE = 'selo-flow-board'
const COMMAND = 'selo-flow-board'
const RUN_PREFIX = 'run:'
/** A live run nobody touched for a day is a session that died: interrupted. */
const STALE_MS = 24 * 60 * 60 * 1000
/** A run older than a month leaves the history. */
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000
const POLL_MS = 10_000

const board = atom({ plugin: 'selo-flow-board', key: 'board' } as const, null)
const expanded = atom({ plugin: 'selo-flow-board', key: 'expanded' } as const, null)
const isPaneOpen = atom({ plugin: 'selo-flow-board', key: 'isPaneOpen' } as const, false)
const pickedPlans = atom({ plugin: 'selo-flow-board', key: 'pickedPlans' } as const, {})
const noBrowserTest = atom({ plugin: 'selo-flow-board', key: 'noBrowserTest' } as const, false)
const stateFilters = atom({ plugin: 'selo-flow-board', key: 'stateFilters' } as const, [])
const isConfigOpen = atom({ plugin: 'selo-flow-board', key: 'isConfigOpen' } as const, false)
const openHistory = atom({ plugin: 'selo-flow-board', key: 'openHistory' } as const, null)

const isLive = (run: SeloFlowBoardRun): boolean => run.status === 'running' || run.status === 'waiting'
const isPilot = (run: SeloFlowBoardRun): boolean => run.command === 'autopilot'

async function openPane($: EngineInterface, focus = false): Promise<void> {
  await $.ui.open(focus ? { id: PANE, title: 'selo-flow', focus: true } : { id: PANE, title: 'selo-flow' })
  await update($, isPaneOpen, () => true)
}

async function closePane($: EngineInterface): Promise<void> {
  await $.ui.close({ id: PANE })
  await update($, isPaneOpen, () => false)
}

/** The same loop: one session's main loop, or one of its subagents. */
const isSameLoop = (a: SeloFlowBoardRun, b: SeloFlowBoardRun): boolean => a.sessionId === b.sessionId && (a.agentId ?? null) === (b.agentId ?? null)

/**
 * Every run of the repository, oldest first; prunes the old ones and interrupts the silent ones on the way.
 * A live run followed by a newer run of its loop is done: a loop works on one step at a time, and only its
 * latest run hears its turns and commits (a `write-spec` with nothing to commit, then a `write-plan`).
 * A run from another worktree of the same repository counts: its `repo` is the same git common dir.
 * A record without `repo` (written before it existed) is kept on its root.
 */
async function readRuns($: EngineInterface, root: string, repo: string | null, now: number): Promise<SeloFlowBoardRun[]> {
  const all: [string, SeloFlowBoardRun][] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(RUN_PREFIX)) continue
    const run = (await $.store.get(key)) as SeloFlowBoardRun | undefined
    if (run === undefined) continue
    if (now - run.updatedAt > HISTORY_MS) {
      await $.store.delete(key)
      continue
    }
    all.push([key, run])
  }
  const runs: SeloFlowBoardRun[] = []
  for (const [key, stored] of all) {
    let run = stored
    const successor = isLive(run) ? all.map(([, r]) => r).filter(r => isSameLoop(r, run) && r.since > run.since).sort((a, b) => a.since - b.since)[0] : undefined
    if (successor !== undefined) {
      // Ended when the next one started: its duration stays the step's, not the time until this scan.
      run = { ...run, status: 'done', updatedAt: successor.since }
      await $.store.set(key, run)
    } else if (isLive(run) && now - run.updatedAt > STALE_MS) {
      run = { ...run, status: 'interrupted' }
      await $.store.set(key, run)
    }
    if (run.repo === undefined || repo === null ? run.root === root : run.repo === repo) runs.push(run)
  }
  return runs.sort((a, b) => a.since - b.since)
}

/** `refresh` from a timer or a hook whose dispatch may be gone: a failure is dropped. */
function refreshQuietly($: EngineInterface): void {
  refresh($).catch(() => undefined)
}

/** Rescans the project and the store, publishes the board, returns it. */
async function refresh($: EngineInterface): Promise<SeloFlowBoard> {
  const root = await $.session.root()
  const now = await $.clock.now()
  const scanned = await scanBoard($, root, now)
  const runs = await readRuns($, root, scanned.repo, now)
  const next: SeloFlowBoard = { ...scanned, runs }
  const appeared = newPlans(await read($, board), next)
  await update($, board, () => next)
  await writeExport($, next).catch(() => undefined)
  // A plan that appears (a `write-plan` session created its folder) is followed at once: an older pick is dropped.
  if (appeared.length > 0) await update($, pickedPlans, m => Object.fromEntries(Object.entries(m).filter(([slug]) => !appeared.includes(slug))))
  return next
}

/**
 * Writes the board for companion apps, one file per project root under the user's Claude Code directory.
 * shortcut: rewritten whole at each rescan, not atomically ($.fs has no rename); a reader retries a file it cannot parse.
 */
async function writeExport($: EngineInterface, b: SeloFlowBoard): Promise<void> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home === undefined ? undefined : `${home}/.claude`)
  if (configDir === undefined) return
  await $.fs.write(exportPath(configDir, b.root), `${JSON.stringify(exportBoard(b), null, 2)}
`)
}

async function startRun($: EngineInterface, run: Pick<SeloFlowBoardRun, 'feature' | 'folder' | 'command' | 'step' | 'lastStep' | 'agentId'>): Promise<void> {
  const sessionId = await $.session.id()
  const now = await $.clock.now()
  const root = await $.session.root()
  const repo = (await read($, board))?.repo ?? null
  const record: SeloFlowBoardRun = { sessionId, root, status: 'running', since: now, updatedAt: now, ...run }
  if (repo !== null) record.repo = repo
  await $.store.set(`${RUN_PREFIX}${sessionId}:${now}`, record)
}

/** The skills whose call, typed or through the Skill tool, starts a run. */
const RUN_SKILLS = new Set(['write-spec', 'write-plan', 'implement', 'review', 'autopilot'])
/** The skills that take a free request: their run starts with no feature, named at its first commit (the spec's, or the fastlane's). */
const REQUEST_SKILLS = new Set(['write-spec', 'implement', 'autopilot'])

/** A `/selo-flow:…` text that names a feature records a run on the step it lands on; `agentId` names the subagent it runs in. */
async function recordRun($: EngineInterface, text: string, agentId?: string): Promise<void> {
  const command = parseSeloFlowCommand(text)
  if (command === null || (command.feature === null && !REQUEST_SKILLS.has(command.skill))) return
  const feature = (await read($, board))?.features.find(f => f.slug === command.feature)
  // `review HEAD`, `review develop`: a range read as a bare slug; only a known area is a spec review.
  if (command.skill === 'review' && command.folder === null && feature === undefined) return
  await startRun($, { feature: command.feature, folder: command.folder, command: command.skill, step: runStep(command, feature && withPlan(feature, command.folder)), lastStep: runLastStep(command), agentId })
  refreshQuietly($)
}

/**
 * A free prompt of a session's main loop follows it as an off-workflow run, when the session has no run yet or its
 * last off-workflow run is over (done, no question pending). A slash command records none; a selo-flow run, live or
 * not, keeps the session: the answer to its commit question, an interrupted autopilot's resume.
 */
async function recordOffWorkflow($: EngineInterface, text: string): Promise<void> {
  if (text.trimStart().startsWith('/')) return
  const latest = (await loopRun($, undefined))?.[1]
  const isOver = latest !== undefined && isOffWorkflow(latest) && latest.status === 'done' && latest.phase !== 'awaiting-commit' && latest.phase !== 'awaiting-answer'
  if (latest !== undefined && !isOver) return
  await startRun($, { feature: null, folder: null, command: OFF_WORKFLOW, step: OFF_WORKFLOW })
  refreshQuietly($)
}

/** The first `/selo-flow:…` line of a subagent's brief, from the command on; null without one. */
function seloFlowLine(prompt: string): string | null {
  const line = prompt.split(/\r?\n/).find(l => l.includes('/selo-flow:'))
  return line === undefined ? null : line.slice(line.indexOf('/selo-flow:'))
}

/** The runs a session recorded, newest first, with their keys. */
async function sessionRuns($: EngineInterface, sessionId: string): Promise<[string, SeloFlowBoardRun][]> {
  const prefix = `${RUN_PREFIX}${sessionId}:`
  const found: [string, SeloFlowBoardRun][] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(prefix)) continue
    const run = (await $.store.get(key)) as SeloFlowBoardRun | undefined
    if (run !== undefined) found.push([key, run])
  }
  return found.sort((a, b) => b[1].since - a[1].since)
}

/** The latest run of a loop of this session: the main loop's (no `agentId`) or a subagent's. */
async function loopRun($: EngineInterface, agentId: string | undefined): Promise<[string, SeloFlowBoardRun] | undefined> {
  return (await sessionRuns($, await $.session.id())).find(([, run]) => run.agentId === agentId)
}

/** The live autopilot of this session's main loop, with its key; undefined without one. */
async function livePilot($: EngineInterface): Promise<[string, SeloFlowBoardRun] | undefined> {
  const latest = await loopRun($, undefined)
  return latest !== undefined && isPilot(latest[1]) && isLive(latest[1]) ? latest : undefined
}

/**
 * The pipeline follows its subagents: it moves to the step of the one it just
 * spawned (`moveStep`), and takes the feature and the plan folder it had not yet
 * (a pipeline from a free request learns its slug at the spec's commit).
 */
async function steerPilot($: EngineInterface, from: Pick<SeloFlowBoardRun, 'feature' | 'folder' | 'step'>, moveStep: boolean): Promise<void> {
  const pilot = await livePilot($)
  if (pilot === undefined) return
  const [key, run] = pilot
  await $.store.set(key, { ...run, step: moveStep ? from.step : run.step, feature: run.feature ?? from.feature, folder: run.folder ?? from.folder, updatedAt: await $.clock.now() })
}

/**
 * A loop of this session committed: its run is done, or, chained, moves to its next stage. A run without a feature
 * takes the commit's scope. An interrupted run that commits was still at work (a subagent resumed in the background).
 */
async function commitRun($: EngineInterface, b: SeloFlowBoard | null, agentId: string | undefined, command: string): Promise<void> {
  const latest = await loopRun($, agentId)
  if (latest === undefined) return
  const [key, run] = latest
  if (run.status === 'done') return
  // An off-workflow run names no feature, whatever its commit's scope.
  const slug = isOffWorkflow(run) ? null : (run.feature ?? commitFeature(command))
  const feature = b?.features.find(f => f.slug === slug)
  const moved = afterCommit(run, feature && withPlan(feature, run.folder))
  await $.store.set(key, { ...run, ...moved, feature: slug, updatedAt: await $.clock.now() })
  if (agentId !== undefined && slug !== null) await steerPilot($, { feature: slug, folder: run.folder, step: run.step }, false)
}

/**
 * A turn of a loop ended: its run waits for the person. The end of an autopilot's
 * turn is the end of the pipeline, unless its latest subagent still works in the
 * background (the pipeline goes on at its hand-back): done when that subagent
 * committed, interrupted otherwise (a blocker, an abort), and its subagents left
 * waiting are interrupted with it.
 */
async function endTurn($: EngineInterface, agentId: string | undefined): Promise<void> {
  const latest = await loopRun($, agentId)
  if (latest === undefined || !isLive(latest[1]) || !isPilot(latest[1])) {
    await touchRun($, 'waiting', agentId)
    return
  }
  const [key, run] = latest
  const now = await $.clock.now()
  const subagents = (await sessionRuns($, run.sessionId)).filter(([, r]) => r.agentId !== undefined && r.since >= run.since)
  const last = subagents[0]?.[1].status
  if (last === 'running') {
    await $.store.set(key, { ...run, updatedAt: now })
    return
  }
  await $.store.set(key, { ...run, status: last === 'done' ? 'done' : 'interrupted', updatedAt: now })
  for (const [k, r] of subagents) if (isLive(r)) await $.store.set(k, { ...r, status: 'interrupted', updatedAt: now })
}

/**
 * The phase of a loop's latest run: at a turn's start, a done run that asked the person (a commit
 * question) is at work again; at its end, the phase is read from the turn's final text (`answer`).
 */
async function markPhase($: EngineInterface, agentId: string | undefined, answer: string | null): Promise<void> {
  const latest = await loopRun($, agentId)
  if (latest === undefined || latest[1].status === 'interrupted') return
  const [key, run] = latest
  if (answer === null) {
    if (run.phase === 'awaiting-commit' || run.phase === 'awaiting-answer') await $.store.set(key, { ...run, phase: 'working' })
    return
  }
  await $.store.set(key, { ...run, ...classifyTurn(answer, run), updatedAt: await $.clock.now() })
}

/**
 * Updates the latest run of a loop of this session, when it has one. A done run stays so until a new `/selo-flow:`
 * prompt; an interrupted one comes back with a turn of its loop (an autopilot woken by a subagent's hand-back).
 */
async function touchRun($: EngineInterface, status: SeloFlowBoardRunStatus, agentId: string | undefined): Promise<void> {
  const latest = await loopRun($, agentId)
  if (latest === undefined) return
  const [key, run] = latest
  if (run.status === status || run.status === 'done') return
  await $.store.set(key, { ...run, status, updatedAt: await $.clock.now() })
}

/**
 * Ticks the `Review` item of a plan's Validation, the review marked done
 * without running it: the plan is finalized, the tick left uncommitted.
 */
async function markReviewDone($: EngineInterface, root: string, folder: string): Promise<void> {
  const file = `${root}/${folder}/plan.md`
  const text = await $.fs.read(file).catch(() => null)
  const ticked = typeof text === 'string' ? tickReview(text) : null
  if (ticked === null) {
    $.ui.toast('Aucun item Review à cocher dans la Validation du plan.')
    return
  }
  await $.fs.write(file, ticked)
  await refresh($)
  $.ui.toast('Review coché dans plan.md : plan finalisé, la coche reste à committer.', { timeoutMs: 8000 })
}

/** Sets one role's model in `selo-flow.yaml`, left uncommitted: the next step launched reads it. */
async function saveModel($: EngineInterface, root: string, role: string, model: string): Promise<void> {
  const file = `${root}/selo-flow.yaml`
  const text = await $.fs.read(file).catch(() => null)
  if (typeof text !== 'string') {
    $.ui.toast('Pas de selo-flow.yaml à la racine du projet.')
    return
  }
  const models = (await read($, board))?.models ?? {}
  await $.fs.write(file, setModels(text, { ...models, [role]: model }))
  await refresh($)
  $.ui.toast(`${role} : ${model} dans selo-flow.yaml, à committer. Vaut pour la prochaine étape lancée.`, { timeoutMs: 8000 })
}

const STATE_LABEL: Record<SeloFlowBoardFeature['state'], string> = {
  empty: 'sans spec',
  spec: 'spec seule',
  plan: 'plan prêt',
  running: 'en cours',
  review: 'à valider',
  done: 'plan finalisé',
}

/** Theme keys, so the pane follows the person's theme on every surface. */
const STATE_COLOR: Record<SeloFlowBoardFeature['state'], string> = {
  empty: 'inactive',
  spec: 'warning',
  plan: 'success',
  running: 'claude',
  review: 'permission',
  done: 'success',
}

const RUN_GLYPH: Record<SeloFlowBoardRunStatus, string> = { running: '●', waiting: '○', done: '✓', interrupted: '!' }

const RUN_LABEL: Record<SeloFlowBoardRunStatus, string> = {
  running: 'en cours',
  waiting: 'attend une réponse',
  done: 'terminé',
  interrupted: 'interrompue',
}

/** An autopilot that did not finish stopped on a blocker or was aborted: it resumes with the same command. */
const runLabel = (run: SeloFlowBoardRun): string => (isPilot(run) && run.status === 'interrupted' ? 'arrêté · à reprendre' : RUN_LABEL[run.status])

/** The tinted ground of a pill, by its theme key; the terminal draws none. */
const PILL_BG: Record<string, string> = {
  success: 'rgba(79,191,122,0.18)',
  warning: 'rgba(224,160,90,0.2)',
  claude: 'rgba(217,119,87,0.2)',
  permission: 'rgba(150,130,230,0.2)',
  inactive: 'rgba(140,140,140,0.18)',
}

const SEP = '  ·  '

/** Every chip: the folded finalized features shown on top of all the others. */
const ALL_FILTERS: SeloFlowBoardFilter[] = ['running', 'review', 'plan', 'no-plan', 'done']

/** The context tokens of this session, as the status line counts them; null where the host keeps none. */
async function sessionTokens($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).context.tokens ?? null
  } catch {
    return null
  }
}

const tokensLabel = (n: number): string => (n >= 1000 ? `${Math.round(n / 1000)}k tokens` : `${n} tokens`)

const RUN_COLOR: Record<SeloFlowBoardRunStatus, string> = {
  running: 'success',
  waiting: 'warning',
  done: 'success',
  interrupted: 'warning',
}

const SKILL_LABEL: Record<string, string> = {
  implement: 'Implémentation',
  'write-plan': 'Plan',
  'write-spec': 'Spec',
  review: 'Revue',
  autopilot: 'Autopilot',
}

/** The prompt that resumes an autopilot where its Progress is: from its plan folder, else its slug. */
const resumePrompt = (run: SeloFlowBoardRun): string | null => (run.feature === null ? null : `/selo-flow:autopilot ${run.folder ?? run.feature}`)

/** One cell per stage: done, the one at hand, later. */
function bar(stages: SeloFlowBoardStage[], next: number | null): string {
  return stages.map(s => (isStageDone(s) ? '█' : s.number === next ? '▓' : '░')).join('')
}

/** One segment per stage, for the surfaces that draw vectors. */
function segmentsSvg(stages: SeloFlowBoardStage[], next: number | null): string {
  const w = 22
  const gap = 3
  const width = Math.max(1, stages.length * (w + gap) - gap)
  const rects = stages
    .map((s, i) => {
      const fill = isStageDone(s) ? GREEN : s.number === next ? ORANGE : SLATE
      const opacity = !isStageDone(s) && s.number === next ? ' fill-opacity="0.6"' : ''
      return `<rect x="${i * (w + gap)}" y="0" width="${w}" height="8" rx="2" fill="${fill}"${opacity}/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="8" viewBox="0 0 ${width} 8">${rects}</svg>`
}

function age(now: number, since: number): string {
  const minutes = Math.max(0, Math.round((now - since) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}

/** A plan in the picker: its folder name (timestamp first), a draft said so. */
const planLabel = (plan: SeloFlowBoardPlan): string => `${plan.folder.split('/').at(-1) ?? plan.folder}${plan.isDraft ? ' (brouillon)' : ''}`

type Marker = SeloFlowBoardMarker

/** The timeline's raw colors: an Svg is drawn as an image, out of reach of the theme keys. */
const GREEN = '#2f9e5b'
const ORANGE = '#d97757'
const GREY = '#8b8b8b'
const SLATE = '#3a3a3a'

const MARKER_SVG: Record<Marker, string> = {
  done: `<circle cx="9" cy="9" r="8" fill="${GREEN}"/><path d="M5.3 9.4l2.4 2.4 5-5.1" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  // A faint ring, an arc turning on it (SMIL: plays only in an `isInteractive` Svg), the dot.
  running:
    `<circle cx="9" cy="9" r="7" fill="none" stroke="${ORANGE}" stroke-opacity="0.3" stroke-width="2"/>` +
    `<circle cx="9" cy="9" r="7" fill="none" stroke="${ORANGE}" stroke-width="2" stroke-linecap="round" stroke-dasharray="11 33">` +
    `<animateTransform attributeName="transform" type="rotate" from="0 9 9" to="360 9 9" dur="1s" repeatCount="indefinite"/></circle>` +
    `<circle cx="9" cy="9" r="3.5" fill="${ORANGE}"/>`,
  next: `<circle cx="9" cy="9" r="7" fill="none" stroke="${ORANGE}" stroke-width="2"/>`,
  pending: `<circle cx="9" cy="9" r="7" fill="none" stroke="${GREY}" stroke-opacity="0.7" stroke-width="1.5"/>`,
}

const markerSvg = (marker: Marker): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">${MARKER_SVG[marker]}</svg>`

/** A rail far taller than any step: the Box that holds it clips it to the step's height. */
const RAIL_HEIGHT = 2000
const railSvg = (color: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="${RAIL_HEIGHT}" viewBox="0 0 18 ${RAIL_HEIGHT}"><line x1="9" y1="0" x2="9" y2="${RAIL_HEIGHT}" stroke="${color}" stroke-opacity="0.55" stroke-width="2"/></svg>`

const MARKER_GLYPH: Record<Marker, string> = { done: '✓', running: '◉', next: '○', pending: '○' }
const MARKER_COLOR: Record<Marker, string> = { done: 'success', running: 'claude', next: 'claude', pending: 'inactive' }
const MARKER_ALT: Record<Marker, string> = { done: 'fait', running: 'en cours', next: 'à faire', pending: 'plus tard' }

/** A press that fills the prompt box with the command; where no box takes it, copies it instead. */
function preparePrompt($: EngineInterface, prompt: string): (press: UiPressArgument) => Promise<void> {
  return async press => {
    const filled = await $.prompt.fill({ text: prompt, mode: 'replace' })
    if (filled.isFilled) {
      $.ui.toast('Prompt prêt dans la zone de saisie : Entrée pour lancer.')
    } else {
      const copied = await $.ui.copy({ text: prompt, surface: press.surface })
      $.ui.toast(copied.isCopied ? 'Prompt copié dans le presse-papiers.' : 'Impossible de préparer le prompt ici.')
    }
  }
}

function copyPrompt($: EngineInterface, prompt: string): (press: UiPressArgument) => Promise<void> {
  return async press => {
    const copied = await $.ui.copy({ text: prompt, surface: press.surface })
    $.ui.toast(copied.isCopied ? 'Prompt copié dans le presse-papiers.' : 'Pas de presse-papiers sur cette surface.')
  }
}

export const register: Register = on => {
  /** The loaded plugin.json's version, in the pane's header: tells which build the session runs. */
  let version = ''

  on('session.start', async ($, e, next) => {
    version = await $.fs
      .read(`${$.plugin.root}/.claude-plugin/plugin.json`)
      .then(text => String(JSON.parse(text).version ?? ''))
      .catch(() => '')
    await $.command.register({
      name: COMMAND,
      description: 'Ouvre le tableau des features du projet, leurs plans et les stages en cours',
    })
    const root = await $.session.root()
    const hasPlanning = await $.fs.exists(`${root}/.planning/features`)
    if (hasPlanning && e.surface !== null && e.surface !== 'terminal') {
      void openPane($)
    }
    if (hasPlanning) {
      await refresh($)
      $.clock.every(POLL_MS, () => refreshQuietly($))
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await openPane($, true)
    const b = await refresh($)
    return { text: b.error ?? `Tableau selo-flow ouvert : ${b.features.length} feature(s).` }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await update($, isPaneOpen, () => false)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await recordRun($, e.text)
    await recordOffWorkflow($, e.text)
    return next(e)
  }).catch(($, e, next) => next(e))

  // A session driven by a brief calls the skills through the Skill tool, never from a typed prompt.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const skill = e.skill.replace(/^selo-flow:/, '')
    if (e.agentId === undefined && RUN_SKILLS.has(skill)) await recordRun($, `/selo-flow:${skill} ${e.args ?? ''}`)
    return next(e)
  }).catch(($, e, next) => next(e))

  // A subagent whose brief carries a `/selo-flow:` command (the autopilot's steps) is a run of its own,
  // followed by its loop's id: its turns, its commit and its end are its run's, not the main loop's.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const line = seloFlowLine(e.prompt)
    if (e.parentAgentId === undefined && started.agentId !== undefined && line !== null) {
      await recordRun($, line, started.agentId)
      // An autopilot's step is the one its subagent at work is on.
      const subagent = await loopRun($, started.agentId)
      if (subagent !== undefined) await steerPilot($, subagent[1], true)
    }
    return started
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    await touchRun($, 'running', e.agentId)
    await markPhase($, e.agentId, null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await endTurn($, e.agentId)
    await markPhase($, e.agentId, e.answer)
    refreshQuietly($)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const isCommit = /\bgit\b[^|&;\n]*\bcommit\b/.test(e.command)
    if (isCommit && ran.deny === undefined && ran.isError !== true) {
      // Every selo-flow skill ends its job with its commit (spec, plan, stage, review).
      const before = await read($, board)
      await commitRun($, before, e.agentId, e.command)
      const after = await refresh($)
      for (const line of committed(before, after)) $.ui.toast(line, { timeoutMs: 8000 })
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    for (const [key, run] of await sessionRuns($, e.sessionId)) {
      if (isLive(run)) await $.store.set(key, { ...run, status: 'interrupted' })
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const b = await read($, board)
    if (e.props.hasSurvey || b === null || b.error !== null) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const isOpen = await read($, isPaneOpen)
    const picked = await read($, pickedPlans)
    const sessionId = await $.session.id()
    const mine = b.runs.filter(r => r.sessionId === sessionId)
    const main = mine.filter(r => r.agentId === undefined).at(-1)
    // An autopilot session shows its pipeline, at the step its subagent works on, not that subagent's run.
    const run = main !== undefined && isPilot(main) ? main : mine.at(-1)
    const found = run ? b.features.find(f => f.slug === run.feature) : undefined
    const feature = found && run ? withPlan(found, run.folder) : undefined
    const others = b.runs.filter(r => r.sessionId !== sessionId && isLive(r)).length
    const tokens = await sessionTokens($)
    const detail = run && feature ? stepDetail(feature, run.step) : ''
    // The run is over (its commit made): the band offers the plan's next step, so the pane need not be opened.
    // An autopilot that stopped offers its own resume, where the Progress is.
    const resume = run && isPilot(run) && run.status === 'interrupted' ? resumePrompt(run) : null
    const after = resume !== null ? { label: "Reprendre l'autopilot", prompt: resume } : run && !isLive(run) && found ? nextAction(withPlan(found, picked[found.slug])) : null
    const pill = (color: string, label: string) => (
      <Text color={color} backgroundColor={e.surface === 'terminal' ? undefined : PILL_BG[color]} weight="semibold">
        {` ${label} `}
      </Text>
    )

    return (
      <Box justifyContent="space-between" alignItems="center" gap={1}>
        <Text wrap="truncate-end">
          <Text weight="semibold" color="claude">
            selo-flow
          </Text>
          {run ? (
            <Text>
              <Text dimColor>{SEP}</Text>
              <Text weight="semibold">{runTitle(run, feature)}</Text>
              {detail ? <Text dimColor mono tabular>{` ${detail}`}</Text> : ''}
              <Text dimColor>{SEP}</Text>
              {run.feature ?? <Text dimColor>{featureLabel(run)}</Text>}
              <Text dimColor>{SEP}</Text>
              {pill(RUN_COLOR[run.status], `${RUN_GLYPH[run.status]} ${runLabel(run)}${isLive(run) ? ` · ${age(b.scannedAt, run.since)}` : ''}`)}
            </Text>
          ) : (
            <Text dimColor>{`${SEP}aucune étape selo-flow dans cette session`}</Text>
          )}
          {tokens !== null && <Text dimColor>{`${SEP}${tokensLabel(tokens)}`}</Text>}
          {others > 0 && <Text dimColor>{`${SEP}${others} autre(s) session(s)`}</Text>}
        </Text>
        <Box gap={1} alignItems="center">
          {after && <Button key="next-step" variant="primary" label={after.label} onPress={preparePrompt($, after.prompt)} />}
          <Button key="toggle-pane" label={isOpen ? 'Fermer le tableau' : 'Ouvrir le tableau'} onPress={() => (isOpen ? closePane($) : openPane($, true))} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    /** The graphical surfaces draw the timeline's markers and rail as vectors; the terminal, as glyphs. */
    const Svg = 'Svg' in elements ? elements.Svg : undefined
    /** The mobile app draws no Select: there the card keeps the latest plan. */
    const Select = 'Select' in elements ? elements.Select : undefined
    const b = await read($, board)
    const open = await read($, expanded)
    const picked = await read($, pickedPlans)
    const noBrowserOn = await read($, noBrowserTest)
    const filtering = await read($, stateFilters)
    const isConfig = await read($, isConfigOpen)
    const history = await read($, openHistory)
    const toggleBrowser = async () => void update($, noBrowserTest, ticked => !ticked)
    /** The header's button: the autopilot of a feature that does not exist yet, its request typed after the command. */
    const newFeature = async (press: UiPressArgument) => {
      const text = '/selo-flow:autopilot '
      const filled = await $.prompt.fill({ text, mode: 'replace' })
      if (filled.isFilled) {
        $.ui.toast('Décris la feature à la suite du prompt, puis Entrée : spec, plan, stages et revue, sans un clic.', { timeoutMs: 8000 })
      } else {
        const copied = await $.ui.copy({ text, surface: press.surface })
        $.ui.toast(copied.isCopied ? 'Commande copiée : colle-la et décris la feature à sa suite.' : 'Impossible de préparer le prompt ici.')
      }
    }
    const sessionId = await $.session.id()
    const now = b?.scannedAt ?? 0
    const prepare = (prompt: string) => preparePrompt($, prompt)
    const copy = (prompt: string) => copyPrompt($, prompt)
    const who = (run: SeloFlowBoardRun) => (run.sessionId === sessionId ? 'cette session' : `session ${run.sessionId.slice(0, 8)}`)
    const pill = (color: string, label: string) => (
      <Text color={color} backgroundColor={e.surface === 'terminal' ? undefined : PILL_BG[color]} weight="semibold" wrap="truncate-end">
        {` ${label} `}
      </Text>
    )
    const runPill = (run: SeloFlowBoardRun) => pill(RUN_COLOR[run.status], `${RUN_GLYPH[run.status]} ${runLabel(run)}${isLive(run) ? ` · ${age(now, run.since)}` : ''}`)

    if (b === null) {
      return (
        <Box>
          <Text dimColor>Lecture de .planning…</Text>
        </Box>
      )
    }
    if (b.error !== null) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{b.error}</Text>
          <Box>
            <Button key="refresh" label="Rafraîchir" onPress={() => refreshQuietly($)} />
          </Box>
        </Box>
      )
    }

    // A live `write-plan` writing a new plan wins over the pick: the card shows the plan on its way.
    const features = followedFeatures(b, picked)
    const project = b.root.split(/[\\/]/).filter(Boolean).at(-1) ?? b.root
    const live = liveRuns(b.runs)
    const noPlan = features.filter(f => f.plan === null).length
    const stagesLeft = features.reduce((n, f) => n + (f.plan?.stages.filter(s => !isStageDone(s)).length ?? 0), 0)

    const matches = (f: SeloFlowBoardFeature, filter: SeloFlowBoardFilter): boolean =>
      filter === 'no-plan' ? f.plan === null : f.state === filter
    const count = (filter: SeloFlowBoardFilter) => features.filter(f => matches(f, filter)).length
    const visible = filtering.length === 0 ? features : features.filter(f => filtering.some(filter => matches(f, filter)))
    // The chips add up: a press adds its features to those shown, a second press takes them away, `features` shows all.
    const chip = (key: SeloFlowBoardFilter | 'all', label: string, value: number, color?: string) => {
      const isOn = key === 'all' ? filtering.length === 0 : filtering.includes(key)
      const toggle = (f: SeloFlowBoardFilter[]) => (key === 'all' ? [] : f.includes(key) ? f.filter(x => x !== key) : [...f, key])
      return (
        <Button key={`filter:${key}`} plain onPress={() => update($, stateFilters, toggle)}>
          <Text color={isOn ? 'claude' : undefined} weight={isOn ? 'semibold' : 'regular'}>
            {color && value > 0 ? <Text color={color}>{'● '}</Text> : ''}
            <Text weight="semibold" tabular>
              {String(value)}
            </Text>
            {` ${label}`}
          </Text>
        </Button>
      )
    }

    const card = (feature: SeloFlowBoardFeature) => {
      const plan = feature.plan
      const runs = b.runs.filter(r => r.feature === feature.slug)
      const isNewPlan = plan === null && feature.plans.length > 0
      const pilot = featurePilot(feature.slug, b.runs)
      const action = featureAction(feature, b.runs, { noBrowser: noBrowserOn })
      const isOpen = open === feature.slug
      const stagesDone = plan ? plan.stages.filter(isStageDone).length : 0
      const stagesTotal = plan ? plan.stages.length : 0
      const active = activeStep(feature)
      const nextNumber = Number(/^stage:(\d+)$/.exec(active)?.[1] ?? NaN) || null
      const stateColor = isNewPlan ? 'claude' : STATE_COLOR[feature.state]
      const stateLabel = isNewPlan ? 'nouveau plan en cours' : STATE_LABEL[feature.state]
      const specLine = feature.hasSpec ? 'spec présente' : 'pas de spec'

      const row = (step: SeloFlowBoardStep, isLast: boolean) => {
        const isDone = isStepDone(feature, step)
        const isActive = step === active
        const [latest, ...older] = stepRuns(feature, b.runs, step)
        const marker = stepMarker(feature, b.runs, step)
        const detail = stepDetail(feature, step)
        const historyKey = `${feature.slug}:${step}`
        const isHistoryOpen = history === historyKey
        const line = (run: SeloFlowBoardRun) => (
          <Box key={`run:${run.sessionId}:${run.since}`}>
            <Text size="caption" dimColor wrap="truncate-end">
              {stamp(run.since)} · {age(isLive(run) ? now : run.updatedAt, run.since)} · {who(run)}
              {run.status !== 'done' ? <Text>{'  '}{runPill(run)}</Text> : ''}
            </Text>
          </Box>
        )

        // The rail: an absolute Box spanning the step under its marker, clipped to it, so it
        // stretches with whatever the step holds; the step's spacing is padding, inside the rail.
        return (
          <Box key={`step:${feature.slug}:${step}`} flexDirection="column" paddingLeft={3} paddingBottom={isLast ? 0 : 1}>
            {!isLast && (
              <Box position="absolute" left={0} top={1} bottom={0} width={Svg ? 3 : 1} overflow="hidden">
                {Svg ? (
                  <Svg source={railSvg(isDone ? GREEN : GREY)} alt="rail" width={18} height={RAIL_HEIGHT} />
                ) : (
                  <Text color={isDone ? 'success' : 'inactive'}>{'│\n'.repeat(80)}</Text>
                )}
              </Box>
            )}
            <Box position="absolute" left={0} top={0}>
              {Svg ? (
                <Svg source={markerSvg(marker)} alt={MARKER_ALT[marker]} width={18} height={18} isInteractive={marker === 'running'} />
              ) : (
                <Text color={MARKER_COLOR[marker]}>{MARKER_GLYPH[marker]}</Text>
              )}
            </Box>
            <Box justifyContent="space-between" gap={1} flexWrap="wrap" alignItems="center">
              <Box gap={1} alignItems="center" flexWrap="wrap">
                <Text weight={isActive || marker === 'running' ? 'semibold' : 'regular'} dimColor={marker === 'pending'} wrap="truncate-end">
                  {stepTitle(feature, step)}
                </Text>
                {step === 'plan' && Select && plan && feature.plans.length > 1 && (
                  <Select
                    key={`plan:${feature.slug}`}
                    options={feature.plans.map(p => ({ value: p.folder, label: planLabel(p) }))}
                    value={plan.folder}
                    onSelect={folder => void update($, pickedPlans, m => ({ ...m, [feature.slug]: folder }))}
                  />
                )}
                {step === 'plan' && feature.hasSpec && plan && <Button key={`new-plan:${feature.slug}`} plain dimColor label="+ Nouveau plan" onPress={prepare(`/selo-flow:write-plan ${feature.slug}`)} />}
              </Box>
              <Text color={isDone ? 'success' : undefined} dimColor={!isDone} mono tabular>
                {detail}
              </Text>
            </Box>
            {step === 'plan' && (
              <Text size="caption" dimColor wrap="truncate-end">
                {plan ? (
                  <Text>
                    <Text mono>{planLabel(plan)}</Text>
                    {feature.plans.length > 1 ? ` · ${feature.plans.length} plans` : ''}
                  </Text>
                ) : isNewPlan ? (
                  'Nouveau plan en cours d’écriture : il s’affiche ici dès que son dossier existe.'
                ) : feature.hasSpec ? (
                  'Pas encore de plan : la spec attend son plan.'
                ) : (
                  'Ni spec ni plan : tout commence par la spec.'
                )}
              </Text>
            )}
            {latest && line(latest)}
            {older.length > 0 && (
              <Button key={`history:${feature.slug}:${step}`} plain dimColor label={`${isHistoryOpen ? '▾' : '▸'} ${older.length} essai(s) précédent(s)`} onPress={() => update($, openHistory, h => (h === historyKey ? null : historyKey))} />
            )}
            {isHistoryOpen && older.map(line)}
            {isActive && pilot && (
              <Text size="caption" dimColor wrap="truncate-end">
                ⚡ Autopilot en cours sur cette feature : les prompts reviennent quand il s’arrête.
              </Text>
            )}
            {isActive && action && (
              <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="claude" paddingX={1}>
                <Box gap={1} flexWrap="wrap" alignItems="center">
                  <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />
                  {action.all && <Button key={`all:${feature.slug}`} label={action.all.label} onPress={prepare(action.all.prompt)} />}
                  {plan && feature.state === 'review' && (
                    <Button key={`mark-review:${feature.slug}`} label="Marquer comme fait" onPress={() => markReviewDone($, b.root, plan.folder)} />
                  )}
                  {plan && <Button key={`review:${feature.slug}`} label="Revue du plan" onPress={prepare(`/selo-flow:review plan ${plan.folder}`)} />}
                  <Button key={`copy:${feature.slug}`} plain dimColor label="⧉ Copier" onPress={copy(action.prompt)} />
                </Box>
                {action.autopilot && (
                  <Box gap={1} flexWrap="wrap" alignItems="center">
                    <Button key={`autopilot:${feature.slug}`} label={action.autopilot.label} onPress={prepare(action.autopilot.prompt)} />
                    <Button key={`browser-test:${feature.slug}`} plain label={`${noBrowserOn ? '☑' : '☐'} Sans test navigateur`} onPress={toggleBrowser} />
                    <Text size="caption" dimColor wrap="truncate-end">
                      le reste de la feature sans un clic, chaque étape committée
                    </Text>
                  </Box>
                )}
                <Text size="caption" dimColor mono wrap="truncate-end">
                  {action.prompt}
                </Text>
              </Box>
            )}
          </Box>
        )
      }

      return (
        <Box
          key={`feature:${feature.slug}`}
          flexDirection="column"
          marginTop={1}
          paddingX={1}
          borderStyle="round"
          borderColor={stateColor}
          borderDimColor={!isOpen && !runs.some(isLive)}
        >
          <Box gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between">
            <Box gap={1} alignItems="center" flexWrap="wrap" flexGrow={1} minWidth={24}>
              <Button key={`row:${feature.slug}`} plain onPress={() => update($, expanded, () => (isOpen ? null : feature.slug))}>
                {isOpen ? '▾ ' : '▸ '}
                <Text weight="semibold">{feature.slug}</Text>
              </Button>
              {pill(stateColor, `${stateLabel}${plan?.isDraft ? ' · brouillon' : ''}`)}
              {pilot && pill('claude', `⚡ autopilot · ${stepTitle(feature, pilot.step)}`)}
              {plan ? (
                <Box gap={1} alignItems="center">
                  {Svg ? (
                    <Svg source={segmentsSvg(plan.stages, nextNumber)} alt={`${stagesDone} stage(s) sur ${stagesTotal}`} width={Math.max(1, stagesTotal * 25 - 3)} height={8} />
                  ) : (
                    <Text color={stagesDone === stagesTotal ? 'success' : 'claude'}>{bar(plan.stages, nextNumber)}</Text>
                  )}
                  <Text dimColor tabular>
                    {stagesDone}/{stagesTotal}
                  </Text>
                </Box>
              ) : (
                <Text dimColor>{specLine}</Text>
              )}
            </Box>
            {!isOpen && action && <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />}
          </Box>
          {feature.title !== feature.slug && (
            <Box paddingLeft={2}>
              <Text size="caption" dimColor wrap="truncate-end">
                {feature.title}
              </Text>
            </Box>
          )}
          {isOpen && (
            <Box flexDirection="column" marginTop={1} paddingLeft={1}>
              {steps(feature).map((step, index, all) => row(step, index === all.length - 1))}
            </Box>
          )}
        </Box>
      )
    }

    const group = (filter: SeloFlowBoardFilter | 'spec' | 'empty' | 'plan', label: string) => {
      const inGroup = visible.filter(f => (filter === 'no-plan' ? f.plan === null : f.state === filter))
      if (inGroup.length === 0) return ''
      return (
        <Box key={`group:${filter}`} flexDirection="column" marginTop={1}>
          <Box paddingX={1}>
            <Text size="caption" dimColor>
              {label}
            </Text>
          </Box>
          {inGroup.map(card)}
        </Box>
      )
    }
    const done = features.filter(f => f.state === 'done')
    // The finalized features stay folded, unless asked for or one of them is the card unfolded (an older plan picked).
    const isDoneShown = filtering.includes('done') || done.some(f => f.slug === open)
    const models = b.models

    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between" alignItems="center" gap={1} paddingX={1}>
          <Text wrap="truncate-end">
            <Text weight="semibold">selo-flow</Text>
            <Text dimColor>
              {version ? ` v${version}` : ''}
              {'  '}
              {project}
            </Text>
            {b.branch && (
              <Text>
                <Text dimColor>{SEP}</Text>
                <Text weight="semibold" mono>
                  {b.branch}
                </Text>
                {'  '}
                {b.changedCount > 0 ? pill('warning', `${b.changedCount} fichier(s) non commité(s)`) : <Text dimColor>rien à committer</Text>}
              </Text>
            )}
          </Text>
          <Box gap={1} alignItems="center">
            <Button key="config" label={isConfig ? '← Features' : '⚙ Modèles'} onPress={() => update($, isConfigOpen, o => !o)} />
            <Button key="new-autopilot" label="⚡ Nouvelle feature" onPress={newFeature} />
            <Button key="refresh" plain dimColor label="⟳" onPress={() => refreshQuietly($)} />
          </Box>
        </Box>

        {isConfig && (
          <Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
            <Text size="caption" dimColor>
              Modèles des rôles · selo-flow.yaml, preset standard
            </Text>
            {MODEL_ROLES.map(role => {
              const model = models[role] ?? ''
              const choices = MODEL_CHOICES.includes(model) ? MODEL_CHOICES : [...MODEL_CHOICES, model]
              return (
                <Box key={`role:${role}`} gap={2} alignItems="center">
                  <Box width={14}>
                    <Text>{role}</Text>
                  </Box>
                  {Select ? (
                    <Select key={`model:${role}`} options={choices.map(c => ({ value: c, label: c }))} value={model} onSelect={next => saveModel($, b.root, role, next)} />
                  ) : (
                    // No Select on this surface: a press moves to the next model.
                    <Button key={`model:${role}`} label={`${model} ↻`} onPress={() => saveModel($, b.root, role, choices[(choices.indexOf(model) + 1) % choices.length] ?? model)} />
                  )}
                </Box>
              )
            })}
            <Text size="caption" dimColor>
              Le changement est écrit dans selo-flow.yaml, à committer ; il vaut pour la prochaine étape lancée, pas pour un autopilot déjà en cours.
            </Text>
          </Box>
        )}

        {!isConfig && (
          <Box flexDirection="column">
            <Box gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between" marginTop={1} paddingX={1}>
              <Box gap={2} flexWrap="wrap" alignItems="center">
                {chip('all', 'features', b.features.length)}
                {chip('running', 'en cours', count('running'), 'claude')}
                {chip('review', 'à valider', count('review'), 'permission')}
                {chip('plan', 'plan prêt', count('plan'), 'success')}
                {chip('no-plan', 'sans plan', noPlan, 'warning')}
                {chip('done', 'finalisée(s)', done.length, 'success')}
              </Box>
              <Box key="stages-left">
                <Text dimColor tabular>
                  {stagesLeft} stage(s) restant(s)
                </Text>
              </Box>
            </Box>

            {live.length > 0 && (
              <Box flexDirection="column" marginTop={1} paddingX={1}>
                <Text size="caption" dimColor>
                  Sessions actives · {live.length}
                </Text>
                {live.map(run => {
                  const found = b.features.find(f => f.slug === run.feature)
                  const feature = found && withPlan(found, run.folder)
                  const plan = runPlan(run, found)
                  const stepAt = plan && /^stage:\d+$|^review$/.test(run.step) && feature ? stepDetail(feature, run.step) : ''
                  // A click unfolds the feature on the run's plan.
                  const follow = async () => {
                    const slug = run.feature
                    if (slug === null) return
                    await update($, expanded, () => slug)
                    if (plan) await update($, pickedPlans, m => ({ ...m, [slug]: plan.folder }))
                  }
                  return (
                    <Box key={`card:${run.sessionId}:${run.since}`} justifyContent="space-between" gap={1} alignItems="center" borderStyle="round" borderColor={RUN_COLOR[run.status]} borderDimColor paddingX={1}>
                      <Button key={`live:${run.sessionId}:${run.since}`} plain onPress={follow}>
                        <Text color={RUN_COLOR[run.status]}>{`${RUN_GLYPH[run.status]} `}</Text>
                        <Text weight="semibold">{featureLabel(run)}</Text>
                        <Text dimColor>{`  ${runTitle(run, feature)}`}</Text>
                        {stepAt ? <Text dimColor mono tabular>{` ${stepAt}`}</Text> : ''}
                      </Button>
                      <Text wrap="truncate-end">
                        {runPill(run)}
                        <Text size="caption" dimColor>{`  ${who(run)}`}</Text>
                      </Text>
                    </Box>
                  )
                })}
              </Box>
            )}

            {features.length === 0 && (
              <Box flexDirection="column" marginTop={1} paddingX={1}>
                <Text dimColor>Aucune feature sous .planning/features.</Text>
                <Text dimColor>
                  Lance <Text mono>/selo-flow:write-spec</Text> pour en créer une, ou <Text mono>/selo-flow:autopilot {'{demande}'}</Text> pour tout faire d’un coup.
                </Text>
              </Box>
            )}

            {group('running', 'En cours')}
            {group('review', 'À valider')}
            {group('plan', 'Plan prêt')}
            {group('spec', 'Spec seule')}
            {group('empty', 'Sans spec')}
            {isDoneShown ? (
              group('done', 'Finalisées')
            ) : done.length > 0 ? (
              <Box marginTop={1} paddingX={1}>
                <Button key="show-done" plain dimColor label={`▸ ${done.length} feature(s) finalisée(s) · ${done.map(f => f.slug).join(', ')}`} onPress={() => update($, stateFilters, f => (f.length === 0 ? ALL_FILTERS : [...f, 'done']))} />
              </Box>
            ) : (
              ''
            )}
          </Box>
        )}
      </Box>
    )
  })
}
