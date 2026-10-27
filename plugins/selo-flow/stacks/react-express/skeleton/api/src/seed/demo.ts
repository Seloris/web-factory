import type { Database } from "../db/client.js";
import type { Clock } from "../shared/clock.js";

// The demo's data, inserted at each start of `npm run demo`: each feature adds the rows its browser
// tests need, through its repository, so the demo shows every screen with something on it.
export async function seedDemo(db: Database, clock: Clock): Promise<void> {
  void db;
  void clock;
}
