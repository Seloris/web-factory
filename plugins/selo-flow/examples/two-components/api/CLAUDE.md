# api — the fake API component

```component
kind: api
stack: fake
layers: [Domain, Application, Api]
commands:
  build: node scripts/echo.mjs build api
  test: node scripts/echo.mjs test api
  lint: node scripts/echo.mjs lint api {files}
  handoff: node scripts/echo.mjs handoff api
  integration_tests: node scripts/echo.mjs integration api --filter "{filter}"
  serve: node scripts/echo.mjs serve api
  demo: node scripts/echo.mjs demo api
serve_url: http://localhost:3000
demo_url: http://localhost:3101
```

## Conventions

- One folder per feature under `src/{Feature}/`, one file per layer.
- Errors are returned, never thrown, from `Application`.
