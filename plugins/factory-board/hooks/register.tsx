/**
 * factory-board: a pane that follows the factory's features, their dev plans
 * and the sessions working on them, and prepares the next `/factory:` prompt.
 *
 * Source of truth: `.planning/features/*` and git, rescanned on a timer, on
 * each `git commit` and on each turn's end. The mod keeps one thing of its
 * own, in `$.store`: the runs, which session worked on which step of which
 * feature, written when a `/factory:` prompt is submitted and kept as history.
 */

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiPressArgument } from 'claude-code'

import type { FactoryBoard, FactoryBoardFeature, FactoryBoardFilter, FactoryBoardPlan, FactoryBoardRun, FactoryBoardRunStatus, FactoryBoardStage, FactoryBoardStep } from '../types'
import { activeStep, afterCommit, committed, describeRun, isFinalized, isRunOfPlan, isStepDone, newPlans, nextAction, onNewPlan, parseFactoryCommand, runLastStep, runPlan, runStep, runTitle, stamp, stepTitle, steps, tickReview, withPlan } from './planning'
import { scanBoard } from './scan'

const PANE = 'factory-board'
const COMMAND = 'factory-board'
const RUN_PREFIX = 'run:'
/** A live run nobody touched for a day is a session that died: interrupted. */
const STALE_MS = 24 * 60 * 60 * 1000
/** A run older than a month leaves the history. */
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000
const POLL_MS = 10_000

const board = atom({ plugin: 'factory-board', key: 'board' } as const, null)
const expanded = atom({ plugin: 'factory-board', key: 'expanded' } as const, null)
const isPaneOpen = atom({ plugin: 'factory-board', key: 'isPaneOpen' } as const, false)
const pickedPlans = atom({ plugin: 'factory-board', key: 'pickedPlans' } as const, {})
const reviewStage = atom({ plugin: 'factory-board', key: 'reviewStage' } as const, false)
const stateFilter = atom({ plugin: 'factory-board', key: 'stateFilter' } as const, null)
const openHistory = atom({ plugin: 'factory-board', key: 'openHistory' } as const, null)

const isLive = (run: FactoryBoardRun): boolean => run.status === 'running' || run.status === 'waiting'

async function openPane($: EngineInterface, focus = false): Promise<void> {
  await $.ui.open(focus ? { id: PANE, title: 'Factory', focus: true } : { id: PANE, title: 'Factory' })
  await update($, isPaneOpen, () => true)
}

async function closePane($: EngineInterface): Promise<void> {
  await $.ui.close({ id: PANE })
  await update($, isPaneOpen, () => false)
}

/**
 * Every run of the repository, oldest first; prunes the old ones and interrupts the silent ones on the way.
 * A run from another worktree of the same repository counts: its `repo` is the same git common dir.
 * A record without `repo` (written before it existed) is kept on its root.
 */
async function readRuns($: EngineInterface, root: string, repo: string | null, now: number): Promise<FactoryBoardRun[]> {
  const runs: FactoryBoardRun[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(RUN_PREFIX)) continue
    let run = (await $.store.get(key)) as FactoryBoardRun | undefined
    if (run === undefined) continue
    if (now - run.updatedAt > HISTORY_MS) {
      await $.store.delete(key)
      continue
    }
    if (isLive(run) && now - run.updatedAt > STALE_MS) {
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
async function refresh($: EngineInterface): Promise<FactoryBoard> {
  const root = await $.session.root()
  const now = await $.clock.now()
  const scanned = await scanBoard($, root, now)
  const runs = await readRuns($, root, scanned.repo, now)
  const next: FactoryBoard = { ...scanned, runs }
  const appeared = newPlans(await read($, board), next)
  await update($, board, () => next)
  // A plan that appears (a `write-plan` session created its folder) is followed at once: an older pick is dropped.
  if (appeared.length > 0) await update($, pickedPlans, m => Object.fromEntries(Object.entries(m).filter(([slug]) => !appeared.includes(slug))))
  return next
}

async function startRun($: EngineInterface, run: Pick<FactoryBoardRun, 'feature' | 'folder' | 'command' | 'step' | 'lastStep' | 'agentId'>): Promise<void> {
  const sessionId = await $.session.id()
  const now = await $.clock.now()
  const root = await $.session.root()
  const repo = (await read($, board))?.repo ?? null
  const record: FactoryBoardRun = { sessionId, root, status: 'running', since: now, updatedAt: now, ...run }
  if (repo !== null) record.repo = repo
  await $.store.set(`${RUN_PREFIX}${sessionId}:${now}`, record)
}

/** The skills whose call, typed or through the Skill tool, starts a run. */
const RUN_SKILLS = new Set(['write-spec', 'write-plan', 'implement', 'review'])

/** A `/factory:…` text that names a feature records a run on the step it lands on; `agentId` names the subagent it runs in. */
async function recordRun($: EngineInterface, text: string, agentId?: string): Promise<void> {
  const command = parseFactoryCommand(text)
  if (command === null || command.feature === null) return
  const feature = (await read($, board))?.features.find(f => f.slug === command.feature)
  await startRun($, { feature: command.feature, folder: command.folder, command: command.skill, step: runStep(command, feature && withPlan(feature, command.folder)), lastStep: runLastStep(command), agentId })
  refreshQuietly($)
}

/** The first `/factory:…` line of a subagent's brief, from the command on; null without one. */
function factoryLine(prompt: string): string | null {
  const line = prompt.split(/\r?\n/).find(l => l.includes('/factory:'))
  return line === undefined ? null : line.slice(line.indexOf('/factory:'))
}

/** The runs a session recorded, newest first, with their keys. */
async function sessionRuns($: EngineInterface, sessionId: string): Promise<[string, FactoryBoardRun][]> {
  const prefix = `${RUN_PREFIX}${sessionId}:`
  const found: [string, FactoryBoardRun][] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(prefix)) continue
    const run = (await $.store.get(key)) as FactoryBoardRun | undefined
    if (run !== undefined) found.push([key, run])
  }
  return found.sort((a, b) => b[1].since - a[1].since)
}

/** The latest run of a loop of this session: the main loop's (no `agentId`) or a subagent's. */
async function loopRun($: EngineInterface, agentId: string | undefined): Promise<[string, FactoryBoardRun] | undefined> {
  return (await sessionRuns($, await $.session.id())).find(([, run]) => run.agentId === agentId)
}

/** A loop of this session committed: its live run is done, or, chained, moves to its next stage. */
async function commitRun($: EngineInterface, b: FactoryBoard | null, agentId: string | undefined): Promise<void> {
  const latest = await loopRun($, agentId)
  if (latest === undefined) return
  const [key, run] = latest
  if (!isLive(run)) return
  const feature = b?.features.find(f => f.slug === run.feature)
  const moved = afterCommit(run, feature && withPlan(feature, run.folder))
  await $.store.set(key, { ...run, ...moved, updatedAt: await $.clock.now() })
}

/** Updates the latest run of a loop of this session, when it has one. A finished run stays so until a new `/factory:` prompt. */
async function touchRun($: EngineInterface, status: FactoryBoardRunStatus, agentId: string | undefined): Promise<void> {
  const latest = await loopRun($, agentId)
  if (latest === undefined) return
  const [key, run] = latest
  if (run.status === status || !isLive(run)) return
  await $.store.set(key, { ...run, status, updatedAt: await $.clock.now() })
}

/**
 * Ticks the `Review` item of a plan's Validation, the final review marked done
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

const STATE_LABEL: Record<FactoryBoardFeature['state'], string> = {
  empty: 'sans spec',
  spec: 'spec seule',
  plan: 'plan prêt',
  running: 'en cours',
  review: 'à valider',
  done: 'plan finalisé',
}

/** Theme keys, so the pane follows the person's theme on every surface. */
const STATE_COLOR: Record<FactoryBoardFeature['state'], string> = {
  empty: 'inactive',
  spec: 'warning',
  plan: 'success',
  running: 'claude',
  review: 'permission',
  done: 'success',
}

const RUN_GLYPH: Record<FactoryBoardRunStatus, string> = { running: '●', waiting: '○', done: '✓', interrupted: '!' }

const RUN_LABEL: Record<FactoryBoardRunStatus, string> = {
  running: 'en cours',
  waiting: 'attend une réponse',
  done: 'terminé',
  interrupted: 'interrompue',
}

/** The tinted ground of a pill, by its theme key; the terminal draws none. */
const PILL_BG: Record<string, string> = {
  success: 'rgba(79,191,122,0.18)',
  warning: 'rgba(224,160,90,0.2)',
  claude: 'rgba(217,119,87,0.2)',
  permission: 'rgba(150,130,230,0.2)',
  inactive: 'rgba(140,140,140,0.18)',
}

const SEP = '  ·  '

/** The context tokens of this session, as the status line counts them; null where the host keeps none. */
async function sessionTokens($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).context.tokens ?? null
  } catch {
    return null
  }
}

const tokensLabel = (n: number): string => (n >= 1000 ? `${Math.round(n / 1000)}k tokens` : `${n} tokens`)

const RUN_COLOR: Record<FactoryBoardRunStatus, string> = {
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
}

const SPEC_STATUS_LABEL: Record<string, string> = {
  Draft: 'brouillon',
  Approved: 'validée',
}

/** One cell per stage: done, the one at hand, later. */
function bar(stages: FactoryBoardStage[], next: number | null): string {
  return stages.map(s => (isStageDone(s) ? '█' : s.number === next ? '▓' : '░')).join('')
}

/** One segment per stage, for the surfaces that draw vectors. */
function segmentsSvg(stages: FactoryBoardStage[], next: number | null): string {
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
const planLabel = (plan: FactoryBoardPlan): string => `${plan.folder.split('/').at(-1) ?? plan.folder}${plan.isDraft ? ' (brouillon)' : ''}`

const isStageDone = (stage: { done: number; total: number }): boolean => stage.total > 0 && stage.done === stage.total

/** What stands at a step's right: the stage count, the SHA, the spec status. */
function stepDetail(feature: FactoryBoardFeature, step: FactoryBoardStep): string {
  const plan = feature.plan
  if (step === 'spec') {
    return feature.specStatus ? (SPEC_STATUS_LABEL[feature.specStatus] ?? feature.specStatus) : feature.hasSpec ? 'présente' : 'absente'
  }
  if (step === 'plan') return plan === null ? '' : plan.isDraft ? 'brouillon' : 'commité'
  if (step === 'review') return plan ? `${plan.validationDone}/${plan.validationTotal}` : ''
  const stage = plan?.stages.find(s => `stage:${s.number}` === step)
  if (stage === undefined) return ''
  return isStageDone(stage) ? (stage.sha ?? 'non committé') : `${stage.done}/${stage.total}`
}

/**
 * Where a step stands on the timeline: `done`, `running` (a live session works
 * on it, even when its boxes are all ticked: it is not committed yet), `next`
 * (the step the prompt button prepares) or `pending`.
 */
type Marker = 'done' | 'running' | 'next' | 'pending'

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
    return { text: b.error ?? `Tableau factory ouvert : ${b.features.length} feature(s).` }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await update($, isPaneOpen, () => false)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await recordRun($, e.text)
    return next(e)
  }).catch(($, e, next) => next(e))

  // A session driven by a brief calls the skills through the Skill tool, never from a typed prompt.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const skill = e.skill.replace(/^factory:/, '')
    if (e.agentId === undefined && RUN_SKILLS.has(skill)) await recordRun($, `/factory:${skill} ${e.args ?? ''}`)
    return next(e)
  }).catch(($, e, next) => next(e))

  // A subagent whose brief carries a `/factory:` command (the autopilot's steps) is a run of its own,
  // followed by its loop's id: its turns, its commit and its end are its run's, not the main loop's.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const line = factoryLine(e.prompt)
    if (e.parentAgentId === undefined && started.agentId !== undefined && line !== null) await recordRun($, line, started.agentId)
    return started
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    await touchRun($, 'running', e.agentId)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await touchRun($, 'waiting', e.agentId)
    refreshQuietly($)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const isCommit = /\bgit\b[^|&;\n]*\bcommit\b/.test(e.command)
    if (isCommit && ran.deny === undefined && ran.isError !== true) {
      // Every factory skill ends its job with its commit (spec, plan, stage, squash).
      const before = await read($, board)
      await commitRun($, before, e.agentId)
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
    const reviewOn = await read($, reviewStage)
    const sessionId = await $.session.id()
    const run = b.runs.filter(r => r.sessionId === sessionId).at(-1)
    const found = run ? b.features.find(f => f.slug === run.feature) : undefined
    const feature = found && run ? withPlan(found, run.folder) : undefined
    const others = b.runs.filter(r => r.sessionId !== sessionId && isLive(r)).length
    const tokens = await sessionTokens($)
    const detail = run && feature ? stepDetail(feature, run.step) : ''
    // The run is over (its commit made): the band offers the plan's next step, so the pane need not be opened.
    const after = run && !isLive(run) && found ? nextAction(withPlan(found, picked[found.slug]), { review: reviewOn }) : null
    const pill = (color: string, label: string) => (
      <Text color={color} backgroundColor={e.surface === 'terminal' ? undefined : PILL_BG[color]} weight="semibold">
        {` ${label} `}
      </Text>
    )

    return (
      <Box justifyContent="space-between" alignItems="center" gap={1}>
        <Text wrap="truncate-end">
          <Text weight="semibold" color="claude">
            Factory
          </Text>
          {run ? (
            <Text>
              <Text dimColor>{SEP}</Text>
              <Text weight="semibold">{runTitle(run, feature)}</Text>
              {detail ? <Text dimColor mono tabular>{` ${detail}`}</Text> : ''}
              <Text dimColor>{SEP}</Text>
              {run.feature}
              <Text dimColor>{SEP}</Text>
              {pill(RUN_COLOR[run.status], `${RUN_GLYPH[run.status]} ${RUN_LABEL[run.status]}${isLive(run) ? ` · ${age(b.scannedAt, run.since)}` : ''}`)}
            </Text>
          ) : (
            <Text dimColor>{`${SEP}aucune étape factory dans cette session`}</Text>
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
    const reviewOn = await read($, reviewStage)
    const filtering = await read($, stateFilter)
    const history = await read($, openHistory)
    const toggleReview = async () => void update($, reviewStage, ticked => !ticked)
    const sessionId = await $.session.id()
    const now = b?.scannedAt ?? 0
    const prepare = (prompt: string) => preparePrompt($, prompt)
    const copy = (prompt: string) => copyPrompt($, prompt)
    const who = (run: FactoryBoardRun) => (run.sessionId === sessionId ? 'cette session' : `session ${run.sessionId.slice(0, 8)}`)
    const pill = (color: string, label: string) => (
      <Text color={color} backgroundColor={e.surface === 'terminal' ? undefined : PILL_BG[color]} weight="semibold" wrap="truncate-end">
        {` ${label} `}
      </Text>
    )
    const runPill = (run: FactoryBoardRun) => pill(RUN_COLOR[run.status], `${RUN_GLYPH[run.status]} ${RUN_LABEL[run.status]}${isLive(run) ? ` · ${age(now, run.since)}` : ''}`)

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
    const features = b.features.map(f => onNewPlan(f, b.runs) ?? withPlan(f, picked[f.slug]))
    const project = b.root.split(/[\\/]/).filter(Boolean).at(-1) ?? b.root
    const live = b.runs.filter(isLive).sort((a, b2) => b2.since - a.since)
    const noPlan = features.filter(f => f.plan === null).length
    const stagesLeft = features.reduce((n, f) => n + (f.plan?.stages.filter(s => !isStageDone(s)).length ?? 0), 0)
    // `HEAD` is a detached head: no branch to squash.
    const isBaseBranch = b.branch === b.baseBranch || b.branch === 'HEAD'
    // The squash folds a finalized plan: a branch whose commits name a feature with a plan waits for it.
    const branchPlan = b.features.find(f => f.slug === b.branchFeature)?.plan ?? null
    const isPlanOpen = branchPlan !== null && !isFinalized(branchPlan)
    const squashPrompt = branchPlan ? `/factory:implement ${branchPlan.folder} — close the branch` : `/factory:implement close the branch ${b.branch}`
    const canSquash = b.branch !== null && !isBaseBranch && (b.aheadCount ?? 0) > 1

    const matches = (f: FactoryBoardFeature, filter: FactoryBoardFilter): boolean =>
      filter === 'no-plan' ? f.plan === null : f.state === filter
    const count = (filter: FactoryBoardFilter) => features.filter(f => matches(f, filter)).length
    const visible = filtering === null ? features : features.filter(f => matches(f, filtering))
    const chip = (key: FactoryBoardFilter | 'all', label: string, value: number, color?: string) => {
      const isOn = filtering === (key === 'all' ? null : key)
      return (
        <Button key={`filter:${key}`} plain onPress={() => update($, stateFilter, () => (key === 'all' ? null : key))}>
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

    const card = (feature: FactoryBoardFeature) => {
      const plan = feature.plan
      const runs = b.runs.filter(r => r.feature === feature.slug)
      const isNewPlan = plan === null && feature.plans.length > 0
      // Its session writes it: no prompt to prepare until its folder is there.
      const action = isNewPlan ? null : nextAction(feature, { review: reviewOn })
      // The review checkbox only means something on a stage prompt (`— stage N`, `— stages N-M`).
      const isStageAction = action !== null && /^\/factory:implement .* — stages? \d/.test(action.prompt)
      const isOpen = open === feature.slug
      const stagesDone = plan ? plan.stages.filter(isStageDone).length : 0
      const stagesTotal = plan ? plan.stages.length : 0
      const active = activeStep(feature)
      const nextNumber = Number(/^stage:(\d+)$/.exec(active)?.[1] ?? NaN) || null
      const stateColor = isNewPlan ? 'claude' : STATE_COLOR[feature.state]
      const stateLabel = isNewPlan ? 'nouveau plan en cours' : STATE_LABEL[feature.state]
      const specLine = feature.specStatus ? `spec ${SPEC_STATUS_LABEL[feature.specStatus] ?? feature.specStatus}` : feature.hasSpec ? 'spec présente' : 'pas de spec'

      const row = (step: FactoryBoardStep, isLast: boolean) => {
        const isDone = isStepDone(feature, step)
        const isActive = step === active
        const stepRuns = runs.filter(r => r.step === step && isRunOfPlan(r, feature)).sort((a, b2) => b2.since - a.since)
        const [latest, ...older] = stepRuns
        const marker: Marker = stepRuns.some(isLive) ? 'running' : isDone ? 'done' : isActive ? 'next' : 'pending'
        const detail = stepDetail(feature, step)
        const historyKey = `${feature.slug}:${step}`
        const isHistoryOpen = history === historyKey
        const line = (run: FactoryBoardRun) => (
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
                {step === 'plan' && feature.hasSpec && plan && <Button key={`new-plan:${feature.slug}`} plain dimColor label="+ Nouveau plan" onPress={prepare(`/factory:write-plan ${feature.slug}`)} />}
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
            {isActive && action && (
              <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="claude" paddingX={1}>
                <Box gap={1} flexWrap="wrap" alignItems="center">
                  <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />
                  {action.all && <Button key={`all:${feature.slug}`} label={action.all.label} onPress={prepare(action.all.prompt)} />}
                  {plan && feature.state === 'review' && (
                    <Button key={`mark-review:${feature.slug}`} label="Marquer comme fait" onPress={() => markReviewDone($, b.root, plan.folder)} />
                  )}
                  {plan && <Button key={`review:${feature.slug}`} label="Revue du plan" onPress={prepare(`/factory:review plan ${plan.folder}`)} />}
                  {isStageAction && (
                    <Button key={`review-stage:${feature.slug}`} plain label={`${reviewOn ? '☑' : '☐'} Revue après le stage`} onPress={toggleReview} />
                  )}
                  <Button key={`copy:${feature.slug}`} plain dimColor label="⧉ Copier" onPress={copy(action.prompt)} />
                </Box>
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

    const group = (filter: FactoryBoardFilter | 'spec' | 'empty' | 'plan', label: string) => {
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
    const isDoneShown = filtering === 'done' || done.some(f => f.slug === open)

    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between" alignItems="center" gap={1} paddingX={1}>
          <Text wrap="truncate-end">
            <Text weight="semibold">Factory</Text>
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
                {b.aheadCount !== null && !isBaseBranch ? <Text>{'  '}{pill('inactive', `+${b.aheadCount} commit(s) depuis ${b.baseBranch}`)}</Text> : ''}
                {'  '}
                {b.changedCount > 0 ? pill('warning', `${b.changedCount} fichier(s) non commité(s)`) : <Text dimColor>rien à committer</Text>}
              </Text>
            )}
          </Text>
          <Box gap={1} alignItems="center">
            {/* The squash skill checks the range, proposes the message and waits for a yes: the button only prepares it. */}
            {canSquash && !isPlanOpen && <Button key="squash" label="Squasher" onPress={prepare(squashPrompt)} />}
            {canSquash && isPlanOpen && (
              <Text key="squash-later" size="caption" dimColor wrap="truncate-end">
                squash une fois le plan finalisé
              </Text>
            )}
            <Button key="refresh" plain dimColor label="⟳" onPress={() => refreshQuietly($)} />
          </Box>
        </Box>

        <Box gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between" marginTop={1} paddingX={1}>
          <Box gap={2} flexWrap="wrap" alignItems="center">
            {chip('all', 'features', b.features.length)}
            {chip('running', 'en cours', count('running'), 'claude')}
            {chip('review', 'à valider', count('review'), 'permission')}
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
                await update($, expanded, () => run.feature)
                if (plan) await update($, pickedPlans, m => ({ ...m, [run.feature]: plan.folder }))
              }
              return (
                <Box key={`card:${run.sessionId}:${run.since}`} justifyContent="space-between" gap={1} alignItems="center" borderStyle="round" borderColor={RUN_COLOR[run.status]} borderDimColor paddingX={1}>
                  <Button key={`live:${run.sessionId}:${run.since}`} plain onPress={follow}>
                    <Text color={RUN_COLOR[run.status]}>{`${RUN_GLYPH[run.status]} `}</Text>
                    <Text weight="semibold">{run.feature}</Text>
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
              Lance <Text mono>/factory:write-spec</Text> pour en créer une.
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
            <Button key="show-done" plain dimColor label={`▸ ${done.length} feature(s) finalisée(s) · ${done.map(f => f.slug).join(', ')}`} onPress={() => update($, stateFilter, () => 'done')} />
          </Box>
        ) : (
          ''
        )}
      </Box>
    )
  })
}
