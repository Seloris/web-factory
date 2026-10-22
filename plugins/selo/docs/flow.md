# The flow at a glance

How a feature, a change or a bug fix travels through selo, from the request to the push. The prose version, with every rule, is `workflow.md`; the commands are in `cheatsheet.md`.

```mermaid
flowchart TD
    request([Request: feature, change, bug fix])
    lane{One component, no new<br/>business rule or entity?}

    request --> lane
    lane -- "yes: fastlane" --> implDirect
    lane -- "no: feature lane" --> spec

    implDirect["/selo:fastlane {request}<br/><i>the area's spec delta in the same commit</i>"]

    spec["/selo:write-spec {request}<br/><i>short grill, new FRs (planned)</i>"]
    plan["/selo:write-plan {slug}<br/><i>Business decisions first</i>"]
    reviewPlan["/selo:review plan {plan folder}<br/><i>optional</i>"]
    implPlan["/selo:fastlane {plan folder} — stage N"]

    spec --> plan --> reviewPlan --> implPlan

    subgraph stage["One stage per component, in the manifest's order"]
        direction LR
        tests["Tests first<br/><i>layer by layer</i>"]
        verify["Verify<br/><i>build, full test, lint</i>"]
        commit["Commit on the base branch<br/><i>named files, Spec: line</i>"]
        tests --> verify --> commit
    end

    implDirect --> stage
    implPlan --> stage
    stage -- "next stage" --> stage
    stage -- "last stage" --> last

    last["Review of the whole work, full suites,<br/>browser test on the demo"]
    push([A human pushes])

    last --> push
```

## Reading the diagram

- **Two lanes.** The fastlane goes straight to `fastlane`, no plan: one commit per component touched, its spec delta inside. The feature lane writes the spec, then the plan, then the stages. `autopilot` reads the code and picks the lane itself (` — fastlane`, ` — with plan` force it); a fastlane that meets a new rule or entity stops before its commit and moves to the feature lane.
- **The spec follows the code.** Every change of behaviour updates its area's spec in the same commit, and the commit body says how: `Spec: {slug} +FR-48 ~FR-13`, or `Spec: none ({reason})`. `spec-check` checks the ids; the commit hook warns when the line is missing.
- **The stage loop.** Tests first, then the component's build, full test and lint (the noisy ones through `runner`), then one commit naming its files on the base branch. Integration tests run only on the person's explicit request.
- **The last stage.** It reviews the whole work once (the `reviewer` agent), runs the full suites of every touched component and the browser test on the demo (` — without browser test` skips it). Findings left open are settled later with `/selo:review {plan folder}`.
- **Autopilot.** `/selo:autopilot {request | slug | plan folder}` walks the lane it picked, each step a fresh-context subagent, no question: the recommended answers are taken and listed as Business decisions and Technical defaults.
- **No branch, no squash.** Every commit lands on the base branch as it is made; agents never push.
