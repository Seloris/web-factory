# factory-helper

A Claude Code mod (pane) following the factory workflow, to be built. Its spec is `.planning/features/factory-helper/00_spec.md`; the first dev-plan comes from `/factory:write-plan factory-helper` in this repository, and the implementation from `/factory:implement …`, with the `plugin-authoring` skill for the mod's API.

What it will show, driven by the manifest (`plugins/factory/scripts/manifest.mjs`):

- **Start**: tiles for a new spec, a new plan, a new dev without a plan, each with the model its prompt runs on.
- **Plan**: pick a plan by feature or by date, or follow the current branch's dev without a plan; its header, links to `plan.md` and the spec, its Deviations; the timeline (plan → one step per stage in `stages` order → review → tests → close), each step marked done / current / to do from the plan's ticks at `HEAD`, with its tiles.
- **Runs**: what every session of this machine is doing on this repository, with a spinner and a duration; the sessions of each step.
- **Compliance**: a score out of 100 from the session's transcripts (lead model per step vs the preset, subagent models, delegated runs, review before each commit, one stage per session; a hard rule broken scores 0), unfolding to the facts behind each lost point.

It holds no project-specific code: stages, commands and models come from the manifest; stage names appear as the manifest spells them.

Until it exists, the skills' next-prompt code blocks do the job: copy them into a new session on the model the skill names.

Once built, it installs like the workflow plugin: `/plugin install factory-helper --marketplace <github-user>/webapp-factory`.
