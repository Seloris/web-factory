/**
 * Builds the board from the project's files and its git branch. Reads only:
 * `.planning/features/*` through `$.fs`, the branch and the log through git.
 */

import type { EngineInterface } from 'claude-code'

import type { FactoryBoard, FactoryBoardFeature, FactoryBoardPlan } from '../types'
import { featureState, parsePlan, parseSpec } from './planning'

const join = (...parts: string[]): string => parts.join('/')

type Git = {
  branch: string | null
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

async function readGit($: EngineInterface, root: string): Promise<Git> {
  const branch = (await git($, root, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim() || null
  const status = (await git($, root, ['status', '--porcelain', '--untracked-files=all', '--', '.planning'])) ?? ''
  const untracked = new Set<string>()
  for (const line of status.split(/\r?\n/)) {
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
  return { branch, untracked, shaBySubject }
}

async function readLatestPlan(
  $: EngineInterface,
  featureDir: string,
  relFeatureDir: string,
  state: Git,
): Promise<FactoryBoardPlan | null> {
  const plansDir = join(featureDir, 'dev-plans')
  if (!(await $.fs.exists(plansDir))) return null
  const folders = (await $.fs.list(plansDir))
    .filter(entry => entry.kind === 'dir')
    .map(entry => entry.name)
    .sort()
    .reverse()
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
    return {
      folder,
      title: parsed.title ?? name,
      stages: parsed.stages,
      validationDone: parsed.validationDone,
      validationTotal: parsed.validationTotal,
      isDraft: state.untracked.has(`${folder}/plan.md`),
    }
  }
  return null
}

/** Reads every feature under `{root}/.planning/features`, the latest plan of each, and git. */
export async function scanBoard($: EngineInterface, root: string, now: number): Promise<FactoryBoard> {
  const base: FactoryBoard = { root, branch: null, features: [], runs: [], scannedAt: now, error: null }
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
      const plan = await readLatestPlan($, dir, `.planning/features/${slug}`, state)
      features.push({
        slug,
        title: spec?.title ?? plan?.title ?? slug,
        specStatus: spec?.status ?? null,
        plan,
        state: featureState(spec !== null, plan),
      })
    }
    return { ...base, branch: state.branch, features }
  } catch (error) {
    return { ...base, error: `Lecture impossible : ${error instanceof Error ? error.message : String(error)}` }
  }
}
