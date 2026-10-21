/**
 * Pure readers of selo-flow's planning files and prompts. No `$` here: every
 * function takes text and returns data, so the tests cover them directly.
 */

import type {
  SeloFlowBoard,
  SeloFlowBoardExport,
  SeloFlowBoardFeature,
  SeloFlowBoardFeatureState,
  SeloFlowBoardMarker,
  SeloFlowBoardPhase,
  SeloFlowBoardPlan,
  SeloFlowBoardRecap,
  SeloFlowBoardRun,
  SeloFlowBoardStage,
  SeloFlowBoardStep,
} from '../types'

export type ParsedPlan = {
  title: string | null
  stages: SeloFlowBoardStage[]
  validationDone: number
  validationTotal: number
  reviewDone: boolean
}

const HEADING_1 = /^#\s+(.+?)\s*$/
const HEADING_2 = /^##\s+(.+?)\s*$/
const STAGE = /^###\s+Stage\s+(\d+)\s*(?:[—–-]+\s*(.*?))?\s*$/
const COMMIT = /^Commit:\s*`([^`]+)`/
// `[-]`: settled without a tick (a validation check the person declined); counts as done.
const CHECKBOX = /^\s*[-*]\s+\[([ xX-])\]/
// The one Validation item a plan's finalization waits for, in English or French.
const REVIEW_ITEM = /^\s*(?:review|revue)\b/i

/** Reads a `plan.md`: its title, the Progress stages, the Validation count and its `Review` item. */
export function parsePlan(text: string): ParsedPlan {
  const plan: ParsedPlan = { title: null, stages: [], validationDone: 0, validationTotal: 0, reviewDone: false }
  let section = ''
  let stage: SeloFlowBoardStage | null = null

  for (const line of text.split(/\r?\n/)) {
    const h1 = HEADING_1.exec(line)
    if (h1 && plan.title === null && !line.startsWith('##')) {
      plan.title = h1[1] ?? null
      continue
    }
    const h2 = HEADING_2.exec(line)
    if (h2 && !line.startsWith('###')) {
      section = (h2[1] ?? '').toLowerCase()
      stage = null
      continue
    }
    if (section === 'progress') {
      const s = STAGE.exec(line)
      if (s) {
        stage = { number: Number(s[1]), title: (s[2] ?? '').trim(), commit: null, sha: null, done: 0, total: 0 }
        plan.stages.push(stage)
        continue
      }
      const c = COMMIT.exec(line)
      if (c && stage) {
        stage.commit = c[1] ?? null
        continue
      }
      const box = CHECKBOX.exec(line)
      if (box && stage) {
        stage.total += 1
        if (box[1] !== ' ') stage.done += 1
      }
    } else if (section === 'validation') {
      const box = CHECKBOX.exec(line)
      if (box) {
        plan.validationTotal += 1
        if (box[1] !== ' ') plan.validationDone += 1
        // Review is never declined: only a tick counts.
        if (/[xX]/.test(box[1] ?? '') && REVIEW_ITEM.test(line.slice(box[0].length))) plan.reviewDone = true
      }
    }
  }

  return plan
}

export type ParsedSpec = { title: string | null }

/** Reads a `00_spec.md`: its title, without the `— Spec` or `— PRD` suffix. */
export function parseSpec(text: string): ParsedSpec {
  for (const line of text.split(/\r?\n/)) {
    const h1 = HEADING_1.exec(line)
    if (h1 && !line.startsWith('##')) return { title: (h1[1] ?? '').replace(/\s*[—–-]\s*(?:PRD|Spec)\s*$/i, '').trim() }
  }
  return { title: null }
}

export type SeloFlowCommand = {
  /** The skill after `/selo-flow:`. */
  skill: string
  /** What follows the skill, trimmed. */
  args: string
  /** The feature slug the arguments name, when they do. */
  feature: string | null
  /** The plan folder the arguments name, relative, with forward slashes, when they do. */
  folder: string | null
}

const COMMAND = /^\s*\/selo-flow:([a-z-]+)\b\s*([\s\S]*)$/
const PLAN_PATH = /\.planning[\\/]features[\\/]([A-Za-z0-9_.-]+)(?:[\\/]dev-plans[\\/]([A-Za-z0-9_.-]+))?/
// One token, alone or before an option (` — autonomous`): a free request (`add a counter`) names no slug.
const BARE_SLUG = /^`?([a-z0-9][a-z0-9_-]*)`?\s*(?:—|$)/i

/**
 * Reads a `/selo-flow:…` prompt: the skill and the feature it works on.
 * The feature comes from a `.planning/features/{slug}` path, or, for
 * `write-plan`, `write-spec` and `autopilot`, from a bare slug as the argument.
 */
export function parseSeloFlowCommand(text: string): SeloFlowCommand | null {
  const m = COMMAND.exec(text)
  if (!m) return null
  const skill = m[1] ?? ''
  const args = (m[2] ?? '').trim()
  const path = PLAN_PATH.exec(args)
  let feature = path?.[1] ?? null
  const folder = path?.[2] ? `.planning/features/${path[1]}/dev-plans/${path[2]}` : null
  if (feature === null && (skill === 'write-plan' || skill === 'write-spec' || skill === 'autopilot' || skill === 'review')) {
    feature = BARE_SLUG.exec(args)?.[1] ?? null
  }
  return { skill, args, feature, folder }
}

/** The feature a commit command names in its scope (`-m "docs(demo): spec — …"`), when it does. */
export function commitFeature(command: string): string | null {
  return /\b[a-z]+\(([A-Za-z0-9_.-]+)\)!?:/.exec(command)?.[1] ?? null
}

export function stagesDone(plan: SeloFlowBoardPlan): boolean {
  return plan.stages.length > 0 && plan.stages.every(s => s.total > 0 && s.done === s.total)
}

/** Every stage and the Validation's `Review` ticked; the optional items do not hold it back. */
export function isFinalized(plan: SeloFlowBoardPlan): boolean {
  return stagesDone(plan) && plan.reviewDone
}

export function nextStage(plan: SeloFlowBoardPlan): SeloFlowBoardStage | null {
  return plan.stages.find(s => s.done < s.total || s.total === 0) ?? null
}

export function featureState(hasSpec: boolean, plan: SeloFlowBoardPlan | null): SeloFlowBoardFeatureState {
  if (plan === null) return hasSpec ? 'spec' : 'empty'
  const ticked = plan.stages.reduce((n, s) => n + s.done, 0)
  if (ticked === 0) return 'plan'
  if (!stagesDone(plan)) return 'running'
  return plan.reviewDone ? 'done' : 'review'
}

/**
 * The feature followed on the plan in `folder`, its state recomputed on it;
 * the latest plan when `folder` names none of its plans (absent, or a plan gone).
 */
export function withPlan(feature: SeloFlowBoardFeature, folder: string | null | undefined): SeloFlowBoardFeature {
  const plan = feature.plans.find(p => p.folder === folder) ?? feature.plans[0] ?? null
  return plan === feature.plan ? feature : { ...feature, plan, state: featureState(feature.hasSpec, plan) }
}

/**
 * True when a run shows on the timeline of the plan the feature is followed on:
 * a spec run always; a run that named a plan folder, on that plan; one that named
 * none (`write-plan {slug}`), on the latest plan.
 */
export function isRunOfPlan(run: SeloFlowBoardRun, feature: SeloFlowBoardFeature): boolean {
  if (run.step === 'spec') return true
  if (run.folder !== null) return run.folder === feature.plan?.folder
  // The new plan being written (`onNewPlan`): only the live run writing it, not the older plans' history.
  if (feature.plan === null && feature.plans.length > 0) return run.status === 'running' || run.status === 'waiting'
  return feature.plan === (feature.plans[0] ?? null)
}

/**
 * The feature while a live `write-plan {slug}` run writes a new plan whose folder
 * is not there yet (its latest plan is committed): followed on no plan, the new
 * one's timeline. `null` when no such run is live.
 */
export function onNewPlan(feature: SeloFlowBoardFeature, runs: SeloFlowBoardRun[]): SeloFlowBoardFeature | null {
  const latest = feature.plans[0]
  const isWriting = runs.some(r => r.feature === feature.slug && r.command === 'write-plan' && r.folder === null && (r.status === 'running' || r.status === 'waiting'))
  if (latest === undefined || latest.isDraft || !isWriting) return null
  return { ...feature, plan: null, state: featureState(feature.hasSpec, null) }
}

/** The features whose latest plan appeared since the previous scan: the pane follows it at once. */
export function newPlans(before: SeloFlowBoard | null, after: SeloFlowBoard): string[] {
  return after.features
    .filter(feature => {
      const latest = feature.plans[0]
      const was = before?.features.find(f => f.slug === feature.slug)
      return latest !== undefined && was !== undefined && !was.plans.some(p => p.folder === latest.folder)
    })
    .map(feature => feature.slug)
}

export type NextAction = {
  /** What the button says. */
  label: string
  /** The prompt the button prepares. */
  prompt: string
  /** When several stages remain: the prompt that chains them all in one session. */
  all?: { label: string; prompt: string }
  /** The prompt that runs the rest of the feature with no click, from this step to the last stage's review. */
  autopilot?: { label: string; prompt: string }
}

const stageName = (stage: SeloFlowBoardStage): string => `Stage ${stage.number}${stage.title ? ` — ${stage.title}` : ''}`

/**
 * A `plan.md` with its Validation's `Review` item ticked (`[ ]` or `[-]` to `[x]`),
 * every other line and the line endings untouched: the review marked done
 * without running it. `null` when the Validation has no `Review` item left to tick.
 */
export function tickReview(text: string): string | null {
  const lines = text.split('\n')
  let section = ''
  for (const [index, line] of lines.entries()) {
    const h2 = HEADING_2.exec(line)
    if (h2 && !line.startsWith('###')) {
      section = (h2[1] ?? '').toLowerCase()
      continue
    }
    if (section !== 'validation') continue
    const box = CHECKBOX.exec(line)
    if (box && /[ -]/.test(box[1] ?? '') && REVIEW_ITEM.test(line.slice(box[0].length))) {
      lines[index] = line.replace(/\[[ -]\]/, '[x]')
      return lines.join('\n')
    }
  }
  return null
}

/** The marker an autopilot prompt carries when the person skips the demo browser test (the pane's checkbox). */
export const BROWSER_MARKER = ' — without browser test'

/** The autopilot prompt of a feature: the rest of it from its plan (its stages), or from its spec. */
function autopilotAction(feature: SeloFlowBoardFeature, noBrowser: boolean | undefined): NextAction['autopilot'] {
  const target = feature.plan?.folder ?? feature.slug
  return { label: '⚡ Autopilot', prompt: `/selo-flow:autopilot ${target}${noBrowser ? BROWSER_MARKER : ''}` }
}

/**
 * The one thing to do next on a feature, and the prompt that does it.
 * `noBrowser`: the autopilot prompt skips the demo browser test (`BROWSER_MARKER`); off by default.
 */
export function nextAction(feature: SeloFlowBoardFeature, options: { noBrowser?: boolean } = {}): NextAction | null {
  const { slug, plan } = feature
  const autopilot = autopilotAction(feature, options.noBrowser)
  switch (feature.state) {
    case 'empty':
      // No spec to start from: the autopilot takes a request, typed from the header's button.
      return { label: 'Écrire la spec', prompt: `/selo-flow:write-spec ${slug}` }
    case 'spec':
      // An area: its spec follows the code, and a plan starts from `+ Nouveau plan` when one is wanted.
      return null
    case 'plan':
    case 'running': {
      if (plan === null) return null
      if (plan.isDraft) return { label: 'Reprendre le plan (brouillon)', prompt: `/selo-flow:write-plan ${slug}`, autopilot }
      const stage = nextStage(plan)
      if (stage === null) return { label: 'Implémenter', prompt: `/selo-flow:implement ${plan.folder}`, autopilot }
      const action: NextAction = {
        label: stageName(stage),
        prompt: `/selo-flow:implement ${plan.folder} — stage ${stage.number}${stage.title ? ` (${stage.title})` : ''}`,
        autopilot,
      }
      const remaining = plan.stages.filter(s => s.number >= stage.number)
      const last = remaining.at(-1)
      if (remaining.length > 1 && last !== undefined) {
        const titles = remaining.map(s => s.title).filter(Boolean)
        action.all = {
          label: `Tout d'un coup (stages ${stage.number}–${last.number})`,
          prompt: `/selo-flow:implement ${plan.folder} — stages ${stage.number}-${last.number}${titles.length > 0 ? ` (${titles.join(', ')})` : ''}, chained`,
        }
      }
      return action
    }
    case 'review':
      return plan ? { label: 'Revue finale', prompt: `/selo-flow:review ${plan.folder}`, autopilot } : null
    case 'done':
      return null
  }
}

/** The timeline steps of a feature, in order: spec, plan, its stages, the review. */
export function steps(feature: SeloFlowBoardFeature): SeloFlowBoardStep[] {
  return ['spec', 'plan', ...(feature.plan?.stages.map(s => `stage:${s.number}`) ?? []), 'review']
}

/** The step a feature stands at: the one `nextAction` prepares. */
export function activeStep(feature: SeloFlowBoardFeature): SeloFlowBoardStep {
  const plan = feature.plan
  switch (feature.state) {
    case 'empty':
      return 'spec'
    case 'spec':
      return 'plan'
    case 'plan':
    case 'running': {
      if (plan === null || plan.isDraft) return 'plan'
      const stage = nextStage(plan)
      return stage ? `stage:${stage.number}` : 'review'
    }
    case 'review':
    case 'done':
      return 'review'
  }
}

/** True once the feature is past the step. */
export function isStepDone(feature: SeloFlowBoardFeature, step: SeloFlowBoardStep): boolean {
  const plan = feature.plan
  if (step === 'spec') return feature.hasSpec
  if (step === 'plan') return plan !== null && !plan.isDraft
  if (step === 'review') return plan !== null && plan.reviewDone
  const stage = plan?.stages.find(s => `stage:${s.number}` === step)
  return stage !== undefined && stage.total > 0 && stage.done === stage.total
}

/** The step a `/selo-flow:` prompt works on, frozen when the run starts. */
export function runStep(command: SeloFlowCommand, feature: SeloFlowBoardFeature | undefined): SeloFlowBoardStep {
  switch (command.skill) {
    case 'write-spec':
      return 'spec'
    case 'write-plan':
      return 'plan'
    case 'review':
      // `review plan {folder}`: the plan; `review {folder}`: the plan's review; `review {slug}`: the area's spec.
      return /^plan\b/.test(command.args) ? 'plan' : command.folder === null && command.feature !== null ? 'spec' : 'review'
    case 'autopilot':
      // The pipeline starts at the feature's step; from a request, at the spec. Moved at each of its subagents.
      return feature ? activeStep(feature) : 'spec'
    default:
      // `— stage 2 (web)`, or the first of `— stages 2-3 (web, e2e), chained`.
      if (/\bstages?\s+\d+/i.test(command.args)) return `stage:${/\bstages?\s+(\d+)/i.exec(command.args)?.[1]}`
      // An implement on a feature the board does not know lands on no row: listed with the sessions only.
      return feature ? activeStep(feature) : command.skill
  }
}

/** The last stage of a chained run (`— stages 2-3 (…), chained`), when the prompt asks for one. */
export function runLastStep(command: SeloFlowCommand): SeloFlowBoardStep | null {
  if (command.skill !== 'implement') return null
  const last = /\bstages\s+\d+\s*[-–]\s*(\d+)/i.exec(command.args)?.[1]
  return last === undefined ? null : `stage:${last}`
}

/**
 * Where a run stands once its session committed: a chained run moves to its
 * next stage and keeps running; any other run, or a chain's last stage, is done.
 */
export function afterCommit(run: SeloFlowBoardRun, feature: SeloFlowBoardFeature | undefined): Pick<SeloFlowBoardRun, 'step' | 'status'> {
  const current = /^stage:(\d+)$/.exec(run.step)?.[1]
  if (run.lastStep === undefined || run.lastStep === null || current === undefined || run.step === run.lastStep) {
    return { step: run.step, status: 'done' }
  }
  const next = feature?.plan?.stages.find(s => s.number > Number(current))?.number ?? Number(current) + 1
  return { step: `stage:${next}`, status: 'running' }
}

/** `16/10 00:21`, local time. */
export function stamp(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * What a new scan proves was committed since the previous one: a stage whose
 * commit reached the branch, a plan that became finalized.
 * One line per event, ready for a toast.
 */
export function committed(before: SeloFlowBoard | null, after: SeloFlowBoard): string[] {
  const lines: string[] = []
  for (const feature of after.features) {
    for (const plan of feature.plans) {
      const previous = before?.features.find(f => f.slug === feature.slug)?.plans.find(p => p.folder === plan.folder) ?? null
      for (const stage of plan.stages) {
        const was = previous?.stages.find(s => s.number === stage.number)
        if (stage.sha !== null && (was === undefined || was.sha === null)) {
          lines.push(`${feature.slug} · stage ${stage.number} committé (${stage.sha})`)
        }
      }
      if (isFinalized(plan) && (previous === null || !isFinalized(previous))) {
        lines.push(`${feature.slug} · plan finalisé`)
      }
    }
  }
  return lines
}

/** The name of a timeline step: `Spec`, `Plan`, `Stage 2 — web`, `Revue finale`. */
export function stepTitle(feature: SeloFlowBoardFeature | undefined, step: SeloFlowBoardStep): string {
  if (step === 'spec') return 'Spec'
  if (step === 'plan') return 'Plan'
  if (step === 'review') return 'Revue finale'
  const number = /^stage:(\d+)$/.exec(step)?.[1]
  if (number === undefined) return step
  const stage = feature?.plan?.stages.find(s => String(s.number) === number)
  return `Stage ${number}${stage?.title ? ` — ${stage.title}` : ''}`
}

/**
 * What a session does, for the band above the prompt and the session cards:
 * the step it was started on, frozen, and the feature. Never the plan's next
 * stage: once a stage's boxes are ticked, its session is still finishing it.
 */
export function describeRun(run: SeloFlowBoardRun, feature: SeloFlowBoardFeature | undefined): string {
  return `${runTitle(run, feature)} · ${featureLabel(run)}`
}

/** The command and the step of a session that works outside the workflow: no `/selo-flow:` command, no selo-flow skill. */
export const OFF_WORKFLOW = 'off-workflow'
export const isOffWorkflow = (run: Pick<SeloFlowBoardRun, 'command'>): boolean => run.command === OFF_WORKFLOW

/** The feature a run names, for the band and the cards: `nouvelle feature` before its spec's commit, `hors workflow` off the workflow. */
export const featureLabel = (run: SeloFlowBoardRun): string => (isOffWorkflow(run) ? 'hors workflow' : (run.feature ?? 'nouvelle feature'))

/** What a session does, without its feature: the title of a live session's card. */
export function runTitle(run: SeloFlowBoardRun, feature: SeloFlowBoardFeature | undefined): string {
  switch (run.command) {
    case 'write-spec':
      return 'Spec'
    case 'write-plan':
      return 'Plan'
    case 'review':
      return run.step === 'plan' ? 'Revue du plan' : 'Revue'
    case OFF_WORKFLOW:
      return 'Session libre'
    case 'autopilot':
      return `Autopilot · ${stepTitle(feature, run.step)}`
    case 'implement': {
      const isStep = /^stage:\d+$/.test(run.step) || run.step === 'review'
      return isStep ? stepTitle(feature, run.step) : 'Implémentation'
    }
    default:
      return run.command
  }
}

/**
 * The plan a run works on, for its card: the plan its prompt named, the new one
 * a `write-plan {slug}` writes (`null`: its folder is not there yet, unless the
 * latest plan is still a draft), the latest for any other run; none for a spec.
 */
export function runPlan(run: SeloFlowBoardRun, feature: SeloFlowBoardFeature | undefined): SeloFlowBoardPlan | null | undefined {
  if (run.command === 'write-spec' || run.step === 'spec') return undefined
  if (run.folder !== null) return feature?.plans.find(p => p.folder === run.folder) ?? null
  const latest = feature?.plans[0]
  if (run.command === 'write-plan') return latest?.isDraft ? latest : null
  return latest ?? null
}

const isLive = (run: SeloFlowBoardRun): boolean => run.status === 'running' || run.status === 'waiting'
const isPilot = (run: SeloFlowBoardRun): boolean => run.command === 'autopilot'

export const isStageDone = (stage: { done: number; total: number }): boolean => stage.total > 0 && stage.done === stage.total

/** What stands at a step's right: the stage count, the SHA, whether the spec exists. */
export function stepDetail(feature: SeloFlowBoardFeature, step: SeloFlowBoardStep): string {
  const plan = feature.plan
  if (step === 'spec') {
    return feature.hasSpec ? 'présente' : 'absente'
  }
  if (step === 'plan') return plan === null ? '' : plan.isDraft ? 'brouillon' : 'commité'
  if (step === 'review') return plan ? `${plan.validationDone}/${plan.validationTotal}` : ''
  const stage = plan?.stages.find(s => `stage:${s.number}` === step)
  if (stage === undefined) return ''
  return isStageDone(stage) ? (stage.sha ?? 'non committé') : `${stage.done}/${stage.total}`
}

/** The features as the pane follows them: the new plan on its way while a `write-plan` writes it, else the picked plan, else the latest. */
export function followedFeatures(board: SeloFlowBoard, picked: Record<string, string> = {}): SeloFlowBoardFeature[] {
  return board.features.map(f => onNewPlan(f, board.runs) ?? withPlan(f, picked[f.slug]))
}

/** The live autopilot working on a feature, if any. */
export function featurePilot(slug: string, runs: SeloFlowBoardRun[]): SeloFlowBoardRun | undefined {
  return runs.find(r => r.feature === slug && isPilot(r) && isLive(r))
}

/** The live sessions, newest first: a live autopilot stands for its subagents. */
export function liveRuns(runs: SeloFlowBoardRun[]): SeloFlowBoardRun[] {
  const pilots = runs.filter(r => isPilot(r) && isLive(r))
  return runs.filter(r => isLive(r) && !(r.agentId !== undefined && pilots.some(p => p.sessionId === r.sessionId))).sort((a, b) => b.since - a.since)
}

/** The pane's primary button on a followed feature: none while its new plan is on its way (its session writes it) or an autopilot works on it. */
export function featureAction(feature: SeloFlowBoardFeature, runs: SeloFlowBoardRun[], options: { noBrowser?: boolean } = {}): NextAction | null {
  const isNewPlan = feature.plan === null && feature.plans.length > 0
  return isNewPlan || featurePilot(feature.slug, runs) ? null : nextAction(feature, options)
}

/** The runs on a step's row, newest first: an autopilot's own run moves along the steps, each row keeps its subagent's. */
export function stepRuns(feature: SeloFlowBoardFeature, runs: SeloFlowBoardRun[], step: SeloFlowBoardStep): SeloFlowBoardRun[] {
  return runs.filter(r => r.feature === feature.slug && r.step === step && !isPilot(r) && isRunOfPlan(r, feature)).sort((a, b) => b.since - a.since)
}

export function stepMarker(feature: SeloFlowBoardFeature, runs: SeloFlowBoardRun[], step: SeloFlowBoardStep): SeloFlowBoardMarker {
  if (stepRuns(feature, runs, step).some(isLive) || featurePilot(feature.slug, runs)?.step === step) return 'running'
  if (isStepDone(feature, step)) return 'done'
  return step === activeStep(feature) ? 'next' : 'pending'
}

/** A commit question closes its turn: a fenced block whose first line is a `{type}({scope}): …` subject. */
const COMMIT_BLOCK = /```[^\n]*\n(\w+\([^)\n]+\): [^\n]+[\s\S]*?)\n?```\s*$/
const DONE_FOOTER = /^##\s*✅\s*JOB DONE\s*$/m
const FOOTER_COMMIT = /^`([0-9a-f]{7,40})`\s+(.+?)(?:\s+·\s+branch\b.*)?$/

/**
 * Where a turn left its run, read from the turn's final text, as the workflow rules shape it: a commit
 * question ends on its message in a code block; a turn that committed ends with the done footer, its
 * `> ` recap line and one line per commit. Any other end of a live run waits for an answer.
 */
export function classifyTurn(answer: string, run: Pick<SeloFlowBoardRun, 'status'>): Pick<SeloFlowBoardRun, 'phase' | 'pendingCommit' | 'recap'> {
  const block = COMMIT_BLOCK.exec(answer.trimEnd())
  if (block) return { phase: 'awaiting-commit', pendingCommit: block[1].trim(), recap: null }
  const footer = DONE_FOOTER.exec(answer)
  if (footer) return { phase: 'job-done', pendingCommit: null, recap: parseRecap(answer.slice(footer.index + footer[0].length)) }
  if (run.status === 'done') return { phase: 'job-done', pendingCommit: null }
  return { phase: 'awaiting-answer', pendingCommit: null, recap: null }
}

/** The done footer's lines after its heading: the `> ` recap (null without one) and the commits. */
export function parseRecap(lines: string): SeloFlowBoardRecap {
  let text: string | null = null
  const commits: SeloFlowBoardRecap['commits'] = []
  for (const line of lines.split(/\r?\n/).map(l => l.trim())) {
    const commit = FOOTER_COMMIT.exec(line)
    if (commit) commits.push({ sha: commit[1], subject: commit[2] })
    else if (text === null && line.startsWith('>')) text = line.replace(/^>\s*(?:R[ée]cap\s*:\s*)?/i, '').trim() || null
  }
  return { text, commits }
}

/** A run's phase: the status wins while a turn runs or once it is interrupted; a run from before phases reads from its status. */
export function runPhase(run: SeloFlowBoardRun): SeloFlowBoardPhase {
  if (run.status === 'running') return 'working'
  if (run.status === 'interrupted') return 'interrupted'
  return run.phase ?? (run.status === 'done' ? 'job-done' : 'awaiting-answer')
}

const PHASE_RANK: Record<SeloFlowBoardPhase, number> = { 'awaiting-commit': 0, 'awaiting-answer': 1, working: 2, 'job-done': 3, interrupted: 4 }

/** The sessions' main loops (an autopilot stands for its subagents), newest first, over a month at most. */
export function sessionRunsOf(runs: SeloFlowBoardRun[]): SeloFlowBoardRun[] {
  const latest = new Map<string, SeloFlowBoardRun>()
  for (const r of runs) if (r.agentId === undefined && (latest.get(r.sessionId)?.since ?? -1) < r.since) latest.set(r.sessionId, r)
  return [...latest.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** The project's state at a glance: the session that most needs the person, else the latest one; idle without any. */
export function projectActivity(runs: SeloFlowBoardRun[]): SeloFlowBoardExport['activity'] {
  const sessions = sessionRunsOf(runs).filter(r => r.status !== 'interrupted')
  const top = [...sessions].sort((a, b) => PHASE_RANK[runPhase(a)] - PHASE_RANK[runPhase(b)] || b.updatedAt - a.updatedAt)[0]
  if (top === undefined) return { phase: 'idle', sessionId: null, feature: null, step: null, since: null, pendingCommit: null, recap: null }
  return { phase: runPhase(top), sessionId: top.sessionId, feature: top.feature, step: top.step, since: top.updatedAt, pendingCommit: top.pendingCommit ?? null, recap: top.recap ?? null }
}

/** The board for companion apps: what the pane shows, each feature on the plan it follows by default. */
export function exportBoard(board: SeloFlowBoard): SeloFlowBoardExport {
  const { root, repo, branch, baseBranch, changedCount, models, error, scannedAt, runs } = board
  return {
    schemaVersion: 3,
    scannedAt,
    root,
    repo,
    branch,
    baseBranch,
    changedCount,
    models,
    error,
    markers: { browser: BROWSER_MARKER },
    live: liveRuns(runs),
    activity: projectActivity(runs),
    sessions: sessionRunsOf(runs).map(r => ({ ...r, phase: runPhase(r) })),
    features: followedFeatures(board).map(f => ({
      slug: f.slug,
      title: f.title,
      state: f.state,
      isNewPlan: f.plan === null && f.plans.length > 0,
      hasSpec: f.hasSpec,
      plan: f.plan,
      plans: f.plans.map(p => p.folder),
      autopilot: featurePilot(f.slug, runs) ?? null,
      next: featureAction(f, runs),
      steps: steps(f).map(step => ({ step, title: stepTitle(f, step), detail: stepDetail(f, step), marker: stepMarker(f, runs, step), runs: stepRuns(f, runs, step) })),
    })),
  }
}

/** Where a project's export lands: `{configDir}/selo-flow-board/`, the root named as `~/.claude/projects` names its folders. */
export function exportPath(configDir: string, root: string): string {
  return `${configDir.replace(/[\\/]+$/, '')}/selo-flow-board/${root.replace(/[\\/]+$/, '').replace(/[^A-Za-z0-9]/g, '-')}.json`
}

/**
 * The roles of the manifest's `models` and its one preset.
 * shortcut: a copy of `PRESETS` and `ROLES` in plugins/selo-flow/scripts/manifest.mjs (a mod cannot import it); change both together.
 */
export const MODEL_ROLES = ['planner', 'implementer', 'reviewer', 'runner', 'explorer'] as const
export const STANDARD_MODELS: Record<string, string> = { planner: 'opus', implementer: 'sonnet', reviewer: 'opus', runner: 'haiku', explorer: 'haiku' }
/** The models a subagent's `model:` takes, offered by the pane's configuration screen. */
export const MODEL_CHOICES = ['opus', 'sonnet', 'haiku', 'fable']

/** The `models:` key line of `selo-flow.yaml` and the indented lines under it: [start, end). */
function modelsBlock(lines: string[]): [number, number] | null {
  const start = lines.findIndex(line => /^models:/.test(line))
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length && (/^\s/.test(lines[end] ?? '') || lines[end]?.trim() === '')) end++
  // Blank lines before the next key belong to it.
  while (end > start + 1 && lines[end - 1]?.trim() === '') end--
  return [start, end]
}

/**
 * Every role's model from `selo-flow.yaml`'s `models`: the preset name, a block map
 * or an inline `{…}` map, on the `standard` preset.
 * shortcut: a line read, not a YAML parse; enough for what init and the pane write.
 */
export function readModels(text: string): Record<string, string> {
  const models = { ...STANDARD_MODELS }
  const lines = text.split(/\r?\n/)
  const block = modelsBlock(lines)
  if (block === null) return models
  const body = lines.slice(block[0], block[1]).map(line => line.replace(/(^|\s)#.*$/, '').trim())
  const rest = (body[0] ?? '').slice('models:'.length).trim()
  // A scalar names the preset: `standard` is the only one.
  const pairs = rest.startsWith('{') ? rest.replace(/^\{|\}$/g, '').split(',') : rest === '' ? body.slice(1) : []
  for (const pair of pairs) {
    const m = /^\s*(\w+)\s*:\s*["']?([^"'\s]+)["']?\s*$/.exec(pair)
    if (m && (MODEL_ROLES as readonly string[]).includes(m[1] ?? '')) models[m[1] ?? ''] = m[2] ?? ''
  }
  return models
}

/**
 * `selo-flow.yaml` with its `models` set, written as init does: `models: standard`
 * when every role is the preset's, else the preset and the roles that differ. The other
 * lines and the line endings are kept; a missing key goes before `components:`.
 */
export function setModels(text: string, models: Record<string, string>): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const changed = MODEL_ROLES.filter(role => models[role] && models[role] !== STANDARD_MODELS[role])
  const value = changed.length === 0 ? ['models: standard'] : ['models:', '  preset: standard', ...changed.map(role => `  ${role}: ${models[role]}`)]
  const lines = text.split(/\r?\n/)
  const block = modelsBlock(lines)
  if (block !== null) {
    lines.splice(block[0], block[1] - block[0], ...value)
  } else {
    const components = lines.findIndex(line => /^components:/.test(line))
    const at = components >= 0 ? components : lines.at(-1) === '' ? lines.length - 1 : lines.length
    lines.splice(at, 0, ...value)
  }
  return lines.join(eol)
}
