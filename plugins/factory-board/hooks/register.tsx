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

import type { FactoryBoard, FactoryBoardFeature, FactoryBoardRun, FactoryBoardRunStatus, FactoryBoardStep } from '../types'
import { activeStep, committed, describeRun, isStepDone, nextAction, parseFactoryCommand, runStep, stamp, steps } from './planning'
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

const isLive = (run: FactoryBoardRun): boolean => run.status === 'running' || run.status === 'waiting'

async function openPane($: EngineInterface, focus = false): Promise<void> {
  await $.ui.open(focus ? { id: PANE, title: 'Factory', focus: true } : { id: PANE, title: 'Factory' })
  await update($, isPaneOpen, () => true)
}

async function closePane($: EngineInterface): Promise<void> {
  await $.ui.close({ id: PANE })
  await update($, isPaneOpen, () => false)
}

/** Every run of the project, oldest first; prunes the old ones and interrupts the silent ones on the way. */
async function readRuns($: EngineInterface, root: string, now: number): Promise<FactoryBoardRun[]> {
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
    if (run.root === root) runs.push(run)
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
  const runs = await readRuns($, root, now)
  const next: FactoryBoard = { ...scanned, runs }
  await update($, board, () => next)
  return next
}

async function startRun($: EngineInterface, run: Pick<FactoryBoardRun, 'feature' | 'folder' | 'command' | 'step'>): Promise<void> {
  const sessionId = await $.session.id()
  const now = await $.clock.now()
  const root = await $.session.root()
  const record: FactoryBoardRun = { sessionId, root, status: 'running', since: now, updatedAt: now, ...run }
  await $.store.set(`${RUN_PREFIX}${sessionId}:${now}`, record)
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

/** Updates this session's latest run, when it has one. A finished run stays so until a new `/factory:` prompt. */
async function touchRun($: EngineInterface, status: FactoryBoardRunStatus): Promise<void> {
  const [latest] = await sessionRuns($, await $.session.id())
  if (latest === undefined) return
  const [key, run] = latest
  if (run.status === status || !isLive(run)) return
  await $.store.set(key, { ...run, status, updatedAt: await $.clock.now() })
}

const STATE_LABEL: Record<FactoryBoardFeature['state'], string> = {
  empty: 'sans spec',
  spec: 'spec seule',
  plan: 'plan prêt',
  running: 'en cours',
  review: 'à valider',
  done: 'à fermer',
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

const isStageDone = (stage: { done: number; total: number }): boolean => stage.total > 0 && stage.done === stage.total

/** The row's title and what stands at its right: the stage count, the SHA, the spec status. */
function stepRow(feature: FactoryBoardFeature, step: FactoryBoardStep): { title: string; detail: string } {
  const plan = feature.plan
  if (step === 'spec') {
    const status = feature.specStatus ? (SPEC_STATUS_LABEL[feature.specStatus] ?? feature.specStatus) : feature.hasSpec ? 'présente' : 'absente'
    return { title: 'Spec', detail: status }
  }
  if (step === 'plan') return { title: 'Plan', detail: plan === null ? '' : plan.isDraft ? 'brouillon' : 'commité' }
  if (step === 'review') return { title: 'Revue finale', detail: plan ? `${plan.validationDone}/${plan.validationTotal}` : '' }
  if (step === 'close') return { title: 'Clôture de la branche', detail: '' }
  const stage = plan?.stages.find(s => `stage:${s.number}` === step)
  if (stage === undefined) return { title: step, detail: '' }
  const detail = isStageDone(stage) ? (stage.sha ?? 'non committé') : `${stage.done}/${stage.total}`
  return { title: `Stage ${stage.number}${stage.title ? ` — ${stage.title}` : ''}`, detail }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
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
    const command = parseFactoryCommand(e.text)
    if (command !== null && command.feature !== null) {
      const feature = (await read($, board))?.features.find(f => f.slug === command.feature)
      await startRun($, { feature: command.feature, folder: command.folder, command: command.skill, step: runStep(command, feature) })
      refreshQuietly($)
    }
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
      if (e.agentId === undefined) await touchRun($, 'done')
      const before = await read($, board)
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
    const feature = run ? b.features.find(f => f.slug === run.feature) : undefined
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
    const { Box, Text, Button } = $.ui.resolve(e)
    const b = await read($, board)
    const open = await read($, expanded)
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

    const project = b.root.split(/[\\/]/).filter(Boolean).at(-1) ?? b.root
    const live = b.runs.filter(isLive).sort((a, b2) => b2.since - a.since)
    const running = live.filter(r => r.status === 'running').length
    const waiting = live.length - running
    const noPlan = b.features.filter(f => f.plan === null).length
    const inProgress = b.features.filter(f => f.state === 'running' || f.state === 'review').length
    const stagesLeft = b.features.reduce((n, f) => n + (f.plan?.stages.filter(s => !isStageDone(s)).length ?? 0), 0)
    const sessions = [running > 0 ? `${running} en cours` : null, waiting > 0 ? `${waiting} en attente` : null].filter(Boolean)

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
              {'  '}
              {project}
              {b.branch ? ` · ${b.branch}` : ''}
              {sessions.length > 0 ? ` · ${sessions.join(', ')}` : ''}
            </Text>
          </Text>
          <Button key="refresh" plain dimColor label="⟳" onPress={() => refreshQuietly($)} />
        </Box>

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
            {live.map(run => {
              const feature = b.features.find(f => f.slug === run.feature)
              return (
                <Button key={`live:${run.sessionId}:${run.since}`} plain onPress={() => update($, expanded, () => run.feature)}>
                  <Text color={RUN_COLOR[run.status]}>{RUN_LABEL[run.status]}</Text>
                  <Text>
                    {'  '}
                    {describeRun(run, feature)}
                  </Text>
                  <Text dimColor>
                    {' · '}
                    {who(run)} · {age(now, run.since)}
                  </Text>
                </Button>
              )
            })}
          </Box>
        )}

        {b.features.length === 0 && (
          <Box flexDirection="column" marginTop={1} paddingX={1}>
            <Text dimColor>Aucune feature sous .planning/features.</Text>
            <Text dimColor>
              Lance <Text mono>/factory:write-spec</Text> pour en créer une.
            </Text>
          </Box>
        )}

        {b.features.map(feature => {
          const plan = feature.plan
          const runs = b.runs.filter(r => r.feature === feature.slug)
          const action = nextAction(feature)
          const isOpen = open === feature.slug
          const stagesDone = plan ? plan.stages.filter(isStageDone).length : 0
          const stagesTotal = plan ? plan.stages.length : 0
          const isComplete = stagesTotal > 0 && stagesDone === stagesTotal
          const active = activeStep(feature)
          const specLine = feature.specStatus ? `spec ${SPEC_STATUS_LABEL[feature.specStatus] ?? feature.specStatus}` : feature.hasSpec ? 'spec présente' : 'pas de spec'

          return (
            <Box
              key={`feature:${feature.slug}`}
              flexDirection="column"
              marginTop={1}
              paddingX={1}
              borderStyle="round"
              borderColor={STATE_COLOR[feature.state]}
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
                  <Text color={STATE_COLOR[feature.state]} wrap="truncate-end">
                    ● {STATE_LABEL[feature.state]}
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
                  {plan ? (
                    <Text size="caption" dimColor mono wrap="truncate-start">
                      {plan.folder}
                    </Text>
                  ) : (
                    <Text size="caption" dimColor>
                      {feature.hasSpec ? 'Pas encore de plan : la spec attend son plan.' : 'Ni spec ni plan : tout commence par la spec.'}
                    </Text>
                  )}

                  {steps(feature).map(step => {
                    const isDone = isStepDone(feature, step)
                    const isActive = step === active
                    const row = stepRow(feature, step)
                    const history = runs.filter(r => r.step === step).sort((a, b2) => b2.since - a.since)
                    const lines = history.map(run => (
                      <Box key={`run:${run.sessionId}:${run.since}`} paddingLeft={2}>
                        <Text>
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
                    const head = (
                      <Box justifyContent="space-between" gap={1}>
                        <Text>
                          <Text color={isDone ? 'success' : isActive ? 'claude' : 'inactive'}>{isDone ? '✓' : isActive ? '◉' : '○'}</Text>{' '}
                          <Text weight={isActive ? 'semibold' : 'regular'} dimColor={!isDone && !isActive}>
                            {row.title}
                          </Text>
                        </Text>
                        <Text color={isDone ? 'success' : undefined} dimColor={!isDone} mono tabular>
                          {row.detail}
                        </Text>
                      </Box>
                    )

                    if (!isActive) {
                      return (
                        <Box key={`step:${feature.slug}:${step}`} flexDirection="column" marginTop={1}>
                          {head}
                          {lines}
                        </Box>
                      )
                    }
                    return (
                      <Box key={`step:${feature.slug}:${step}`} flexDirection="column" marginTop={1} borderStyle="round" borderColor="claude" paddingX={1}>
                        {head}
                        {lines}
                        {action && (
                          <Box flexDirection="column" marginTop={1}>
                            <Box gap={1} flexWrap="wrap">
                              <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />
                              <Button key={`copy:${feature.slug}`} label="Copier" onPress={copy(action.prompt)} />
                              {plan && <Button key={`review:${feature.slug}`} label="Revue du plan" onPress={prepare(`/factory:review plan ${plan.folder}`)} />}
                            </Box>
                            <Text size="caption" dimColor mono wrap="wrap">
                              {action.prompt}
                            </Text>
                          </Box>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
