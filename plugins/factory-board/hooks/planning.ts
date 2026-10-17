/**
 * Pure readers of the factory's planning files and prompts. No `$` here: every
 * function takes text and returns data, so the tests cover them directly.
 */

import type {
  FactoryBoard,
  FactoryBoardFeature,
  FactoryBoardFeatureState,
  FactoryBoardPlan,
  FactoryBoardRun,
  FactoryBoardStage,
  FactoryBoardStep,
} from '../types'

export type ParsedPlan = {
  title: string | null
  stages: FactoryBoardStage[]
  validationDone: number
  validationTotal: number
}

const HEADING_1 = /^#\s+(.+?)\s*$/
const HEADING_2 = /^##\s+(.+?)\s*$/
const STAGE = /^###\s+Stage\s+(\d+)\s*(?:[—–-]+\s*(.*?))?\s*$/
const COMMIT = /^Commit:\s*`([^`]+)`/
const CHECKBOX = /^\s*[-*]\s+\[([ xX])\]/

/** Reads a `plan.md`: its title, the Progress stages and the Validation count. */
export function parsePlan(text: string): ParsedPlan {
  const plan: ParsedPlan = { title: null, stages: [], validationDone: 0, validationTotal: 0 }
  let section = ''
  let stage: FactoryBoardStage | null = null

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
      }
    }
  }

  return plan
}

export type ParsedSpec = { title: string | null; status: string | null }

const SPEC_STATUS = /\*\*Status\*\*\s*:\s*(.+?)\s*$/

/** Reads a `00_spec.md`: its title (without the PRD suffix) and its status. */
export function parseSpec(text: string): ParsedSpec {
  const spec: ParsedSpec = { title: null, status: null }
  for (const line of text.split(/\r?\n/)) {
    if (spec.title === null) {
      const h1 = HEADING_1.exec(line)
      if (h1 && !line.startsWith('##')) {
        spec.title = (h1[1] ?? '').replace(/\s*[—–-]\s*PRD\s*$/i, '').trim()
        continue
      }
    }
    const status = SPEC_STATUS.exec(line)
    if (status) {
      spec.status = (status[1] ?? '').trim()
    }
    if (spec.title !== null && spec.status !== null) break
  }
  return spec
}

export type FactoryCommand = {
  /** The skill after `/factory:`. */
  skill: string
  /** What follows the skill, trimmed. */
  args: string
  /** The feature slug the arguments name, when they do. */
  feature: string | null
  /** The plan folder the arguments name, relative, with forward slashes, when they do. */
  folder: string | null
}

const COMMAND = /^\s*\/factory:([a-z-]+)\b\s*([\s\S]*)$/
const PLAN_PATH = /\.planning[\\/]features[\\/]([A-Za-z0-9_.-]+)(?:[\\/]dev-plans[\\/]([A-Za-z0-9_.-]+))?/
const BARE_SLUG = /^`?([a-z0-9][a-z0-9_-]*)`?(?:\s|$)/i

/**
 * Reads a `/factory:…` prompt: the skill and the feature it works on.
 * The feature comes from a `.planning/features/{slug}` path, or, for
 * `write-plan` and `write-spec`, from a bare slug as first argument.
 */
export function parseFactoryCommand(text: string): FactoryCommand | null {
  const m = COMMAND.exec(text)
  if (!m) return null
  const skill = m[1] ?? ''
  const args = (m[2] ?? '').trim()
  const path = PLAN_PATH.exec(args)
  let feature = path?.[1] ?? null
  const folder = path?.[2] ? `.planning/features/${path[1]}/dev-plans/${path[2]}` : null
  if (feature === null && (skill === 'write-plan' || skill === 'write-spec')) {
    feature = BARE_SLUG.exec(args)?.[1] ?? null
  }
  return { skill, args, feature, folder }
}

export function stagesDone(plan: FactoryBoardPlan): boolean {
  return plan.stages.length > 0 && plan.stages.every(s => s.total > 0 && s.done === s.total)
}

export function nextStage(plan: FactoryBoardPlan): FactoryBoardStage | null {
  return plan.stages.find(s => s.done < s.total || s.total === 0) ?? null
}

export function featureState(hasSpec: boolean, plan: FactoryBoardPlan | null): FactoryBoardFeatureState {
  if (plan === null) return hasSpec ? 'spec' : 'empty'
  const ticked = plan.stages.reduce((n, s) => n + s.done, 0)
  if (ticked === 0) return 'plan'
  if (!stagesDone(plan)) return 'running'
  if (plan.validationDone < plan.validationTotal) return 'review'
  return 'done'
}

export type NextAction = {
  /** What the button says. */
  label: string
  /** The prompt the button prepares. */
  prompt: string
  /** When several stages remain: the prompt that chains them all in one session. */
  all?: { label: string; prompt: string }
}

const stageName = (stage: FactoryBoardStage): string => `Stage ${stage.number}${stage.title ? ` — ${stage.title}` : ''}`

/** The one thing to do next on a feature, and the prompt that does it. */
export function nextAction(feature: FactoryBoardFeature): NextAction | null {
  const { slug, plan } = feature
  switch (feature.state) {
    case 'empty':
      return { label: 'Écrire la spec', prompt: `/factory:write-spec ${slug}` }
    case 'spec':
      return { label: 'Écrire le plan', prompt: `/factory:write-plan ${slug}` }
    case 'plan':
    case 'running': {
      if (plan === null) return null
      if (plan.isDraft) return { label: 'Reprendre le plan (brouillon)', prompt: `/factory:write-plan ${slug}` }
      const stage = nextStage(plan)
      if (stage === null) return { label: 'Implémenter', prompt: `/factory:implement ${plan.folder}` }
      const action: NextAction = {
        label: stageName(stage),
        prompt: `/factory:implement ${plan.folder} — stage ${stage.number}${stage.title ? ` (${stage.title})` : ''}`,
      }
      const remaining = plan.stages.filter(s => s.number >= stage.number)
      const last = remaining.at(-1)
      if (remaining.length > 1 && last !== undefined) {
        const titles = remaining.map(s => s.title).filter(Boolean)
        action.all = {
          label: `Tout d'un coup (stages ${stage.number}–${last.number})`,
          prompt: `/factory:implement ${plan.folder} — stages ${stage.number}-${last.number}${titles.length > 0 ? ` (${titles.join(', ')})` : ''}, chained`,
        }
      }
      return action
    }
    case 'review':
      return plan ? { label: 'Revue finale', prompt: `/factory:implement ${plan.folder} — final review` } : null
    case 'done':
      return plan ? { label: 'Fermer la branche', prompt: `/factory:implement ${plan.folder} — close the branch` } : null
  }
}

/** The timeline steps of a feature, in order: spec, plan, its stages, the final review, the close. */
export function steps(feature: FactoryBoardFeature): FactoryBoardStep[] {
  return ['spec', 'plan', ...(feature.plan?.stages.map(s => `stage:${s.number}`) ?? []), 'review', 'close']
}

/** The step a feature stands at: the one `nextAction` prepares. */
export function activeStep(feature: FactoryBoardFeature): FactoryBoardStep {
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
      return 'review'
    case 'done':
      return 'close'
  }
}

/** True once the feature is past the step. `close` is never done: a closed feature leaves the board. */
export function isStepDone(feature: FactoryBoardFeature, step: FactoryBoardStep): boolean {
  const plan = feature.plan
  if (step === 'spec') return feature.hasSpec
  if (step === 'plan') return plan !== null && !plan.isDraft
  if (step === 'review') return plan !== null && plan.validationTotal > 0 && plan.validationDone === plan.validationTotal
  const stage = plan?.stages.find(s => `stage:${s.number}` === step)
  return stage !== undefined && stage.total > 0 && stage.done === stage.total
}

/** The step a `/factory:` prompt works on, frozen when the run starts. */
export function runStep(command: FactoryCommand, feature: FactoryBoardFeature | undefined): FactoryBoardStep {
  switch (command.skill) {
    case 'write-spec':
      return 'spec'
    case 'write-plan':
      return 'plan'
    case 'review':
      return /^plan\b/.test(command.args) ? 'plan' : 'review'
    default:
      if (/final review\s*$/i.test(command.args)) return 'review'
      if (/close the branch\s*$/i.test(command.args)) return 'close'
      // `— stage 2 (web)`, or the first of `— stages 2-3 (web, e2e), chained`.
      if (/\bstages?\s+\d+/i.test(command.args)) return `stage:${/\bstages?\s+(\d+)/i.exec(command.args)?.[1]}`
      // An implement on a feature the board does not know lands on no row: listed with the sessions only.
      return feature ? activeStep(feature) : command.skill
  }
}

/** The last stage of a chained run (`— stages 2-3 (…), chained`), when the prompt asks for one. */
export function runLastStep(command: FactoryCommand): FactoryBoardStep | null {
  if (command.skill !== 'implement') return null
  const last = /\bstages\s+\d+\s*[-–]\s*(\d+)/i.exec(command.args)?.[1]
  return last === undefined ? null : `stage:${last}`
}

/**
 * Where a run stands once its session committed: a chained run moves to its
 * next stage and keeps running; any other run, or a chain's last stage, is done.
 */
export function afterCommit(run: FactoryBoardRun, feature: FactoryBoardFeature | undefined): Pick<FactoryBoardRun, 'step' | 'status'> {
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
 * commit reached the branch, a Validation checklist that became complete.
 * One line per event, ready for a toast.
 */
export function committed(before: FactoryBoard | null, after: FactoryBoard): string[] {
  const lines: string[] = []
  for (const feature of after.features) {
    const plan = feature.plan
    if (plan === null) continue
    const previous = before?.features.find(f => f.slug === feature.slug)?.plan ?? null
    for (const stage of plan.stages) {
      const was = previous?.stages.find(s => s.number === stage.number)
      if (stage.sha !== null && (was === undefined || was.sha === null)) {
        lines.push(`${feature.slug} · stage ${stage.number} committé (${stage.sha})`)
      }
    }
    const complete = plan.validationTotal > 0 && plan.validationDone === plan.validationTotal
    const wasComplete =
      previous !== null && previous.validationTotal > 0 && previous.validationDone === previous.validationTotal
    if (complete && !wasComplete) {
      lines.push(`${feature.slug} · validation complète, la branche peut être fermée`)
    }
  }
  return lines
}

/** The name of a timeline step: `Spec`, `Plan`, `Stage 2 — web`, `Revue finale`, `Clôture de la branche`. */
export function stepTitle(feature: FactoryBoardFeature | undefined, step: FactoryBoardStep): string {
  if (step === 'spec') return 'Spec'
  if (step === 'plan') return 'Plan'
  if (step === 'review') return 'Revue finale'
  if (step === 'close') return 'Clôture de la branche'
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
export function describeRun(run: FactoryBoardRun, feature: FactoryBoardFeature | undefined): string {
  switch (run.command) {
    case 'write-spec':
      return `Spec · ${run.feature}`
    case 'write-plan':
      return `Plan · ${run.feature}`
    case 'review':
      return `${run.step === 'plan' ? 'Revue du plan' : 'Revue'} · ${run.feature}`
    case 'implement': {
      const isStep = /^stage:\d+$/.test(run.step) || run.step === 'review' || run.step === 'close'
      return `${isStep ? stepTitle(feature, run.step) : 'Implémentation'} · ${run.feature}`
    }
    default:
      return `${run.command} · ${run.feature}`
  }
}
