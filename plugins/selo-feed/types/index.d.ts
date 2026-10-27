export type RecapCommit = { sha: string; subject: string }

/** One prompt of the session: a main run of the selo-feed export. */
export type RecapItem = {
  id: string
  at: string | null
  request: string
  phase: string
  text: string | null
  commits: RecapCommit[]
  changelog: string | null
}

/** One entry of the current run's trail, as the export keeps it. */
export type FlowEntry = { at: string; skill: string | null; step: string | null; substep: string | null; phase: string }

/** A subagent of the current run. */
export type FlowAgent = { id: string; type: string; task: string; since: string; until: string; phase: string }

/** The current main run: its lane, its trail, its subagents. */
export type Flow = { lane: string; mode: string | null; trail: FlowEntry[]; isCut: boolean; agents: FlowAgent[] }

export type Recap = { items: RecapItem[]; commits: number; readAt: number; flow: Flow | null }

/** A blueprint of the project, from the selo-feed project export. */
export type ProjectBlueprint = {
  name: string
  file: string
  title: string
  state: string
  components: string[]
  mockup: string | null
  next: { label: string; prompt: string; pilot: string | null } | null
  modifiedAt: string | null
}

/** A mockup of the project. */
export type ProjectMockup = { file: string; title: string; validated: boolean; committed: boolean }

export type Project = { name: string | null; isSelo: boolean; blueprints: ProjectBlueprint[]; mockups: ProjectMockup[] }

/** The pane's tab. */
export type Tab = 'session' | 'plans'


/** The band's data line: the working tree's files, the session's commits and tokens, its next step. */
export type BarData = {
  added: number
  modified: number
  deleted: number
  linesAdded: number
  linesDeleted: number
  commits: number
  tokens: number
  output: number
  next: { label: string; prompt: string } | null
}

/** The band's toggles: the options every action adds to its command. */
export type BarOptions = { autonomous: boolean; worktree: boolean; noBrowser: boolean }

/** The selo plugins this session runs: selo-flow for its project (else the user's), selo-feed the user's. */
export type Versions = { selo: string | null; seloFeed: string | null }

declare module 'claude-code' {
  interface PluginState {
    'selo-feed': { recap: Recap | null; isOpen: boolean; project: Project | null; tab: Tab; bar: BarData | null; options: BarOptions; versions: Versions | null }
  }
}
