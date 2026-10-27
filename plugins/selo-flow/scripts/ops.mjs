#!/usr/bin/env node
// A skill's mark for Selo Ops: `node ops.mjs mark {substep} [sheet …]` prints nothing and does nothing.
// The `selo-feed` plugin's PostToolUse hook reads the command. The export itself lives in that plugin
// (plugins/selo-feed/scripts/ops.mjs); any other mode here is silent too.
