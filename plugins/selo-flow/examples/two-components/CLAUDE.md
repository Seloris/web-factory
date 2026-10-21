# two-components

A minimal selo-flow project used to test the plugin's scripts: an `api` component handing an OpenAPI file to a `web` component. Every command is an `echo`, so the workflow can be exercised without a real stack. Its manifest is `selo-flow.yaml`, beside this file.

## Hard rules

- **Never push.** Agents create branches and commits locally; a human pushes.
- Everything written to the repository is in English; agents talk to the person in French.
