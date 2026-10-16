// UserPromptSubmit hook: a new prompt from the person resets the lead's exploration counter
// (see delegate-exploration.mjs).
import { readEvent, writeState } from "./hook-io.mjs";

const event = await readEvent();
writeState(event.session_id, { count: 0 });
process.exit(0);
