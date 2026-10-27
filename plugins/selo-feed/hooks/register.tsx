import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeKey, Timer } from 'claude-code'

import type { Versions, BarData, BarOptions, Flow, FlowAgent, FlowEntry, Project, ProjectMockup, Recap, RecapItem, Tab } from '../types'

import { plansView, projectOf } from './helper'
import type { HelperActions } from './helper'

import { barSvg, paneSvg } from './svg'
import type { SvgModel } from './svg'

const PANE = 'selo-recap'
const recap = atom({ plugin: 'selo-feed', key: 'recap' } as const, null)
const isOpen = atom({ plugin: 'selo-feed', key: 'isOpen' } as const, false)
const project = atom({ plugin: 'selo-feed', key: 'project' } as const, null)
const tab = atom({ plugin: 'selo-feed', key: 'tab' } as const, 'session' as Tab)
const versions = atom({ plugin: 'selo-feed', key: 'versions' } as const, null as Versions | null)
const bar = atom({ plugin: 'selo-feed', key: 'bar' } as const, null as BarData | null)
const options = atom({ plugin: 'selo-feed', key: 'options' } as const, { autonomous: false, worktree: false, noBrowser: false } as BarOptions)

// The end-of-turn phase of a run: its label and its colour.
const PHASE: Record<string, { label: string; tone: ThemeKey }> = {
  'awaiting-answer': { label: 'Attend ta réponse', tone: 'warning' },
  'awaiting-commit': { label: 'Commit à valider', tone: 'warning' },
  'job-done': { label: 'Fait', tone: 'success' },
  'turn-ended': { label: 'Tour terminé', tone: 'subtle' },
  stopped: { label: 'Arrêté', tone: 'error' },
  working: { label: 'En cours', tone: 'suggestion' },
}
const phaseOf = (phase: string) => PHASE[phase] ?? { label: phase, tone: 'subtle' as ThemeKey }

// Each lane's colour, Selo Ops' (mid tones, readable on a light or a dark theme).
const LANE: Record<string, string> = {
  pilot: '#8b5cf6',
  blueprint: '#14b8a6',
  build: '#14b8a6',
  fastlane: '#84cc16',
  iterate: '#f97316',
  mockup: '#d946ef',
  libre: '#94a3b8',
}
const SUBSTEP: Record<string, string> = {
  bootstrap: 'spec du stub',
  tests: 'tests',
  code: 'code',
  suites: 'suites',
  review: 'revue',
  try: 'test navigateur',
  merge: 'merge du delta',
  commit: 'commit',
}

type ExportRun = {
  id?: string
  agentId?: string | null
  agentType?: string | null
  task?: string | null
  since?: string
  updatedAt?: string
  request?: string
  lane?: string
  flow?: string
  mode?: string | null
  phase?: string
  status?: string | null
  recap?: { text?: string | null; changelogEntry?: string | null } | null
  commits?: { sha: string; subject: string }[]
  trail?: FlowEntry[]
  trailCut?: boolean
}

// Where selo-feed writes this session's file: SELO_OPS_DIR, else ~/.claude/selo.
async function sessionFile($: EngineInterface): Promise<string | null> {
  const dir = (await $.env.get('SELO_OPS_DIR')) ?? null
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? null
  const root = dir ?? (home ? `${home.replace(/\\/g, '/')}/.claude/selo` : null)
  return root ? `${root}/sessions/${await $.session.id()}.json` : null
}

// The current main run's flow: its trail and the subagents started since it opened.
export function flowOf(runs: ExportRun[]): Flow | null {
  const main = runs.find(r => !r.agentId)
  if (!main?.since) return null
  const from = Date.parse(main.since)
  const agents: FlowAgent[] = runs
    .filter(r => r.agentId && r.since && Date.parse(r.since) >= from)
    .reverse()
    .map(r => ({
      id: String(r.agentId),
      type: String(r.agentType ?? 'agent'),
      task: String(r.task ?? r.request ?? ''),
      since: r.since!,
      until: r.updatedAt ?? r.since!,
      phase: String(r.phase ?? 'working'),
    }))
  const trail = Array.isArray(main.trail) && main.trail.length ? main.trail : [{ at: main.since, skill: null, step: null, substep: null, phase: String(main.phase ?? 'working') }]
  return { lane: String(main.flow ?? main.lane ?? 'free'), mode: main.mode ?? null, trail, isCut: main.trailCut === true, agents }
}

// The session's prompts, oldest first, from the export's main runs.
export function recapOf(runs: ExportRun[], readAt: number): Recap {
  const items: RecapItem[] = runs
    .filter(r => !r.agentId)
    .reverse()
    .map(r => ({
      id: String(r.id ?? ''),
      at: r.since ?? null,
      request: String(r.request ?? ''),
      phase: String(r.phase ?? 'working'),
      text: r.recap?.text ?? r.status ?? null,
      commits: (r.commits ?? []).map(c => ({ sha: c.sha, subject: c.subject })),
      changelog: r.recap?.changelogEntry ?? null,
    }))
  const shas = new Set(items.flatMap(i => i.commits.map(c => c.sha)))
  return { items, commits: shas.size, readAt, flow: flowOf(runs) }
}

export type Chapter = {
  at: string
  name: string
  color: string
  detail: string
  ms: number
  waitMs: number
  phase: string
  isCurrent: boolean
  agents: FlowAgent[]
}

const ENDED = new Set(['job-done', 'turn-ended', 'stopped'])
const stageOf = (step: string | null) => /^stage:(\d+)$/.exec(step ?? '')?.[1] ?? null

// One chapter per step of the work: consecutive trail entries of one skill (a build: of one stage).
export function chaptersOf(flow: Flow, now: number): Chapter[] {
  const nameOf = (e: FlowEntry) => {
    if (e.skill === 'fastlane' && flow.mode === 'iterate') return 'fastlane › itération'
    return e.skill ?? (flow.lane === 'free' ? 'libre' : flow.lane)
  }
  const keyOf = (e: FlowEntry) => `${nameOf(e)}|${e.skill === 'build' ? e.step ?? '' : ''}`
  const groups: FlowEntry[][] = []
  for (const e of flow.trail) {
    const last = groups.at(-1)
    if (last && keyOf(last[0]!) === keyOf(e)) last.push(e)
    else groups.push([e])
  }
  return groups.map((g, gi) => {
    const isCurrent = gi === groups.length - 1
    const nextAt = isCurrent ? null : Date.parse(groups[gi + 1]![0]!.at)
    let waitMs = 0
    g.forEach((e, i) => {
      const end = i + 1 < g.length ? Date.parse(g[i + 1]!.at) : nextAt ?? (ENDED.has(e.phase) ? Date.parse(e.at) : now)
      if (e.phase.startsWith('awaiting')) waitMs += Math.max(0, end - Date.parse(e.at))
    })
    const first = g[0]!
    const last = g.at(-1)!
    const start = Date.parse(first.at)
    const end = nextAt ?? (ENDED.has(last.phase) ? Date.parse(last.at) : now)
    const name = nameOf(first)
    const stage = stageOf(first.step)
    const sub = last.substep ? SUBSTEP[last.substep] ?? last.substep : null
    const rounds = g.filter(e => e.phase === 'awaiting-answer').length
    const detail =
      first.skill === 'build' && stage ? [`Étape ${stage}`, sub].filter(Boolean).join(' · ')
      : first.skill === 'pilot' && !isCurrent ? 'choisit la voie'
      : first.skill === 'mockup' && rounds ? `${rounds} aller${rounds > 1 ? 's' : ''}-retour${rounds > 1 ? 's' : ''} avec toi`
      : sub ?? ''
    const agents = flow.agents.filter(a => {
      const t = Date.parse(a.since)
      return t >= start && (nextAt === null || t < nextAt)
    })
    const color = LANE[first.skill === 'fastlane' && flow.mode === 'iterate' ? 'iterate' : first.skill ?? 'libre'] ?? LANE.libre!
    return { at: first.at, name, color, detail, ms: Math.max(0, end - start), waitMs, phase: last.phase, isCurrent, agents }
  })
}

// The session's diff: from before its first commit (else HEAD) to the working tree, untracked files included.
type Diff = { added: number; modified: number; deleted: number; linesAdded: number; linesDeleted: number }
async function sessionDiff($: EngineInterface, firstSha: string | null): Promise<Diff> {
  const d: Diff = { added: 0, modified: 0, deleted: 0, linesAdded: 0, linesDeleted: 0 }
  let cwd: string | undefined
  const git = async (args: string[]) => {
    cwd ??= await $.session.cwd()
    const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 5000 })
    return r.exitCode === 0 ? String(r.stdout) : null
  }
  try {
    const parent = firstSha ? (await git(['rev-parse', '--verify', '--quiet', `${firstSha}^`]))?.trim() : null
    const base = parent || 'HEAD'
    for (const line of ((await git(['diff', '--name-status', base])) ?? '').split(/\r?\n/)) {
      const k = line.charAt(0)
      if (k === 'A') d.added++
      else if (k === 'D') d.deleted++
      else if (k) d.modified++
    }
    d.added += ((await git(['ls-files', '--others', '--exclude-standard'])) ?? '').split(/\r?\n/).filter(Boolean).length
    const stat = (await git(['diff', '--shortstat', base])) ?? ''
    d.linesAdded = Number(/(\d+) insertion/.exec(stat)?.[1] ?? 0)
    d.linesDeleted = Number(/(\d+) deletion/.exec(stat)?.[1] ?? 0)
  } catch {
    // No git here: the counts stay at zero.
  }
  return d
}

// The versions Claude Code lists as installed: selo-flow for this session's folder (else the user's), selo-feed the user's.
async function readVersions($: EngineInterface): Promise<Versions | null> {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    if (!home) return null
    const file = `${home.replace(/\\/g, '/')}/.claude/plugins/installed_plugins.json`
    if (!(await $.fs.exists(file))) return null
    const j = JSON.parse(await $.fs.read(file))
    const all = (j.plugins ?? j) as Record<string, { scope?: string; projectPath?: string; version?: string }[]>
    const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    const cwd = norm(await $.session.cwd())
    const pick = (id: string) => {
      const list = all[id] ?? []
      return (list.find(x => x.scope === 'project' && x.projectPath && norm(x.projectPath) === cwd) ?? list.find(x => x.scope === 'user') ?? list[0])?.version ?? null
    }
    return { selo: pick('selo-flow@selo'), seloFeed: pick('selo-feed@selo') }
  } catch {
    return null
  }
}

async function refresh($: EngineInterface): Promise<void> {
  const path = await sessionFile($)
  if (!path || !(await $.fs.exists(path))) return
  try {
    const s = JSON.parse(await $.fs.read(path))
    const next = recapOf(Array.isArray(s.runs) ? s.runs : [], await $.clock.now())
    await update($, recap, () => next)
    // The band's data line: git's view of the working tree, the export's commits, tokens and next step.
    const main = (Array.isArray(s.runs) ? s.runs : []).find((r: ExportRun) => !r.agentId) as (ExportRun & { resumePrompt?: string | null; next?: { text: string; prompt: string }[] }) | undefined
    const tokens = Object.values((s.usage?.tokens ?? {}) as Record<string, number>).reduce((n, v) => n + (Number(v) || 0), 0)
    const firstSha = next.items.flatMap(i => i.commits)[0]?.sha ?? null
    const files = await sessionDiff($, firstSha)
    const nextStep = main?.next?.[0] ? { label: main.next[0].text, prompt: main.next[0].prompt } : main?.resumePrompt ? { label: 'Reprendre', prompt: main.resumePrompt } : null
    await update($, bar, () => ({ ...files, commits: next.commits, tokens, output: Number(s.usage?.tokens?.output ?? 0), next: nextStep }))
    // The project's blueprints and mockups: the export's file of this root, beside the sessions.
    const projectPath = typeof s.rootKey === 'string' ? path.replace(/sessions\/[^/]+$/,`projects/${s.rootKey}.json`) : null
    if (projectPath && (await $.fs.exists(projectPath))) {
      const p: Project = projectOf(JSON.parse(await $.fs.read(projectPath)))
      await update($, project, () => p)
    }
  } catch {
    // A file caught mid-write: the next refresh reads it whole.
  }
}

const two = (n: number) => String(n).padStart(2, '0')
const clock = (at: string | number | null, seconds = false) => {
  const d = at === null ? null : new Date(at)
  if (!d || Number.isNaN(d.getTime())) return '--:--'
  return `${two(d.getHours())}:${two(d.getMinutes())}${seconds ? `:${two(d.getSeconds())}` : ''}`
}
export const duration = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m} min ${two(s % 60)}` : `${m} min`
  return `${Math.floor(m / 60)} h ${two(m % 60)}`
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const summary = (r: Recap) => {
  const entries = r.items.filter(i => i.changelog).length
  return [plural(r.items.length, 'prompt'), plural(r.commits, 'commit'), entries ? plural(entries, 'entrée de changelog', 'entrées de changelog') : null].filter(Boolean).join(' · ')
}

// While the pane is open, the export is read every 5 s: the flow moves during the turn.
let ticker: Timer | null = null
const startTicker = ($: EngineInterface) => {
  ticker?.cancel()
  ticker = $.clock.every(5000, () => void refresh($))
}
const endTicker = () => {
  ticker?.cancel()
  ticker = null
}

async function togglePane($: EngineInterface): Promise<void> {
  if (await read($, isOpen)) {
    endTicker()
    await $.ui.close({ id: PANE })
    await update($, isOpen, () => false)
    return
  }
  await refresh($)
  await $.ui.open({ id: PANE, title: 'Selo' })
  await update($, isOpen, () => true)
  startTicker($)
}

// The session tab: the designed timeline on the surfaces that draw an Svg, the text one elsewhere.
const drawSession = async ($: EngineInterface, e: any) => {
  const { Box, Button, Text } = $.ui.resolve(e)
  const r = await read($, recap)
  const now = await $.clock.now()

  if (!r || r.items.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Récap de la session</Text>
        <Text dimColor>Rien encore : selo-feed écrit le récap à la fin de chaque tour.</Text>
      </Box>
    )
  }

  // The surfaces that draw an Svg get the designed pane; the terminal, the text timeline below.
  if (e.surface === 'desktop' || e.surface === 'mobile') {
    const { Svg } = $.ui.resolve(e as Parameters<typeof $.ui.resolve>[0] & { surface: 'desktop' })
    const flowChapters = r.flow ? chaptersOf(r.flow, now) : []
    const cur = r.items.at(-1)!
    const running = cur.phase === 'working'
    const sinceCur = cur.at ? Math.max(0, now - Date.parse(cur.at)) : 0
    const firstAt = r.items[0]!.at
    const toneOf = (phase: string): SvgModel['current']['tone'] =>
      phase === 'working' ? 'run' : phase === 'job-done' || phase === 'turn-ended' ? 'ok' : phase.startsWith('awaiting') ? 'wait' : phase === 'stopped' ? 'stop' : 'idle'
    const width = Math.round(Math.min(760, Math.max(360, e.props.bodyColumns * 8)))
    const v = await read($, versions)
    const model: SvgModel = {
      width,
      versions: v ? [v.selo && `selo-flow ${v.selo}`, v.seloFeed && `selo-feed ${v.seloFeed}`].filter(Boolean).join(' · ') : undefined,
      prompts: r.items.length,
      commits: r.commits,
      span: duration(firstAt ? Math.max(0, now - Date.parse(firstAt)) : 0),
      live: running,
      past: r.items.slice(0, -1).map(i => ({ time: clock(i.at), request: oneLine(i.request), phase: i.phase, text: i.text, commits: i.commits })),
      current: {
        time: clock(cur.at),
        request: oneLine(cur.request),
        phase: cur.phase,
        text: running ? null : cur.text,
        commits: cur.commits,
        state: running ? `En cours · ${duration(sinceCur)}` : phaseOf(cur.phase).label,
        tone: toneOf(cur.phase),
        steps: flowChapters.some(c => c.name !== 'libre')
          ? flowChapters.map(c => ({
              label: [c.name, c.detail].filter(Boolean).join(' · '),
              right: duration(c.ms),
              state: c.isCurrent && running ? ('active' as const) : ('done' as const),
            }))
          : [],
      },
      now: clock(now, true),
    }
    const { svg, height } = paneSvg(model)
    return (
      <Box flexDirection="column">
        <Svg source={svg} alt={`Récap de la session : ${plural(r.items.length, 'prompt')}, ${plural(r.commits, 'commit')}`} width={width} height={height} />
      </Box>
    )
  }

  const chapters = r.flow ? chaptersOf(r.flow, now) : []
  const waited = chapters.reduce((n, c) => n + c.waitMs, 0)
  const current = r.items.at(-1)!
  const past = r.items.slice(0, -1)
  const first = r.items[0]!.at
  const span = first ? Math.max(0, now - Date.parse(first)) : 0
  const cols = Math.max(30, e.props.bodyColumns)
  // A one-line text cut to the room it has, with an ellipsis: a surface may not truncate by itself.
  const cut = (s: string, room: number) => (s.length > room ? `${s.slice(0, Math.max(1, room - 1))}…` : s)
  const ask = (i: RecapItem) => oneLine(i.request) || '(sans texte)'

  const details = (i: RecapItem, bold: boolean) => [
    <Box key="r" alignItems="flex-start" gap={1}>
      <Text dimColor>{'>'}</Text>
      {i.text ? <Text bold={bold}>{i.text}</Text> : <Text dimColor italic>Pas de récap pour ce prompt.</Text>}
    </Box>,
    ...i.commits.map(c => (
      <Box key={`c-${c.sha}`} alignItems="flex-start" gap={1}>
        <Text color="suggestion">{c.sha}</Text>
        <Text dimColor>{cut(c.subject, cols - 20)}</Text>
      </Box>
    )),
    ...(i.changelog
      ? [
          <Box key="l" alignItems="flex-start" gap={1}>
            <Text color="success">＋</Text>
            <Text dimColor>{i.changelog}</Text>
          </Box>,
        ]
      : []),
  ]

  // A past prompt: its time, its node in its phase's colour, then what was asked and its recap, aligned.
  // The past prompts, the newest first, under the current one.
  const pastRows = [...past].reverse().map(i => (
    <Box key={`p-${i.id}`} alignItems="flex-start" gap={1} marginBottom={1}>
      <Box width={5} flexShrink={0}>
        <Text dimColor>{clock(i.at)}</Text>
      </Box>
      <Box width={1} flexShrink={0}>
        <Text color={phaseOf(i.phase).tone}>●</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Text dimColor>{cut(ask(i), cols - 9)}</Text>
        {details(i, false)}
      </Box>
    </Box>
  ))

  const cp = phaseOf(current.phase)
  const showFlow = chapters.some(c => c.name !== 'libre')
  const chapterRows = showFlow
    ? chapters.map((c, ci) => (
        <Box key={`ch-${ci}`} flexDirection="column">
          <Box alignItems="flex-start" gap={1} justifyContent="space-between">
            <Box alignItems="flex-start" gap={1} flexShrink={1}>
              <Text color={c.color}>{c.isCurrent ? '◆' : '◇'}</Text>
              <Text dimColor>{clock(c.at, true)}</Text>
              <Text color={c.color} bold>{c.name}</Text>
              {c.detail ? <Text dimColor={!c.isCurrent}>{c.detail}</Text> : null}
              {!c.isCurrent && c.agents.length > 0 ? <Text dimColor>· {plural(c.agents.length, 'sous-agent')}</Text> : null}
            </Box>
            <Box gap={1} flexShrink={0}>
              {c.waitMs > 0 ? <Text color="warning">dont {duration(c.waitMs)} à t'attendre ·</Text> : null}
              <Text bold={c.isCurrent} dimColor={!c.isCurrent}>{duration(c.ms)}</Text>
            </Box>
          </Box>
          {c.isCurrent &&
            c.agents.map(a => (
              <Box key={`ag-${a.id}`} alignItems="flex-start" gap={1} justifyContent="space-between" paddingLeft={2}>
                <Box alignItems="flex-start" gap={1} flexShrink={1}>
                  <Text dimColor>↳</Text>
                  <Text bold>{a.type}</Text>
                  <Text dimColor>{cut(oneLine(a.task), cols - 30)}</Text>
                </Box>
                <Text dimColor>
                  {duration(Math.max(0, (a.phase === 'working' ? now : Date.parse(a.until)) - Date.parse(a.since)))}
                  {a.phase === 'working' ? '' : ' ✓'}
                </Text>
              </Box>
            ))}
        </Box>
      ))
    : []

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" alignItems="center" marginBottom={1}>
        <Box alignItems="flex-start" gap={1}>
          <Text bold>Session</Text>
          <Text dimColor>{summary(r)} · {duration(span)}</Text>
          {waited > 0 ? <Text color="warning">· {duration(waited)} à t'attendre</Text> : null}
        </Box>
        <Button key="refresh" label="Rafraîchir" onPress={() => refresh($)} />
      </Box>
      <Box gap={1} marginBottom={1}>
        <Text color="suggestion">○</Text>
        <Text dimColor>maintenant · {clock(now, true)}</Text>
      </Box>
      <Box key="current" marginBottom={1} flexDirection="column" borderStyle="round" borderColor={cp.tone} paddingX={1}>
        <Box justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box alignItems="flex-start" gap={1} flexShrink={1}>
            <Text dimColor>{clock(current.at)}</Text>
            <Text bold>{cut(ask(current), cols - 12 - cp.label.length)}</Text>
          </Box>
          <Text color={cp.tone} bold>● {cp.label}</Text>
        </Box>
        {r.flow?.isCut && showFlow ? <Text dimColor italic>Entrées plus anciennes non gardées par l'export</Text> : null}
        {chapterRows.length > 0 ? <Box flexDirection="column" marginTop={1} marginBottom={1}>{chapterRows}</Box> : null}
        {current.phase === 'working' && !current.text ? null : details(current, true)}
      </Box>
      {pastRows}
    </Box>
  )
}

// Every action of the helper fills the prompt box: the person reads the command and presses Enter.
const actions = ($: EngineInterface): HelperActions => ({
  fill: command => void fillPrompt($, command),
  // A flag goes to the clipboard of the surface the press came from.
  copy: (text, surface) =>
    void (async () => {
      try {
        const done = await $.ui.copy({ text, surface: surface as never })
        $.ui.toast(done.isCopied ? `Copié : ${text}` : 'Copie impossible ici.')
      } catch {
        $.ui.toast('Copie impossible ici.')
      }
    })(),
  // A validated mockup is built by pilot, with the band's toggles.
  build: (m: ProjectMockup) =>
    void (async () => fillPrompt($, withOptions(`/selo-flow:pilot ${m.title} --mockup ${m.file}`, await read($, options))))(),
})


const tokensOf = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n))
const cutLabel = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
// A pilot, build or fastlane prompt run autonomous while the band's toggle is on.
// What an action launches: its skill, then the toggles' options as the skill takes them; the request is typed after.
export function launchOf(skill: string, o: BarOptions): string {
  const flags = [
    o.noBrowser && (skill === 'pilot' || skill === 'fastlane') ? '--no-browser' : null,
    o.worktree ? '--worktree' : null,
    o.autonomous && (skill === 'pilot' || skill === 'fastlane') ? '--autonomous' : null,
  ].filter(Boolean)
  return `/selo-flow:${skill} ${flags.length ? `${flags.join(' ')} ` : ''}`
}
// A next step run with the toggles: --autonomous on a pilot, build or fastlane, --worktree, --no-browser where taken.
export const withOptions = (prompt: string, o: BarOptions) => {
  let out = withAutonomous(prompt, o.autonomous)
  if (o.worktree && /^\/selo(?:-flow)?:(pilot|fastlane|build|blueprint|mockup)\b/.test(out) && !/--worktree\b/.test(out)) out += ' --worktree'
  if (o.noBrowser && /^\/selo(?:-flow)?:(pilot|fastlane|build)\b/.test(out) && !/--no-browser\b/.test(out)) out += ' --no-browser'
  return out
}
const toneKey = (phase: string) =>
  phase === 'working' ? 'run' : phase === 'job-done' || phase === 'turn-ended' ? 'ok' : phase.startsWith('awaiting') ? 'wait' : phase === 'stopped' ? 'stop' : 'idle'
export const withAutonomous = (prompt: string, auto: boolean) =>
  auto && /^\/selo(?:-flow)?:(pilot|fastlane|build)\b/.test(prompt) && !/--autonomous\b/.test(prompt) ? `${prompt} --autonomous` : prompt

// The live context window, as the status line reads it: its share used and its tokens over the window.
async function contextOf($: EngineInterface): Promise<{ percent: number | null; sub: string }> {
  try {
    const { context } = await $.session.usage()
    const tokens = context.tokens ?? null
    const percent = context.percent ?? (tokens !== null && context.window ? (100 * tokens) / context.window : null)
    return { percent, sub: tokens !== null ? `${tokensOf(tokens)} / ${tokensOf(context.window)}` : `fenêtre ${tokensOf(context.window)}` }
  } catch {
    return { percent: null, sub: '' }
  }
}

// Puts a command in the prompt box for the person to read and send.
async function fillPrompt($: EngineInterface, text: string): Promise<void> {
  try {
    const done = await $.prompt.fill({ text, mode: 'replace' })
    if (!done.isFilled) $.ui.toast('La zone de saisie n’est pas disponible.')
  } catch {
    $.ui.toast('La zone de saisie n’est pas disponible.')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'recap', description: 'Ouvre ou ferme le récap de la session' })
    // A resumed session has its recap at once; a reload finds its pane open.
    await refresh($)
    await update($, versions, () => null)
    void readVersions($).then(v => update($, versions, () => v))
    if (await read($, isOpen)) startTicker($)
    return next(e)
  })

  on('command.run', { command: 'recap' }, async $ => {
    await togglePane($)
    return { text: (await read($, isOpen)) ? 'Récap ouvert.' : 'Récap fermé.' }
  })

  // The person closed the pane from its own mark: the band's button follows.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      endTicker()
      await update($, isOpen, () => false)
    }
    return next(e)
  })

  // selo-feed writes the file in its Stop hook: read once the turn is over, then again in case it was late.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    void (async () => {
      await $.clock.sleep(800)
      await refresh($)
      await $.clock.sleep(2500)
      await refresh($)
    })()
    return done
  })

  // Always there, yielding to a survey only: the toggle alone, on the right, filled while the pane is open.
  // Always there, yielding to a survey only: the controls (toggles left, actions right), then the figures.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const open = await read($, isOpen)
    const o = await read($, options)
    const d = await read($, bar)
    const r = await read($, recap)
    const now = await $.clock.now()
    const nextPrompt = d?.next ? withOptions(d.next.prompt, o) : null
    const first = r?.items[0]?.at ?? null
    const cur = r?.items.at(-1) ?? null
    const spanMs = first ? Math.max(0, now - Date.parse(first)) : 0
    // The current prompt's flow: its lanes in order, each once in a row, and where it stands.
    const chapters = r?.flow ? chaptersOf(r.flow, now) : []
    const flowLanes = chapters.filter((c, i) => i === 0 || c.name !== chapters[i - 1]!.name).map(c => ({ name: c.name, color: c.color }))
    const here = chapters.at(-1)
    const flowSub = here ? [here.detail, here.isCurrent && cur?.phase === 'working' ? duration(here.ms) : null].filter(Boolean).join(' · ') || (here.name === 'libre' ? 'demande libre' : phaseOf(here.phase).label) : 'demande libre'
    const stats = {
      flow: flowLanes,
      flowSub,
      added: d?.added ?? 0,
      modified: d?.modified ?? 0,
      deleted: d?.deleted ?? 0,
      lines: `+${d?.linesAdded ?? 0} −${d?.linesDeleted ?? 0} lignes`,
      linesShort: `+${d?.linesAdded ?? 0} −${d?.linesDeleted ?? 0}`,
      commits: String(d?.commits ?? 0),
      commitsSub: 'session',
      tokens: tokensOf(d?.tokens ?? 0),
      tokensSub: `${tokensOf(d?.output ?? 0)} out`,
      span: duration(spanMs),
      spanSub: plural(r?.items.length ?? 0, 'prompt'),
      state: cur ? phaseOf(cur.phase).label : '—',
      stateTone: cur ? toneKey(cur.phase) : 'idle',
      stateSub: cur?.at ? `depuis ${clock(cur.at)}` : '',
      context: await contextOf($),
    }
    const rich = e.surface === 'desktop' || e.surface === 'mobile'
    const { Svg } = $.ui.resolve(e as Parameters<typeof $.ui.resolve>[0] & { surface: 'desktop' })
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box justifyContent="space-between" alignItems="center" gap={1}>
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Button key="opt-autonomous" label={o.autonomous ? '✓ --autonomous' : '--autonomous'} variant={o.autonomous ? 'secondary' : undefined} plain={o.autonomous ? undefined : true} dimColor={!o.autonomous} onPress={() => update($, options, v => ({ ...v, autonomous: !v.autonomous }))} />
            <Button key="opt-worktree" label={o.worktree ? '✓ --worktree' : '--worktree'} variant={o.worktree ? 'secondary' : undefined} plain={o.worktree ? undefined : true} dimColor={!o.worktree} onPress={() => update($, options, v => ({ ...v, worktree: !v.worktree }))} />
            <Button key="opt-noBrowser" label={o.noBrowser ? '✓ --no-browser' : '--no-browser'} variant={o.noBrowser ? 'secondary' : undefined} plain={o.noBrowser ? undefined : true} dimColor={!o.noBrowser} onPress={() => update($, options, v => ({ ...v, noBrowser: !v.noBrowser }))} />
          </Box>
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Button key="autopilot" label="Autopilot" plain onPress={() => fillPrompt($, launchOf('pilot', o))} />
            <Button key="mockup" label="Mockup" plain onPress={() => fillPrompt($, launchOf('mockup', o))} />
            <Button key="fastlane" label="Fastlane" plain onPress={() => fillPrompt($, launchOf('fastlane', o))} />
            {d?.next && nextPrompt ? <Button key="next" label={`▶ ${cutLabel(d.next.label, 32)}`} plain onPress={() => fillPrompt($, nextPrompt)} /> : null}
            <Button key="toggle" label={open ? '◨' : '◫'} plain onPress={() => togglePane($)} />
          </Box>
        </Box>
        {rich ? (
          <Svg source={barSvg(stats)} alt={`${stats.added} ajoutés, ${stats.modified} modifiés, ${stats.deleted} supprimés · ${stats.commits} commits · ${stats.tokens} tokens · contexte ${stats.context.sub}`} />
        ) : (
          <Box gap={1}>
            <Text color="success">+{stats.added}</Text>
            <Text color="warning">~{stats.modified}</Text>
            <Text color="error">-{stats.deleted}</Text>
            <Text dimColor>fichiers · {stats.lines} · {plural(d?.commits ?? 0, 'commit')} · {stats.tokens} tokens · {stats.span} · {flowLanes.map(l => l.name).join(' › ') || 'libre'}{stats.context.percent !== null ? ` · contexte ${Math.round(stats.context.percent)} %` : ''}</Text>
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const els = $.ui.resolve(e) as unknown as Parameters<typeof plansView>[0]
    const current = await read($, tab)
    const p = await read($, project)
    const act = actions($)
    const live = p?.blueprints.filter(b => b.state !== 'done').length ?? 0
    const toBuild = p?.mockups.filter(m => m.validated && !m.committed).length ?? 0
    const tabs: [Tab, string][] = [
      ['session', 'Session'],
      ['plans', live + toBuild ? `Plans · ${live + toBuild}` : 'Plans'],
    ]
    const body =
      current === 'plans' ? plansView(els, p, act)
      : await drawSession($, e)
    return (
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          {tabs.map(([id, label]) => (
            <Button key={`tab-${id}`} label={label} variant={current === id ? 'primary' : undefined} onPress={() => update($, tab, () => id)} />
          ))}
        </Box>
        {body}
      </Box>
    )
  })
}
