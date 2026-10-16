# The flow at a glance

How a feature, a change or a bug fix travels through the factory, from the request to the push. The prose version, with every rule, is `workflow.md`; the commands are in `cheatsheet.md`.

```mermaid
flowchart TD
    request([Request: feature, change, bug fix])
    decide{Large, risky or<br/>multi-stage change?}

    request --> decide
    decide -- "no (default)" --> implDirect
    decide -- "yes, and the person asks for a plan" --> spec

    implDirect["/factory:implement {request}<br/><i>straight from the request, no plan</i>"]

    spec["/factory:write-spec {feature}<br/><i>optional, business behaviour only</i>"]
    plan["/factory:write-plan {slug}<br/><i>drafted, summarised, committed on an explicit yes</i>"]
    reviewPlan["/factory:review plan {plan folder}<br/><i>optional</i>"]
    implPlan["/factory:implement {plan folder}"]

    spec --> plan --> reviewPlan --> implPlan

    subgraph stage["One stage per session, per component, in the manifest's order"]
        direction LR
        tests["Tests first<br/><i>layer by layer</i>"]
        verify["Verify<br/><i>build, tests, lint</i>"]
        review["Reviewer<br/><i>read-only, before every commit</i>"]
        commit["Commit<br/><i>one per stage, never pushed</i>"]
        tests --> verify --> review --> commit
    end

    implDirect --> stage
    implPlan --> stage
    stage -- "next stage: new session, same branch" --> stage
    stage -- "last stage committed,<br/>Validation checklist ticked" --> close

    close["/factory:implement … close the branch<br/><i>squash to one commit, on the person's yes</i>"]
    push([A human pushes])

    close --> push
```

## Reading the diagram

- **Default path.** A request goes straight to `implement`, without a plan. Planning is for large, risky or multi-stage changes, and only when the person asks for it.
- **With a plan.** `write-spec` only when business behaviour is new; `write-plan` always; the plan is committed only after an explicit yes (silence is not approval); `review plan` is optional.
- **The stage loop.** Each stage runs in a fresh session: tests first, then the component's build, test and lint commands (the noisy ones through `runner`), then the `reviewer` agent, then one commit. Integration tests run only on the person's explicit request.
- **Closing.** Once the last stage is committed (and, with a plan, the Validation checklist is all ticked), `implement … close the branch` squashes the branch to one commit on the person's yes. Agents never push.
