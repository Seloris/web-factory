/**
 * The state contract of the selo-flow-board mod.
 *
 * The board is rebuilt from the project's files (`.planning/features/*`) and
 * from git; it is never the source of truth. The runs are the only thing the
 * mod keeps on its own, in `$.store`: which session works on which feature.
 */

export type SeloFlowBoardStage = {
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

export type SeloFlowBoardPlan = {
  /** The plan folder, relative to the project root, with forward slashes. */
  folder: string
  /** The plan's title (its first `#` heading). */
  title: string
  stages: SeloFlowBoardStage[]
  validationDone: number
  validationTotal: number
  /** The Validation's `Review` item ticked: with every stage ticked, the plan is finalized. */
  reviewDone: boolean
  /** True while `plan.md` is untracked: a draft `write-plan` is still iterating on. */
  isDraft: boolean
}

export type SeloFlowBoardFeatureState =
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

export type SeloFlowBoardFeature = {
  slug: string
  /** The spec's title, else the plan's, else the slug. */
  title: string
  hasSpec: boolean
  /** The spec header's status (`Draft`, `Approved`…), when there is a spec. */
  specStatus: string | null
  /** Every plan of the feature, newest first (highest timestamp): one spec, several plans. */
  plans: SeloFlowBoardPlan[]
  /** The plan the feature is followed on: the latest from the scan, the one picked in the pane once `withPlan` swapped it. */
  plan: SeloFlowBoardPlan | null
  /** The state on `plan`. */
  state: SeloFlowBoardFeatureState
}

export type SeloFlowBoardRunStatus = 'running' | 'waiting' | 'done' | 'interrupted'

/**
 * Where a session stands for the person, read from the end of its last turn: `working` while a turn runs,
 * `awaiting-commit` when the turn ended on a commit question (its message in a closing code block),
 * `awaiting-answer` when it ended on any other question, `job-done` when it ended with the done footer
 * (or its run is done), `interrupted` with the run.
 */
export type SeloFlowBoardPhase = 'working' | 'awaiting-commit' | 'awaiting-answer' | 'job-done' | 'interrupted'

/** The done footer of a turn: its `> ` recap line in the chat language (null without one) and its commits. */
export type SeloFlowBoardRecap = { text: string | null; commits: { sha: string; subject: string }[] }

/**
 * The step of a feature's timeline a run works on: `spec`, `plan`,
 * `stage:{N}` or `review` (the final review).
 */
export type SeloFlowBoardStep = string

/** One session working on one step of one feature, or off the workflow, kept as history once over. */
export type SeloFlowBoardRun = {
  sessionId: string
  /** The project root the session runs in: the worktree's path when it runs in one. */
  root: string
  /** The repository's git common dir, absolute: the same from every worktree. Absent on records written before it existed. */
  repo?: string
  /** The feature's slug; null off the workflow, and while a spec or an autopilot started from a free request has not committed its spec (the commit's scope names it). */
  feature: string | null
  /** The plan folder the command named, when it named one; an autopilot takes the one its stages name. */
  folder: string | null
  /**
   * selo-flow skill the session was started with (`implement`, `write-plan`, `autopilot`…), or `off-workflow`
   * for a session that works without one (a free request): its `step` is `off-workflow` too, its `feature` and
   * `folder` stay null, and it goes through the same statuses and phases.
   */
  command: string
  /** The timeline step the run works on: frozen at its start, moved only by a chained run's stage commits, or, for an autopilot, by each subagent it spawns. */
  step: SeloFlowBoardStep
  /** The last stage of a chained run (`— stages 2-3 (…), chained`); absent otherwise. */
  lastStep?: SeloFlowBoardStep | null
  /** The subagent the run works in, when a `/selo-flow:` brief was given to one through the Agent tool; absent for the session's main loop. */
  agentId?: string
  /**
   * `running` while a turn runs, `waiting` once it ended and the person is asked,
   * `done` once the session's main loop committed: the skill's job is over,
   * `interrupted` when the session ended or went silent for a day before that.
   * An autopilot runs its pipeline in one turn: at its end it is `done` when its
   * last subagent committed, `interrupted` otherwise (stopped on a blocker, aborted).
   */
  status: SeloFlowBoardRunStatus
  /** Set at each turn's end from its final text; absent on records written before it existed. `runPhase` reads it with the status. */
  phase?: SeloFlowBoardPhase
  /** The commit message the turn ended on, while `awaiting-commit`. */
  pendingCommit?: string | null
  /** The done footer of the last turn that had one. */
  recap?: SeloFlowBoardRecap | null
  /** When the run was recorded (ms since the epoch). */
  since: number
  /** The last time the status changed. */
  updatedAt: number
}

/** The pane's filter chips: the cards show the features of any chip pressed; none pressed, all of them. */
export type SeloFlowBoardFilter = 'running' | 'review' | 'plan' | 'no-plan' | 'done'

export type SeloFlowBoard = {
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
  /** Every role's model (`planner`, `implementer`…), from `selo-flow.yaml`'s `models` on the `standard` preset. */
  models: Record<string, string>
  features: SeloFlowBoardFeature[]
  runs: SeloFlowBoardRun[]
  scannedAt: number
  /** Why the board is empty, when it is: no `.planning/features`, or a read that failed. */
  error: string | null
}

/**
 * Where a step stands on the timeline: `done`, `running` (a live session works
 * on it, even when its boxes are all ticked: it is not committed yet), `next`
 * (the step the prompt button prepares) or `pending`.
 */
export type SeloFlowBoardMarker = 'done' | 'running' | 'next' | 'pending'

/** A button of the pane: what it says and the prompt it prepares. */
export type SeloFlowBoardPrompt = { label: string; prompt: string }

/** One row of a feature's timeline, as the pane draws it. */
export type SeloFlowBoardExportStep = {
  step: SeloFlowBoardStep
  /** `Spec`, `Plan`, `Stage 2 — web`, `Revue finale`. */
  title: string
  /** What stands at the row's right: the spec status, the plan's, a stage count or SHA, the Validation count. */
  detail: string
  marker: SeloFlowBoardMarker
  /** The runs on the row, newest first: an autopilot's own run is on no row, its subagents' are. */
  runs: SeloFlowBoardRun[]
}

export type SeloFlowBoardExportFeature = {
  slug: string
  title: string
  state: SeloFlowBoardFeatureState
  /** A live `write-plan` writes a new plan whose folder is not there yet: `plan` is null, the timeline is that plan's. */
  isNewPlan: boolean
  hasSpec: boolean
  specStatus: string | null
  /** The plan followed: the latest, or none while a new one is on its way. */
  plan: SeloFlowBoardPlan | null
  /** Every plan folder of the feature, newest first. */
  plans: string[]
  /** The live autopilot working on the feature, if any. */
  autopilot: SeloFlowBoardRun | null
  /** The pane's primary button, with its chained and autopilot variants; null where the pane offers none. */
  next: (SeloFlowBoardPrompt & { all?: SeloFlowBoardPrompt; autopilot?: SeloFlowBoardPrompt }) | null
  steps: SeloFlowBoardExportStep[]
}

/**
 * The board written for companion apps at each rescan: one JSON file per
 * project root, `{config dir}/selo-flow-board/{root}.json`, the root named as
 * `~/.claude/projects` names its folders. Not written atomically: a reader that
 * fails to parse it reads it again at its next poll.
 */
export type SeloFlowBoardExport = {
  schemaVersion: 2
  scannedAt: number
  root: string
  repo: string | null
  branch: string | null
  baseBranch: string
  aheadCount: number | null
  changedCount: number
  models: Record<string, string>
  error: string | null
  /** What the pane's checkboxes add at the end of a prompt: `review` to a stage prompt, `browser` to an autopilot prompt. */
  markers: { review: string; browser: string }
  /** The branch line's `Squasher`; null when there is nothing to squash, `isReady` false until the branch's plan is finalized. */
  squash: { prompt: string; isReady: boolean } | null
  /** The live sessions, newest first: a live autopilot stands for its subagents. */
  live: SeloFlowBoardRun[]
  /** The project at a glance: the session that most needs the person (a commit question, then any question, then a turn at work), else the latest; `idle` without any. */
  activity: {
    phase: SeloFlowBoardPhase | 'idle'
    sessionId: string | null
    feature: string | null
    step: SeloFlowBoardStep | null
    /** The last change of that session (ms since the epoch). */
    since: number | null
    pendingCommit: string | null
    recap: SeloFlowBoardRecap | null
  }
  /** Each session's latest main-loop run (an autopilot stands for its subagents), most recently changed first, a month at most, `phase` always set. */
  sessions: (SeloFlowBoardRun & { phase: SeloFlowBoardPhase })[]
  features: SeloFlowBoardExportFeature[]
}

declare module 'claude-code' {
  interface PluginState {
    'selo-flow-board': {
      board: SeloFlowBoard | null
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
      stateFilters: SeloFlowBoardFilter[]
      /** True while the pane shows its configuration screen (the models of the roles) instead of the features. */
      isConfigOpen: boolean
      /** The step (`{slug}:{step}`) whose earlier runs are unfolded in the timeline. */
      openHistory: string | null
    }
  }
}
