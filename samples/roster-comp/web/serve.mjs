// `npm run dev` and `npm run demo`: ng serve on the port of this run's slot. A run of the app (the selo
// plugin's run.mjs, `npm run app`) gives it in PORT, and the API's url in API_URL, which proxy.conf.mjs reads.
// Without them, the base ports; `--demo` takes the demo's. ng serve reads neither variable itself, and a
// `package.json` script cannot expand $PORT on Windows: hence this file.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const isDemo = process.argv.includes("--demo");
const port = process.env.PORT ?? (isDemo ? "4580" : "4480");
process.env.API_URL ??= isDemo ? "http://localhost:5580" : "http://localhost:5480";

const ng = createRequire(import.meta.url).resolve("@angular/cli/bin/ng.js");
spawn(process.execPath, [ng, "serve", "--port", port], { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 1));
