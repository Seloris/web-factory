# two-components

A minimal factory project used to test the `factory` plugin: an `api` component handing an OpenAPI file to a `web` component. Every command is an `echo`, so the workflow can be exercised without a real stack.

```factory
name: two-components
base_branch: main
language:
  chat: fr
  repo: en
models:
  preset: standard
  reviewer: opus
components:
  - name: api
    path: api
    handoff: api/openapi.json
  - name: web
    path: web
    needs: [api]
    url: http://localhost:4200
hooks:
  require_runner: true
  delegate_exploration: true
  exploration_limit: 4
```

## Hard rules

- **Never push.** Agents create branches and commits locally; a human pushes.
- Everything written to the repository is in English; agents talk to the person in French.
