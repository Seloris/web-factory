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

import type { FactoryBoard, FactoryBoardFeature, FactoryBoardPlan, FactoryBoardRun, FactoryBoardRunStatus, FactoryBoardStep } from '../types'
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

async function startRun($: EngineInterface, run: Pick<FactoryBoardRun, 'feature' | 'folder' | 'command' | 'step' | 'lastStep'>): Promise<void> {
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

/** A `/factory:…` text that names a feature records a run on the step it lands on. */
async function recordRun($: EngineInterface, text: string): Promise<void> {
  const command = parseFactoryCommand(text)
  if (command === null || command.feature === null) return
  const feature = (await read($, board))?.features.find(f => f.slug === command.feature)
  await startRun($, { feature: command.feature, folder: command.folder, command: command.skill, step: runStep(command, feature && withPlan(feature, command.folder)), lastStep: runLastStep(command) })
  refreshQuietly($)
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

/** This session committed: its live run is done, or, chained, moves to its next stage. */
async function commitRun($: EngineInterface, b: FactoryBoard | null): Promise<void> {
  const [latest] = await sessionRuns($, await $.session.id())
  if (latest === undefined) return
  const [key, run] = latest
  if (!isLive(run)) return
  const feature = b?.features.find(f => f.slug === run.feature)
  const moved = afterCommit(run, feature && withPlan(feature, run.folder))
  await $.store.set(key, { ...run, ...moved, updatedAt: await $.clock.now() })
}

/** Updates this session's latest run, when it has one. A finished run stays so until a new `/factory:` prompt. */
async function touchRun($: EngineInterface, status: FactoryBoardRunStatus): Promise<void> {
  const [latest] = await sessionRuns($, await $.session.id())
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

const RUN_LABEL: Record<FactoryBoardRunStatus, string> = {
  running: '● en cours',
  waiting: '○ attend une réponse',
  done: '✓ terminé',
  interrupted: '! interrompue',
}

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

function bar(done: number, total: number, cells: number): string {
  if (total === 0) return '░'.repeat(cells)
  const filled = Math.round((done / total) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
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

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await touchRun($, 'running')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await touchRun($, 'waiting')
      refreshQuietly($)
    }
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const isCommit = /\bgit\b[^|&;\n]*\bcommit\b/.test(e.command)
    if (isCommit && ran.deny === undefined && ran.isError !== true) {
      // Every factory skill ends its job with its commit (spec, plan, stage, squash).
      const before = await read($, board)
      if (e.agentId === undefined) await commitRun($, before)
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
    const sessionId = await $.session.id()
    const run = b.runs.filter(r => r.sessionId === sessionId).at(-1)
    const found = run ? b.features.find(f => f.slug === run.feature) : undefined
    const feature = found && run ? withPlan(found, run.folder) : undefined
    const others = b.runs.filter(r => r.sessionId !== sessionId && isLive(r)).length

    return (
      <Box justifyContent="space-between" alignItems="center" gap={1}>
        <Text wrap="truncate-end">
          <Text weight="semibold" color="claude">
            Factory
          </Text>
          {run ? (
            <Text>
              {'  '}
              <Text weight="semibold">{describeRun(run, feature)}</Text>
              <Text color={RUN_COLOR[run.status]}>
                {'  '}
                {RUN_LABEL[run.status]}
              </Text>
            </Text>
          ) : (
            <Text dimColor>{'  aucune étape factory dans cette session'}</Text>
          )}
          {others > 0 && <Text dimColor>{` · ${others} autre(s) session(s)`}</Text>}
        </Text>
        <Button key="toggle-pane" label={isOpen ? 'Fermer le tableau' : 'Ouvrir le tableau'} onPress={() => (isOpen ? closePane($) : openPane($, true))} />
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
    const toggleReview = async () => void update($, reviewStage, ticked => !ticked)
    const sessionId = await $.session.id()
    const now = b?.scannedAt ?? 0

    const prepare = (prompt: string) => async (press: UiPressArgument) => {
      const filled = await $.prompt.fill({ text: prompt, mode: 'replace' })
      if (filled.isFilled) {
        $.ui.toast('Prompt prêt dans la zone de saisie : Entrée pour lancer.')
      } else {
        const copied = await $.ui.copy({ text: prompt, surface: press.surface })
        $.ui.toast(copied.isCopied ? 'Prompt copié dans le presse-papiers.' : 'Impossible de préparer le prompt ici.')
      }
    }
    const copy = (prompt: string) => async (press: UiPressArgument) => {
      const copied = await $.ui.copy({ text: prompt, surface: press.surface })
      $.ui.toast(copied.isCopied ? 'Prompt copié dans le presse-papiers.' : 'Pas de presse-papiers sur cette surface.')
    }
    const who = (run: FactoryBoardRun) => (run.sessionId === sessionId ? 'cette session' : `session ${run.sessionId.slice(0, 8)}`)

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
    const running = live.filter(r => r.status === 'running').length
    const waiting = live.length - running
    const noPlan = features.filter(f => f.plan === null).length
    const inProgress = features.filter(f => f.state === 'running' || f.state === 'review').length
    const stagesLeft = features.reduce((n, f) => n + (f.plan?.stages.filter(s => !isStageDone(s)).length ?? 0), 0)
    const sessions = [running > 0 ? `${running} en cours` : null, waiting > 0 ? `${waiting} en attente` : null].filter(Boolean)
    // `HEAD` is a detached head: no branch to squash.
    const isBaseBranch = b.branch === b.baseBranch || b.branch === 'HEAD'
    // The squash folds a finalized plan: a branch whose commits name a feature with a plan waits for it.
    const branchPlan = b.features.find(f => f.slug === b.branchFeature)?.plan ?? null
    const isPlanOpen = branchPlan !== null && !isFinalized(branchPlan)
    const squashPrompt = branchPlan ? `/factory:implement ${branchPlan.folder} — close the branch` : `/factory:implement close the branch ${b.branch}`
    const canSquash = b.branch !== null && !isBaseBranch && (b.aheadCount ?? 0) > 1

    const tile = (key: string, label: string, value: number, color?: string) => (
      <Box key={`tile:${key}`} flexDirection="column" flexGrow={1} minWidth={12} borderStyle="round" borderDimColor paddingX={1}>
        <Text size="caption" dimColor>
          {label}
        </Text>
        <Text size="title" weight="semibold" color={value > 0 ? color : 'inactive'} tabular>
          {String(value)}
        </Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between" alignItems="center" paddingX={1}>
          <Text wrap="truncate-end">
            <Text weight="semibold">Factory</Text>
            <Text dimColor>
              {version ? ` v${version}` : ''}
              {'  '}
              {project}
              {sessions.length > 0 ? ` · ${sessions.join(', ')}` : ''}
            </Text>
          </Text>
          <Button key="refresh" plain dimColor label="⟳" onPress={() => refreshQuietly($)} />
        </Box>

        {b.branch && (
          <Box justifyContent="space-between" alignItems="center" gap={1} paddingX={1}>
            <Text wrap="truncate-end">
              <Text dimColor>{'Branche  '}</Text>
              <Text weight="semibold" mono>
                {b.branch}
              </Text>
              <Text dimColor tabular>
                {b.aheadCount !== null && !isBaseBranch ? `  ${b.aheadCount} commit(s) depuis ${b.baseBranch}` : ''}
                {`  · ${b.changedCount > 0 ? `${b.changedCount} fichier(s) non commité(s)` : 'rien à committer'}`}
              </Text>
            </Text>
            {/* The squash skill checks the range, proposes the message and waits for a yes: the button only prepares it. */}
            {canSquash && !isPlanOpen && <Button key="squash" label="Squasher" onPress={prepare(squashPrompt)} />}
            {canSquash && isPlanOpen && (
              <Text key="squash-later" size="caption" dimColor wrap="truncate-end">
                squash une fois le plan finalisé
              </Text>
            )}
          </Box>
        )}

        <Box gap={1} flexWrap="wrap" marginTop={1}>
          {tile('features', 'Features', b.features.length)}
          {tile('no-plan', 'Sans plan', noPlan, 'warning')}
          {tile('in-progress', 'En cours', inProgress, 'claude')}
          {tile('stages-left', 'Stages restants', stagesLeft, 'claude')}
        </Box>

        {live.length > 0 && (
          <Box flexDirection="column" marginTop={1} paddingX={1}>
            <Text size="caption" dimColor>
              Sessions en cours
            </Text>
            <Box flexDirection="column" gap={1} marginTop={1}>
              {live.map(run => {
                const found = b.features.find(f => f.slug === run.feature)
                const feature = found && withPlan(found, run.folder)
                const plan = runPlan(run, found)
                const planName = plan ? planLabel(plan) : (run.folder?.split('/').at(-1) ?? 'nouveau plan, dossier pas encore créé')
                const stepAt = plan && /^stage:\d+$|^review$/.test(run.step) && feature ? stepDetail(feature, run.step) : ''
                const stages = plan ? `stages ${plan.stages.filter(isStageDone).length}/${plan.stages.length}` : ''
                // A click unfolds the feature on the run's plan.
                const follow = async () => {
                  await update($, expanded, () => run.feature)
                  if (plan) await update($, pickedPlans, m => ({ ...m, [run.feature]: plan.folder }))
                }
                return (
                  <Box key={`card:${run.sessionId}:${run.since}`} flexDirection="column" borderStyle="round" borderColor={RUN_COLOR[run.status]} paddingX={1}>
                    <Box justifyContent="space-between" gap={1}>
                      <Button key={`live:${run.sessionId}:${run.since}`} plain onPress={follow}>
                        <Text weight="semibold">{runTitle(run, feature)}</Text>
                        {stepAt ? <Text dimColor mono tabular>{`  ${stepAt}`}</Text> : ''}
                      </Button>
                      <Text color={RUN_COLOR[run.status]} wrap="truncate-end">
                        {RUN_LABEL[run.status]}
                      </Text>
                    </Box>
                    <Text wrap="truncate-end">
                      <Text dimColor>{'Feature  '}</Text>
                      <Text weight="semibold">{run.feature}</Text>
                      {found && found.title !== found.slug ? <Text>{`  ${found.title}`}</Text> : ''}
                      {found ? <Text color={STATE_COLOR[found.state]}>{`  ● ${STATE_LABEL[found.state]}`}</Text> : ''}
                    </Text>
                    {plan !== undefined && (
                      <Text wrap="truncate-end">
                        <Text dimColor>{'Plan     '}</Text>
                        <Text mono>{planName}</Text>
                        {plan ? <Text>{`  ${plan.title}`}</Text> : ''}
                        {stages ?<Text dimColor tabular>{`  ${stages}`}</Text> : ''}
                      </Text>
                    )}
                    <Text size="caption" dimColor wrap="truncate-end">
                      {who(run)} · {SKILL_LABEL[run.command] ?? run.command} · depuis {stamp(run.since)} · {age(now, run.since)}
                    </Text>
                  </Box>
                )
              })}
            </Box>
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

        {features.map(feature => {
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
          const isComplete = stagesTotal > 0 && stagesDone === stagesTotal
          const active = activeStep(feature)
          // One spec, several plans: the spec stands alone, the timeline under it is the picked plan's.
          const [, ...planSteps] = steps(feature)
          const specLine = feature.specStatus ? `spec ${SPEC_STATUS_LABEL[feature.specStatus] ?? feature.specStatus}` : feature.hasSpec ? 'spec présente' : 'pas de spec'

          const row = (step: FactoryBoardStep, isLast: boolean) => {
            const isDone = isStepDone(feature, step)
            const isActive = step === active
            const history = runs.filter(r => r.step === step && isRunOfPlan(r, feature)).sort((a, b2) => b2.since - a.since)
            const marker: Marker = history.some(isLive) ? 'running' : isDone ? 'done' : isActive ? 'next' : 'pending'
            const detail = stepDetail(feature, step)
            const lines = history.map(run => (
              <Box key={`run:${run.sessionId}:${run.since}`}>
                <Text wrap="truncate-end">
                  <Text color={RUN_COLOR[run.status]}>{RUN_LABEL[run.status].slice(0, 1)}</Text>
                  <Text dimColor>
                    {' '}
                    {stamp(run.since)} · {SKILL_LABEL[run.command] ?? run.command} · {age(isLive(run) ? now : run.updatedAt, run.since)}
                    {' · '}
                    {who(run)}
                  </Text>
                  {run.status !== 'done' && <Text color={RUN_COLOR[run.status]}>{`  ${RUN_LABEL[run.status].slice(2)}`}</Text>}
                </Text>
              </Box>
            ))

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
                <Box justifyContent="space-between" gap={1}>
                  <Text weight={isActive || marker === 'running' ? 'semibold' : 'regular'} dimColor={marker === 'pending'} wrap="truncate-end">
                    {stepTitle(feature, step)}
                  </Text>
                  <Text color={isDone ? 'success' : undefined} dimColor={!isDone} mono tabular>
                    {detail}
                  </Text>
                </Box>
                {lines}
                {isActive && action && (
                  <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="claude" paddingX={1}>
                    <Box gap={1} flexWrap="wrap">
                      <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />
                      {action.all && <Button key={`all:${feature.slug}`} label={action.all.label} onPress={prepare(action.all.prompt)} />}
                      <Button key={`copy:${feature.slug}`} label="Copier" onPress={copy(action.prompt)} />
                      {plan && feature.state === 'review' && (
                        <Button key={`mark-review:${feature.slug}`} label="Marquer comme fait" onPress={() => markReviewDone($, b.root, plan.folder)} />
                      )}
                      {plan && <Button key={`review:${feature.slug}`} label="Revue du plan" onPress={prepare(`/factory:review plan ${plan.folder}`)} />}
                      {isStageAction && (
                        <Button key={`review-stage:${feature.slug}`} label={`${reviewOn ? '☑' : '☐'} Revue après chaque stage`} onPress={toggleReview} />
                      )}
                    </Box>
                    <Text size="caption" dimColor mono wrap="wrap">
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
              borderColor={isNewPlan ? 'claude' : STATE_COLOR[feature.state]}
              borderDimColor={!isOpen && !runs.some(isLive)}
            >
              <Box gap={2} flexWrap="wrap" alignItems="center" justifyContent="space-between">
                <Box flexGrow={1} minWidth={24}>
                  <Button key={`row:${feature.slug}`} plain onPress={() => update($, expanded, () => (isOpen ? null : feature.slug))}>
                    {isOpen ? '▾ ' : '▸ '}
                    <Text weight="semibold">{feature.slug}</Text>
                    <Text dimColor>{feature.title === feature.slug ? '' : `  ${feature.title}`}</Text>
                  </Button>
                </Box>
                <Box gap={2} alignItems="center">
                  <Text color={isNewPlan ? 'claude' : STATE_COLOR[feature.state]} wrap="truncate-end">
                    ● {isNewPlan ? 'nouveau plan en cours' : STATE_LABEL[feature.state]}
                    {plan?.isDraft ? <Text dimColor> brouillon</Text> : ''}
                  </Text>
                  {plan ? (
                    <Text tabular>
                      <Text color={isComplete ? 'success' : 'claude'}>{bar(stagesDone, stagesTotal, 8)}</Text>
                      <Text dimColor>
                        {' '}
                        {stagesDone}/{stagesTotal}
                      </Text>
                    </Text>
                  ) : (
                    <Text dimColor>{specLine}</Text>
                  )}
                  {!isOpen && action && <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />}
                </Box>
              </Box>

              {isOpen && (
                <Box flexDirection="column" marginTop={1} paddingLeft={1}>
                  <Text size="caption" dimColor>
                    Spec
                  </Text>
                  <Box flexDirection="column" marginTop={1}>
                    {row('spec', true)}
                  </Box>

                  <Box marginTop={1} gap={1} flexWrap="wrap" alignItems="center" justifyContent="space-between">
                    <Text size="caption" dimColor>
                      {feature.plans.length > 1 ? `Plans (${feature.plans.length})` : 'Plan'}
                    </Text>
                    <Box gap={1} flexWrap="wrap" alignItems="center">
                      {Select && plan && feature.plans.length > 1 && (
                        <Select
                          key={`plan:${feature.slug}`}
                          options={feature.plans.map(p => ({ value: p.folder, label: planLabel(p) }))}
                          value={plan.folder}
                          onSelect={folder => void update($, pickedPlans, m => ({ ...m, [feature.slug]: folder }))}
                        />
                      )}
                      {feature.hasSpec && plan && (
                        <Button key={`new-plan:${feature.slug}`} label="Nouveau plan" onPress={prepare(`/factory:write-plan ${feature.slug}`)} />
                      )}
                    </Box>
                  </Box>
                  {plan ? (
                    <Text size="caption" dimColor mono wrap="truncate-start">
                      {plan.folder}
                    </Text>
                  ) : (
                    <Text size="caption" dimColor>
                      {isNewPlan
                        ? 'Nouveau plan en cours d’écriture : il s’affiche ici dès que son dossier existe.'
                        : feature.hasSpec
                          ? 'Pas encore de plan : la spec attend son plan.'
                          : 'Ni spec ni plan : tout commence par la spec.'}
                    </Text>
                  )}
                  <Box flexDirection="column" marginTop={1}>
                    {planSteps.map((step, index) => row(step, index === planSteps.length - 1))}
                  </Box>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
