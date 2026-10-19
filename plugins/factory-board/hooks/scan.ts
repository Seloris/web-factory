/**
 * Builds the board from the project's files and its git branch. Reads only:
 * `.planning/features/*` and `factory.yaml`'s `base_branch` through `$.fs`;
 * the branch, its commits since the base, the status and the log through git.
 */

import type { EngineInterface } from 'claude-code'

import type { FactoryBoard, FactoryBoardFeature, FactoryBoardPlan } from '../types'
import { featureState, parsePlan, parseSpec } from './planning'

const join = (...parts: string[]): string => parts.join('/')

type Git = {
  branch: string | null
  baseBranch: string
  /** The subjects of the branch's commits since it left the base branch; null when git cannot tell. */
  branchSubjects: string[] | null
  /** Paths with an uncommitted change (modified, staged or untracked), the whole repository. */
  changedCount: number
  /** Untracked paths, relative to the repository, forward slashes. */
  untracked: Set<string>
  /** Short SHA by commit subject; the newest commit with that subject wins. */
  shaBySubject: Map<string, string>
}

async function git($: EngineInterface, root: string, argv: string[]): Promise<string | null> {
  try {
    const ran = await $.process.run(['git', ...argv], { cwd: root, timeoutMs: 10_000 })
    return ran.exitCode === 0 ? ran.stdout : null
  } catch {
    return null
  }
}

/** The manifest's `base_branch`, `main` without one. */
async function readBaseBranch($: EngineInterface, root: string): Promise<string> {
  const text = await $.fs.read(join(root, 'factory.yaml')).catch(() => null)
  // shortcut: a line match, not a YAML parse; enough for the top-level key factory-init writes.
  const m = typeof text === 'string' ? /^base_branch:\s*["']?([^"'\s#]+)/m.exec(text) : null
  return m?.[1] ?? 'main'
}

async function readGit($: EngineInterface, root: string): Promise<Git> {
  const branch = (await git($, root, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim() || null
  const baseBranch = await readBaseBranch($, root)
  // `base..HEAD` starts at the merge base: the branch's own commits. No local base branch: its remote one.
  const range = (await git($, root, ['log', '--format=%s', `${baseBranch}..HEAD`])) ?? (await git($, root, ['log', '--format=%s', `origin/${baseBranch}..HEAD`]))
  const branchSubjects = range === null ? null : range.split(/\r?\n/).filter(Boolean)
  const status = (await git($, root, ['status', '--porcelain', '--untracked-files=all'])) ?? ''
  const lines = status.split(/\r?\n/).filter(line => line.length > 3)
  const untracked = new Set<string>()
  for (const line of lines) {
    if (!line.startsWith('?? ')) continue
    untracked.add(line.slice(3).trim().replace(/^"|"$/g, '').replace(/\\/g, '/'))
  }
  const log = (await git($, root, ['log', '-n', '200', '--format=%h%x09%s'])) ?? ''
  const shaBySubject = new Map<string, string>()
  for (const line of log.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab <= 0) continue
    const subject = line.slice(tab + 1).trim()
    if (!shaBySubject.has(subject)) shaBySubject.set(subject, line.slice(0, tab))
  }
  return { branch, baseBranch, branchSubjects, changedCount: lines.length, untracked, shaBySubject }
}

/** Every plan of a feature, newest first: the folder names start with their timestamp. */
async function readPlans($: EngineInterface, featureDir: string, relFeatureDir: string, state: Git): Promise<FactoryBoardPlan[]> {
  const plansDir = join(featureDir, 'dev-plans')
  if (!(await $.fs.exists(plansDir))) return []
  const folders = (await $.fs.list(plansDir))
    .filter(entry => entry.kind === 'dir')
    .map(entry => entry.name)
    .sort()
    .reverse()
  const plans: FactoryBoardPlan[] = []
  for (const name of folders) {
    const file = join(plansDir, name, 'plan.md')
    if (!(await $.fs.exists(file))) continue
    const text = await $.fs.read(file)
    if (typeof text !== 'string') continue
    const parsed = parsePlan(text)
    const folder = `${relFeatureDir}/dev-plans/${name}`
    for (const stage of parsed.stages) {
      if (stage.commit !== null) stage.sha = state.shaBySubject.get(stage.commit) ?? null
    }
    plans.push({
      folder,
      title: parsed.title ?? name,
      stages: parsed.stages,
      validationDone: parsed.validationDone,
      validationTotal: parsed.validationTotal,
      reviewDone: parsed.reviewDone,
      isDraft: state.untracked.has(`${folder}/plan.md`),
    })
  }
  return plans
}

/** Reads every feature under `{root}/.planning/features`, its plans, and git. */
export async function scanBoard($: EngineInterface, root: string, now: number): Promise<FactoryBoard> {
  const base: FactoryBoard = { root, branch: null, baseBranch: 'main', aheadCount: null, branchFeature: null, changedCount: 0, features: [], runs: [], scannedAt: now, error: null }
  const featuresDir = join(root, '.planning', 'features')
  if (!(await $.fs.exists(featuresDir))) {
    return { ...base, error: 'Pas de dossier .planning/features dans ce projet.' }
  }
  try {
    const state = await readGit($, root)
    const slugs = (await $.fs.list(featuresDir))
      .filter(entry => entry.kind === 'dir')
      .map(entry => entry.name)
      .sort()
    const features: FactoryBoardFeature[] = []
    for (const slug of slugs) {
      const dir = join(featuresDir, slug)
      const specFile = join(dir, '00_spec.md')
      let spec: ReturnType<typeof parseSpec> | null = null
      if (await $.fs.exists(specFile)) {
        const text = await $.fs.read(specFile)
        if (typeof text === 'string') spec = parseSpec(text)
      }
      const plans = await readPlans($, dir, `.planning/features/${slug}`, state)
      const plan = plans[0] ?? null
      features.push({
        slug,
        title: spec?.title ?? plan?.title ?? slug,
        hasSpec: spec !== null,
        specStatus: spec?.status ?? null,
        plans,
        plan,
        state: featureState(spec !== null, plan),
      })
    }
    const { branch, baseBranch, branchSubjects, changedCount } = state
    // The commit scope `{type}({slug}): …` names the feature; the newest commit naming one of the board's wins.
    const scopes = (branchSubjects ?? []).map(subject => /^\w+\(([^)]+)\)!?:/.exec(subject)?.[1])
    const branchFeature = scopes.find(scope => features.some(f => f.slug === scope)) ?? null
    return { ...base, branch, baseBranch, aheadCount: branchSubjects?.length ?? null, branchFeature, changedCount, features }
  } catch (error) {
    return { ...base, error: `Lecture impossible : ${error instanceof Error ? error.message : String(error)}` }
  }
}
