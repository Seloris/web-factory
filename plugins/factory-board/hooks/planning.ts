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
        // Review is never declined: only a tick counts.
        if (/[xX]/.test(box[1] ?? '') && REVIEW_ITEM.test(line.slice(box[0].length))) plan.reviewDone = true
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
// One token, alone or before an option (` — autonomous`): a free request (`add a counter`) names no slug.
const BARE_SLUG = /^`?([a-z0-9][a-z0-9_-]*)`?\s*(?:—|$)/i

/**
 * Reads a `/factory:…` prompt: the skill and the feature it works on.
 * The feature comes from a `.planning/features/{slug}` path, or, for
 * `write-plan`, `write-spec` and `autopilot`, from a bare slug as the argument.
 */
export function parseFactoryCommand(text: string): FactoryCommand | null {
  const m = COMMAND.exec(text)
  if (!m) return null
  const skill = m[1] ?? ''
  const args = (m[2] ?? '').trim()
  const path = PLAN_PATH.exec(args)
  let feature = path?.[1] ?? null
  const folder = path?.[2] ? `.planning/features/${path[1]}/dev-plans/${path[2]}` : null
  if (feature === null && (skill === 'write-plan' || skill === 'write-spec' || skill === 'autopilot')) {
    feature = BARE_SLUG.exec(args)?.[1] ?? null
  }
  return { skill, args, feature, folder }
}

/** The feature a commit command names in its scope (`-m "docs(demo): spec — …"`), when it does. */
export function commitFeature(command: string): string | null {
  return /\b[a-z]+\(([A-Za-z0-9_.-]+)\)!?:/.exec(command)?.[1] ?? null
}

export function stagesDone(plan: FactoryBoardPlan): boolean {
  return plan.stages.length > 0 && plan.stages.every(s => s.total > 0 && s.done === s.total)
}

/** Every stage and the Validation's `Review` ticked; the optional items do not hold it back. */
export function isFinalized(plan: FactoryBoardPlan): boolean {
  return stagesDone(plan) && plan.reviewDone
}

export function nextStage(plan: FactoryBoardPlan): FactoryBoardStage | null {
  return plan.stages.find(s => s.done < s.total || s.total === 0) ?? null
}

export function featureState(hasSpec: boolean, plan: FactoryBoardPlan | null): FactoryBoardFeatureState {
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
export function withPlan(feature: FactoryBoardFeature, folder: string | null | undefined): FactoryBoardFeature {
  const plan = feature.plans.find(p => p.folder === folder) ?? feature.plans[0] ?? null
  return plan === feature.plan ? feature : { ...feature, plan, state: featureState(feature.hasSpec, plan) }
}

/**
 * True when a run shows on the timeline of the plan the feature is followed on:
 * a spec run always; a run that named a plan folder, on that plan; one that named
 * none (`write-plan {slug}`), on the latest plan.
 */
export function isRunOfPlan(run: FactoryBoardRun, feature: FactoryBoardFeature): boolean {
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
export function onNewPlan(feature: FactoryBoardFeature, runs: FactoryBoardRun[]): FactoryBoardFeature | null {
  const latest = feature.plans[0]
  const isWriting = runs.some(r => r.feature === feature.slug && r.command === 'write-plan' && r.folder === null && (r.status === 'running' || r.status === 'waiting'))
  if (latest === undefined || latest.isDraft || !isWriting) return null
  return { ...feature, plan: null, state: featureState(feature.hasSpec, null) }
}

/** The features whose latest plan appeared since the previous scan: the pane follows it at once. */
export function newPlans(before: FactoryBoard | null, after: FactoryBoard): string[] {
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
  /** The prompt that runs the rest of the feature with no click, from this step to the final review. */
  autopilot?: { label: string; prompt: string }
}

const stageName = (stage: FactoryBoardStage): string => `Stage ${stage.number}${stage.title ? ` — ${stage.title}` : ''}`

/**
 * A `plan.md` with its Validation's `Review` item ticked (`[ ]` or `[-]` to `[x]`),
 * every other line and the line endings untouched: the final review marked done
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

/** The marker a stage prompt carries when the person asked for the reviewer after the stage (the pane's checkbox). */
export const REVIEW_MARKER = ' — with review'
/** The marker an autopilot prompt carries when the person asked for the browser test (the pane's checkbox). */
export const BROWSER_MARKER = ' — with browser test'

/** The autopilot prompt of a feature: the rest of it from its plan (its stages, the final review), or from its spec. */
function autopilotAction(feature: FactoryBoardFeature, browser: boolean | undefined): NextAction['autopilot'] {
  const target = feature.plan?.folder ?? feature.slug
  return { label: '⚡ Autopilot', prompt: `/factory:autopilot ${target}${browser ? BROWSER_MARKER : ''}` }
}

/**
 * The one thing to do next on a feature, and the prompt that does it.
 * `review`: the stage prompts ask for the reviewer after each stage (`REVIEW_MARKER`); off by default.
 * `browser`: the autopilot prompt asks for the browser test (`BROWSER_MARKER`); off by default.
 */
export function nextAction(feature: FactoryBoardFeature, options: { review?: boolean; browser?: boolean } = {}): NextAction | null {
  const { slug, plan } = feature
  const marker = options.review ? REVIEW_MARKER : ''
  const autopilot = autopilotAction(feature, options.browser)
  switch (feature.state) {
    case 'empty':
      // No spec to start from: the autopilot takes a request, typed from the header's button.
      return { label: 'Écrire la spec', prompt: `/factory:write-spec ${slug}` }
    case 'spec':
      return { label: 'Écrire le plan', prompt: `/factory:write-plan ${slug}`, autopilot }
    case 'plan':
    case 'running': {
      if (plan === null) return null
      if (plan.isDraft) return { label: 'Reprendre le plan (brouillon)', prompt: `/factory:write-plan ${slug}`, autopilot }
      const stage = nextStage(plan)
      if (stage === null) return { label: 'Implémenter', prompt: `/factory:implement ${plan.folder}${marker}`, autopilot }
      const action: NextAction = {
        label: stageName(stage),
        prompt: `/factory:implement ${plan.folder} — stage ${stage.number}${stage.title ? ` (${stage.title})` : ''}${marker}`,
        autopilot,
      }
      const remaining = plan.stages.filter(s => s.number >= stage.number)
      const last = remaining.at(-1)
      if (remaining.length > 1 && last !== undefined) {
        const titles = remaining.map(s => s.title).filter(Boolean)
        action.all = {
          label: `Tout d'un coup (stages ${stage.number}–${last.number})`,
          prompt: `/factory:implement ${plan.folder} — stages ${stage.number}-${last.number}${titles.length > 0 ? ` (${titles.join(', ')})` : ''}, chained${marker}`,
        }
      }
      return action
    }
    case 'review':
      return plan ? { label: 'Revue finale', prompt: `/factory:implement ${plan.folder} — final review`, autopilot } : null
    case 'done':
      // The squash is proposed by the step that finalized the plan: nothing left to prepare.
      return null
  }
}

/** The timeline steps of a feature, in order: spec, plan, its stages, the final review. */
export function steps(feature: FactoryBoardFeature): FactoryBoardStep[] {
  return ['spec', 'plan', ...(feature.plan?.stages.map(s => `stage:${s.number}`) ?? []), 'review']
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
    case 'done':
      return 'review'
  }
}

/** True once the feature is past the step. */
export function isStepDone(feature: FactoryBoardFeature, step: FactoryBoardStep): boolean {
  const plan = feature.plan
  if (step === 'spec') return feature.hasSpec
  if (step === 'plan') return plan !== null && !plan.isDraft
  if (step === 'review') return plan !== null && plan.reviewDone
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
    case 'autopilot':
      // The pipeline starts at the feature's step; from a request, at the spec. Moved at each of its subagents.
      return feature ? activeStep(feature) : 'spec'
    default:
      // `— final review`, followed or not by an option (` — autonomous`).
      if (/final review\b/i.test(command.args)) return 'review'
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
 * commit reached the branch, a plan that became finalized.
 * One line per event, ready for a toast.
 */
export function committed(before: FactoryBoard | null, after: FactoryBoard): string[] {
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
export function stepTitle(feature: FactoryBoardFeature | undefined, step: FactoryBoardStep): string {
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
export function describeRun(run: FactoryBoardRun, feature: FactoryBoardFeature | undefined): string {
  return `${runTitle(run, feature)} · ${run.feature ?? 'nouvelle feature'}`
}

/** What a session does, without its feature: the title of a live session's card. */
export function runTitle(run: FactoryBoardRun, feature: FactoryBoardFeature | undefined): string {
  switch (run.command) {
    case 'write-spec':
      return 'Spec'
    case 'write-plan':
      return 'Plan'
    case 'review':
      return run.step === 'plan' ? 'Revue du plan' : 'Revue'
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
export function runPlan(run: FactoryBoardRun, feature: FactoryBoardFeature | undefined): FactoryBoardPlan | null | undefined {
  if (run.command === 'write-spec' || run.step === 'spec') return undefined
  if (run.folder !== null) return feature?.plans.find(p => p.folder === run.folder) ?? null
  const latest = feature?.plans[0]
  if (run.command === 'write-plan') return latest?.isDraft ? latest : null
  return latest ?? null
}
