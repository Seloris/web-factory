// Stand-in for a real build/test/lint tool: prints what it was asked and succeeds, or fails when
// FAKE_FAIL names its first argument (e.g. FAKE_FAIL=test makes `test` fail), to test the workflow.
const [step, ...rest] = process.argv.slice(2);
if (process.env.FAKE_FAIL === step) {
  console.error(`${step} ${rest.join(" ")}: src/Feature/File.ts:12 — E001 — simulated failure`);
  process.exit(1);
}
console.log(`${step} ${rest.join(" ")}: OK`);
