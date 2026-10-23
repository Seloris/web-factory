import { createApp } from "./app.js";
import { migrateDatabase, openDatabase } from "./db/client.js";
import { seedDemo } from "./seed/demo.js";
import { systemClock } from "./shared/clock.js";

// The demo the browser tests run on: an in-memory database, migrated and seeded at each start, on its
// own port (PORT, given by a run of the app on its slot). Nothing persists, and the developer's server and
// data are never touched.
const port = Number(process.env.PORT ?? "3101");
const db = openDatabase();
await migrateDatabase(db);
await seedDemo(db, systemClock);
createApp({ db, clock: systemClock }).listen(port, () => {
  console.log(`api demo listening on http://localhost:${port}`);
});
