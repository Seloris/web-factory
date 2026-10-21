/**
 * Builds the board from the project's files and its git branch. Reads only:
 * `.planning/features/*` and `selo-flow.yaml`'s `base_branch` and `models` through `$.fs`;
 * the branch, the status and the log through git.
 */

import type { EngineInterface } from 'claude-code'

import type { SeloFlowBoard, SeloFlowBoardFeature, SeloFlowBoardPlan } from '../types'
import { featureState, parsePlan, parseSpec, readModels } from './planning'

const join = (...parts: string[]): string => parts.join('/')

type Git = {
  branch: string | null
  baseBranch: string
  /** Paths with an uncommitted change (modified, staged or untracked), the whole repository. */
  changedCount: number
  /** The git common dir, absolute, forward slashes: the same from every worktree of the repository. */
  repo: string | null
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

/** The manifest's text, empty without one. */
async function readManifest($: EngineInterface, root: string): Promise<string> {
  const text = await $.fs.read(join(root, 'selo-flow.yaml')).catch(() => null)
  return typeof text === 'string' ? text : ''
}

/** The manifest's `base_branch`, `main` without one. */
function readBaseBranch(manifest: string): string {
  // shortcut: a line match, not a YAML parse; enough for the top-level key init writes.
  return /^base_branch:\s*["']?([^"'\s#]+)/m.exec(manifest)?.[1] ?? 'main'
}

async function readGit($: EngineInterface, root: string, manifest: string): Promise<Git> {
  const branch = (await git($, root, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim() || null
  const baseBranch = readBaseBranch(manifest)
  const commonDir = (await git($, root, ['rev-parse', '--git-common-dir']))?.trim().split('\\').join('/') || null
  // Relative (`.git`) in a main checkout, absolute in a worktree.
  const repo = commonDir === null ? null : /^([A-Za-z]:)?\//.test(commonDir) ? commonDir : join(root.split('\\').join('/'), commonDir)
  const status = (await git($, root, ['status', '--porcelain', '--untracked-files=all'])) ?? ''
  const lines = status.split(/\r?\n/).filter(line => line.length > 3)
  const untracked = new Set<string>()
  for (const line of lines) {
    if (!line.startsWith('?? ')) continue
    untracked.add(line.slice(3).trim().replace(/^"|"$/g, '').replace(/\\/g, '/'))
  }
  // shortcut: the last 2000 commits of the shared base branch; an older stage shows as not committed. Read by date if a project outgrows it.
  const log = (await git($, root, ['log', '-n', '2000', '--format=%h%x09%s'])) ?? ''
  const shaBySubject = new Map<string, string>()
  for (const line of log.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab <= 0) continue
    const subject = line.slice(tab + 1).trim()
    if (!shaBySubject.has(subject)) shaBySubject.set(subject, line.slice(0, tab))
  }
  return { branch, baseBranch, changedCount: lines.length, repo, untracked, shaBySubject }
}

/** Every plan of a feature, newest first: the folder names start with their timestamp. */
async function readPlans($: EngineInterface, featureDir: string, relFeatureDir: string, state: Git): Promise<SeloFlowBoardPlan[]> {
  const plansDir = join(featureDir, 'dev-plans')
  if (!(await $.fs.exists(plansDir))) return []
  const folders = (await $.fs.list(plansDir))
    .filter(entry => entry.kind === 'dir')
    .map(entry => entry.name)
    .sort()
    .reverse()
  const plans: SeloFlowBoardPlan[] = []
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
export async function scanBoard($: EngineInterface, root: string, now: number): Promise<SeloFlowBoard> {
  const base: SeloFlowBoard = { root, repo: null, branch: null, baseBranch: 'main', changedCount: 0, models: readModels(''), features: [], runs: [], scannedAt: now, error: null }
  const featuresDir = join(root, '.planning', 'features')
  if (!(await $.fs.exists(featuresDir))) {
    return { ...base, error: 'Pas de dossier .planning/features dans ce projet.' }
  }
  try {
    const manifest = await readManifest($, root)
    const state = await readGit($, root, manifest)
    const slugs = (await $.fs.list(featuresDir))
      .filter(entry => entry.kind === 'dir')
      .map(entry => entry.name)
      .sort()
    const features: SeloFlowBoardFeature[] = []
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
    const { branch, baseBranch, changedCount, repo } = state
    return { ...base, repo, branch, baseBranch, models: readModels(manifest), changedCount, features }
  } catch (error) {
    return { ...base, error: `Lecture impossible : ${error instanceof Error ? error.message : String(error)}` }
  }
}
