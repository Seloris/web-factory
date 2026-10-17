/**
 * factory-board: a pane that follows the factory's features, their dev plans
 * and the sessions working on them, and prepares the next `/factory:` prompt.
 *
 * Source of truth: `.planning/features/*` and git, rescanned on a timer, on
 * each `git commit` and on each turn's end. The mod keeps one thing of its
 * own, in `$.store`: which session works on which feature, written when a
 * `/factory:` prompt is submitted, so every session's pane shows the runs.
 */

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiPressArgument } from 'claude-code'

import type { FactoryBoard, FactoryBoardFeature, FactoryBoardRun, FactoryBoardRunStatus } from '../types'
import { committed, nextAction, parseFactoryCommand } from './planning'
import { scanBoard } from './scan'

const PANE = 'factory-board'
const COMMAND = 'factory-board'
const RUN_PREFIX = 'run:'
/** A run nobody touched for a day is a session that died: dropped. */
const STALE_MS = 24 * 60 * 60 * 1000
const POLL_MS = 10_000

const board = atom({ plugin: 'factory-board', key: 'board' } as const, null)
const expanded = atom({ plugin: 'factory-board', key: 'expanded' } as const, null)

async function readRuns($: EngineInterface, root: string, now: number): Promise<FactoryBoardRun[]> {
  const runs: FactoryBoardRun[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(RUN_PREFIX)) continue
    const run = (await $.store.get(key)) as FactoryBoardRun | undefined
    if (run === undefined) continue
    if (now - run.updatedAt > STALE_MS) {
      await $.store.delete(key)
      continue
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

async function startRun($: EngineInterface, run: Pick<FactoryBoardRun, 'feature' | 'folder' | 'command'>): Promise<void> {
  const sessionId = await $.session.id()
  const now = await $.clock.now()
  const root = await $.session.root()
  const record: FactoryBoardRun = { sessionId, root, status: 'running', since: now, updatedAt: now, ...run }
  await $.store.set(RUN_PREFIX + sessionId, record)
}

/** Updates this session's run, when it has one. A `done` run stays done until a new `/factory:` prompt. */
async function touchRun($: EngineInterface, status: FactoryBoardRunStatus): Promise<void> {
  const sessionId = await $.session.id()
  const key = RUN_PREFIX + sessionId
  const run = (await $.store.get(key)) as FactoryBoardRun | undefined
  if (run === undefined || run.status === status || run.status === 'done') return
  await $.store.set(key, { ...run, status, updatedAt: await $.clock.now() })
}

const STATE_LABEL: Record<FactoryBoardFeature['state'], string> = {
  empty: 'vide',
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
}

const RUN_COLOR: Record<FactoryBoardRunStatus, string> = {
  running: 'success',
  waiting: 'warning',
  done: 'inactive',
}

const SPEC_STATUS_LABEL: Record<string, string> = {
  Draft: 'brouillon',
  Approved: 'validée',
}

/** The row's fixed columns, in cells; the feature column takes the rest. */
const STATE_WIDTH = 14
const STAGES_WIDTH = 18
const ACTION_WIDTH = 24

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Ouvre le tableau des features du projet, leurs plans et les stages en cours',
    })
    const root = await $.session.root()
    const hasPlanning = await $.fs.exists(`${root}/.planning/features`)
    if (hasPlanning && e.surface !== null && e.surface !== 'terminal') {
      void $.ui.open({ id: PANE, title: 'Factory' })
    }
    if (hasPlanning) {
      await refresh($)
      $.clock.every(POLL_MS, () => refreshQuietly($))
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: 'Factory', focus: true })
    const b = await refresh($)
    return { text: b.error ?? `Tableau factory ouvert : ${b.features.length} feature(s).` }
  })

  on('prompt.submit', async ($, e, next) => {
    const command = parseFactoryCommand(e.text)
    if (command !== null && command.feature !== null) {
      await startRun($, { feature: command.feature, folder: command.folder, command: command.skill })
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
    await $.store.delete(RUN_PREFIX + e.sessionId)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const b = await read($, board)
    const open = await read($, expanded)
    const columns = Math.max(30, e.props.bodyColumns)
    /** Under 72 cells the row's columns wrap under the feature and the column header is dropped. */
    const isWide = columns >= 72
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
    const running = b.runs.filter(r => r.status === 'running').length
    const waiting = b.runs.filter(r => r.status === 'waiting').length
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

        {b.features.length === 0 && (
          <Box flexDirection="column" marginTop={1} paddingX={1}>
            <Text dimColor>Aucune feature sous .planning/features.</Text>
            <Text dimColor>
              Lance <Text mono>/factory:write-spec</Text> pour en créer une.
            </Text>
          </Box>
        )}

        {isWide && b.features.length > 0 && (
          <Box gap={1} marginTop={1} paddingX={1}>
            <Box flexGrow={1}>
              <Text size="caption" dimColor>
                Feature
              </Text>
            </Box>
            <Box width={STATE_WIDTH}>
              <Text size="caption" dimColor>
                État
              </Text>
            </Box>
            <Box width={STAGES_WIDTH}>
              <Text size="caption" dimColor>
                Stages
              </Text>
            </Box>
            <Box width={ACTION_WIDTH}>
              <Text size="caption" dimColor>
                Action
              </Text>
            </Box>
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
          const active = plan?.stages.find(s => !isStageDone(s))?.number ?? null
          const specLine = feature.specStatus ? `spec ${SPEC_STATUS_LABEL[feature.specStatus] ?? feature.specStatus}` : 'pas de spec'

          return (
            <Box key={`feature:${feature.slug}`} flexDirection="column" marginTop={1} paddingX={1}>
              <Box gap={1} flexWrap="wrap" alignItems="center">
                <Box flexGrow={1} minWidth={24}>
                  <Button key={`row:${feature.slug}`} plain onPress={() => update($, expanded, () => (isOpen ? null : feature.slug))}>
                    {isOpen ? '▾ ' : '▸ '}
                    <Text weight="semibold">{feature.slug}</Text>
                    <Text dimColor>{feature.title === feature.slug ? '' : `  ${feature.title}`}</Text>
                  </Button>
                </Box>
                <Box width={STATE_WIDTH}>
                  <Text color={STATE_COLOR[feature.state]} wrap="truncate-end">
                    ● {STATE_LABEL[feature.state]}
                    {plan?.isDraft ? <Text dimColor> brouillon</Text> : ''}
                  </Text>
                </Box>
                <Box width={STAGES_WIDTH}>
                  {plan ? (
                    <Text tabular>
                      <Text color={isComplete ? 'success' : 'claude'}>{bar(stagesDone, stagesTotal, 8)}</Text>
                      <Text dimColor>
                        {' '}
                        {stagesDone}/{stagesTotal}
                      </Text>
                    </Text>
                  ) : (
                    <Text dimColor wrap="truncate-end">
                      {specLine}
                    </Text>
                  )}
                </Box>
                <Box width={ACTION_WIDTH}>
                  {action && <Button key={`prepare:${feature.slug}`} variant="primary" label={action.label} onPress={prepare(action.prompt)} />}
                </Box>
              </Box>

              {runs.map(run => (
                <Box key={`run:${run.sessionId}`} paddingLeft={2}>
                  <Text color={RUN_COLOR[run.status]}>{RUN_LABEL[run.status]}</Text>
                  <Text dimColor>
                    {' · '}
                    {run.command} · session {run.sessionId.slice(0, 8)} · {age(now, run.since)}
                  </Text>
                </Box>
              ))}

              {isOpen && (
                <Box paddingLeft={2} marginTop={1} gap={2} flexWrap="wrap">
                  <Box flexDirection="column" flexGrow={1} minWidth={32}>
                    {plan ? (
                      <Box flexDirection="column">
                        <Text size="caption" dimColor mono wrap="truncate-start">
                          {plan.folder}
                        </Text>
                        {plan.stages.map(stage => {
                          const isDone = isStageDone(stage)
                          const isActive = stage.number === active
                          return (
                            <Box key={`stage:${feature.slug}:${stage.number}`}>
                              <Text>
                                <Text color={isDone ? 'success' : isActive ? 'claude' : 'inactive'}>{isDone ? '✓' : isActive ? '◉' : '○'}</Text>{' '}
                                <Text weight={isActive ? 'semibold' : 'regular'}>
                                  Stage {stage.number}
                                  {stage.title ? ` — ${stage.title}` : ''}
                                </Text>
                                <Text dimColor mono>
                                  {'  '}
                                  {isDone ? (stage.sha ?? 'non committé') : `${stage.done}/${stage.total}`}
                                </Text>
                              </Text>
                            </Box>
                          )
                        })}
                        {plan.validationTotal > 0 && (
                          <Text>
                            <Text color={plan.validationDone === plan.validationTotal ? 'success' : 'inactive'}>
                              {plan.validationDone === plan.validationTotal ? '✓' : '○'}
                            </Text>{' '}
                            Validation
                            <Text dimColor mono>
                              {'  '}
                              {plan.validationDone}/{plan.validationTotal}
                            </Text>
                          </Text>
                        )}
                      </Box>
                    ) : (
                      <Text dimColor>{specLine}</Text>
                    )}
                  </Box>

                  {action && (
                    <Box flexDirection="column" flexGrow={1} minWidth={32}>
                      <Text size="caption" dimColor>
                        Prompt préparé
                      </Text>
                      <Box borderStyle="round" borderDimColor paddingX={1}>
                        <Text mono wrap="wrap">
                          {action.prompt}
                        </Text>
                      </Box>
                      <Box gap={1} marginTop={1}>
                        <Button key={`copy:${feature.slug}`} label="Copier" onPress={copy(action.prompt)} />
                        {plan && (
                          <Button key={`review:${feature.slug}`} label="Revue du plan" onPress={prepare(`/factory:review plan ${plan.folder}`)} />
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
