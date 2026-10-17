/**
 * The state contract of the factory-board mod.
 *
 * The board is rebuilt from the project's files (`.planning/features/*`) and
 * from git; it is never the source of truth. The runs are the only thing the
 * mod keeps on its own, in `$.store`: which session works on which feature.
 */

export type FactoryBoardStage = {
  /** The stage's number in the plan's Progress section. */
  number: number
  /** What follows the dash in `### Stage N — …`, usually the component. */
  title: string
  /** The commit subject the plan announces for the stage, when it has one. */
  commit: string | null
  /** The short SHA of the commit whose subject matches `commit`, once it is on the branch. */
  sha: string | null
  /** Ticked steps. */
  done: number
  /** All steps. */
  total: number
}

export type FactoryBoardPlan = {
  /** The plan folder, relative to the project root, with forward slashes. */
  folder: string
  /** The plan's title (its first `#` heading). */
  title: string
  stages: FactoryBoardStage[]
  validationDone: number
  validationTotal: number
  /** True while `plan.md` is untracked: a draft `write-plan` is still iterating on. */
  isDraft: boolean
}

export type FactoryBoardFeatureState =
  /** A folder with neither spec nor plan. */
  | 'empty'
  /** A spec and no plan. */
  | 'spec'
  /** A plan with no step ticked (a draft included). */
  | 'plan'
  /** Some steps ticked, some left. */
  | 'running'
  /** Every stage ticked, the Validation checklist not yet. */
  | 'review'
  /** Every stage and every validation item ticked: ready to close. */
  | 'done'

export type FactoryBoardFeature = {
  slug: string
  /** The spec's title, else the plan's, else the slug. */
  title: string
  hasSpec: boolean
  /** The spec header's status (`Draft`, `Approved`…), when there is a spec. */
  specStatus: string | null
  /** The latest plan of the feature (highest timestamp), when there is one. */
  plan: FactoryBoardPlan | null
  state: FactoryBoardFeatureState
}

export type FactoryBoardRunStatus = 'running' | 'waiting' | 'done' | 'interrupted'

/**
 * The step of a feature's timeline a run works on: `spec`, `plan`,
 * `stage:{N}`, `review` (the final review) or `close` (the branch).
 */
export type FactoryBoardStep = string

/** One session working on one step of one feature, kept as history once over. */
export type FactoryBoardRun = {
  sessionId: string
  /** The project root the session runs in. */
  root: string
  feature: string
  /** The plan folder the command named, when it named one. */
  folder: string | null
  /** The factory skill the session was started with (`implement`, `write-plan`…). */
  command: string
  /** The timeline step the run works on: frozen at its start, moved only by a chained run's stage commits. */
  step: FactoryBoardStep
  /** The last stage of a chained run (`— stages 2-3 (…), chained`); absent otherwise. */
  lastStep?: FactoryBoardStep | null
  /**
   * `running` while a turn runs, `waiting` once it ended and the person is asked,
   * `done` once the session's main loop committed: the skill's job is over,
   * `interrupted` when the session ended or went silent for a day before that.
   */
  status: FactoryBoardRunStatus
  /** When the run was recorded (ms since the epoch). */
  since: number
  /** The last time the status changed. */
  updatedAt: number
}

export type FactoryBoard = {
  root: string
  branch: string | null
  features: FactoryBoardFeature[]
  runs: FactoryBoardRun[]
  scannedAt: number
  /** Why the board is empty, when it is: no `.planning/features`, or a read that failed. */
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'factory-board': {
      board: FactoryBoard | null
      /** The slug of the feature whose stages are unfolded in the pane. */
      expanded: string | null
      /** True while the pane is open, so the band's button says which way it toggles. */
      isPaneOpen: boolean
    }
  }
}
