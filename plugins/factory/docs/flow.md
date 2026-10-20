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

    spec["/factory:write-spec {feature}<br/><i>optional: else offered from the plan or the code</i>"]
    plan["/factory:write-plan {slug}<br/><i>drafted, summarised, committed on an explicit yes</i>"]
    reviewPlan["/factory:review plan {plan folder}<br/><i>optional</i>"]
    implPlan["/factory:implement {plan folder}"]

    spec --> plan --> reviewPlan --> implPlan

    subgraph stage["One stage per session, per component, in the manifest's order"]
        direction LR
        tests["Tests first<br/><i>layer by layer</i>"]
        verify["Verify<br/><i>build, tests, lint</i>"]
        review["Reviewer<br/><i>read-only, on request (— with review)</i>"]
        commit["Commit<br/><i>one per stage, never pushed</i>"]
        tests --> verify --> review --> commit
    end

    implDirect --> stage
    implPlan --> stage
    stage -- "next stage: new session, same branch" --> stage
    stage -- "last stage committed,<br/>Review left" --> final
    stage -- "last stage committed,<br/>Review ticked" --> close
    final["/factory:implement … final review<br/><i>review, then full tests, browser test,<br/>integration tests on the person's yes</i>"]
    final --> close

    close["Plan finalized<br/><i>squash to one commit proposed, on the person's yes</i>"]
    push([A human pushes])

    close --> push
```

## Reading the diagram

- **Default path.** A request goes straight to `implement`, without a plan. Planning is for large, risky or multi-stage changes, and only when the person asks for it.
- **With a plan.** `write-spec` first when business behaviour is new; a feature with no spec gets one offered, derived from the plan (or, without a plan, from the code); `write-plan` always; the plan is committed only after an explicit yes (silence is not approval); `review plan` is optional.
- **The stage loop.** Each stage runs in a fresh session: tests first, then the component's build, test and lint commands (the noisy ones through `runner`), then the `reviewer` agent when asked (the stage prompt's ` — with review`), then one commit. Integration tests run only on the person's explicit request.
- **Final review.** With a plan, the Validation checklist records the review and the tests. What the last stage left open, `implement … final review` settles: the review, then the full tests, the browser test and the integration tests the person says yes to; a declined one is marked `[-]`.
- **Autopilot.** `/factory:autopilot {request | slug | plan folder}` walks the plan path from where it stands to the plan finalized, each step a fresh-context subagent, no question: the recommended answers are taken and recorded in the spec and the plan. The squash is proposed, never run.
- **Retro.** Every step offers `/factory:retro` last: the session's lessons written to `.planning/retros/`, applied later by `/factory:retro apply` on the person's yes. It sits beside the path, not on it.
- **Plan finalized.** Once the last stage is committed (and, with a plan, `Review` is ticked: the optional items do not hold it back), the step that got there proposes to squash the branch to one commit, on the person's yes; one put off runs later with `implement … close the branch`. Agents never push.
