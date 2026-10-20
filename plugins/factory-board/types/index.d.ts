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
  /** The Validation's `Review` item ticked: with every stage ticked, the plan is finalized. */
  reviewDone: boolean
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
  /** Every stage ticked, the Validation's `Review` not yet. */
  | 'review'
  /** Plan finalized: every stage and the Validation's `Review` ticked; the optional items may be left. */
  | 'done'

export type FactoryBoardFeature = {
  slug: string
  /** The spec's title, else the plan's, else the slug. */
  title: string
  hasSpec: boolean
  /** The spec header's status (`Draft`, `Approved`…), when there is a spec. */
  specStatus: string | null
  /** Every plan of the feature, newest first (highest timestamp): one spec, several plans. */
  plans: FactoryBoardPlan[]
  /** The plan the feature is followed on: the latest from the scan, the one picked in the pane once `withPlan` swapped it. */
  plan: FactoryBoardPlan | null
  /** The state on `plan`. */
  state: FactoryBoardFeatureState
}

export type FactoryBoardRunStatus = 'running' | 'waiting' | 'done' | 'interrupted'

/**
 * The step of a feature's timeline a run works on: `spec`, `plan`,
 * `stage:{N}` or `review` (the final review).
 */
export type FactoryBoardStep = string

/** One session working on one step of one feature, kept as history once over. */
export type FactoryBoardRun = {
  sessionId: string
  /** The project root the session runs in: the worktree's path when it runs in one. */
  root: string
  /** The repository's git common dir, absolute: the same from every worktree. Absent on records written before it existed. */
  repo?: string
  /** The feature's slug; null while a spec or an autopilot started from a free request has not committed its spec (the commit's scope names it). */
  feature: string | null
  /** The plan folder the command named, when it named one; an autopilot takes the one its stages name. */
  folder: string | null
  /** The factory skill the session was started with (`implement`, `write-plan`, `autopilot`…). */
  command: string
  /** The timeline step the run works on: frozen at its start, moved only by a chained run's stage commits, or, for an autopilot, by each subagent it spawns. */
  step: FactoryBoardStep
  /** The last stage of a chained run (`— stages 2-3 (…), chained`); absent otherwise. */
  lastStep?: FactoryBoardStep | null
  /** The subagent the run works in, when a `/factory:` brief was given to one through the Agent tool; absent for the session's main loop. */
  agentId?: string
  /**
   * `running` while a turn runs, `waiting` once it ended and the person is asked,
   * `done` once the session's main loop committed: the skill's job is over,
   * `interrupted` when the session ended or went silent for a day before that.
   * An autopilot runs its pipeline in one turn: at its end it is `done` when its
   * last subagent committed, `interrupted` otherwise (stopped on a blocker, aborted).
   */
  status: FactoryBoardRunStatus
  /** When the run was recorded (ms since the epoch). */
  since: number
  /** The last time the status changed. */
  updatedAt: number
}

/** The pane's filter chips: the cards show the features of any chip pressed; none pressed, all of them. */
export type FactoryBoardFilter = 'running' | 'review' | 'plan' | 'no-plan' | 'done'

export type FactoryBoard = {
  root: string
  /** The repository's git common dir, absolute; null when git did not answer. */
  repo: string | null
  branch: string | null
  /** The manifest's `base_branch` (`main` without one): the branch features are squashed into. */
  baseBranch: string
  /** The branch's own commits since it left `baseBranch`; null when git cannot tell. */
  aheadCount: number | null
  /** The feature the branch's commits name (`{type}({slug}): …`), when it is one of `features`. */
  branchFeature: string | null
  /** Uncommitted paths of the repository (modified, staged, untracked). */
  changedCount: number
  /** Every role's model (`planner`, `implementer`…), from `factory.yaml`'s `models` on the `standard` preset. */
  models: Record<string, string>
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
      /** The plan folder picked in each feature's card, by slug; a feature absent here shows its latest plan. */
      pickedPlans: Record<string, string>
      /** The pane's review checkbox: when on, the stage prompts carry `— with review` and the reviewer runs after each stage. */
      reviewStage: boolean
      /** The pane's browser-test checkbox: when on, the autopilot prompts carry `— with browser test`. */
      browserTest: boolean
      /** True while the pane is open, so the band's button says which way it toggles. */
      isPaneOpen: boolean
      /** The filter chips pressed in the pane; empty shows every feature. */
      stateFilters: FactoryBoardFilter[]
      /** True while the pane shows its configuration screen (the models of the roles) instead of the features. */
      isConfigOpen: boolean
      /** The step (`{slug}:{step}`) whose earlier runs are unfolded in the timeline. */
      openHistory: string | null
    }
  }
}
