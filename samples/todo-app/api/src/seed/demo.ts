import type { Database } from "../db/client.js";
import { createTodoRepository } from "../features/todos/todos.repository.js";
import type { Clock } from "../shared/clock.js";

const MINUTE = 60_000;

// Calendar day `offset` days from today, as the `YYYY-MM-DD` a due date holds. Relative to the clock so the
// late and not-late todos stay so whenever the demo starts (`todo` BR-06).
function dayFromToday(now: Date, offset: number): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

// The demo's data, inserted at each start of `npm run demo`: each feature adds the rows its browser
// tests need, through its repository, so the demo shows every screen with something on it.
export async function seedDemo(db: Database, clock: Clock): Promise<void> {
  const todos = createTodoRepository(db);
  const now = clock.now();

  // Oldest first, so the newest todo comes first in the list (`home` FR-01).
  const rows: {
    name: string;
    tag: string | null;
    dueOffset: number | null;
    isCompleted?: boolean;
    isPinned?: boolean;
  }[] = [
    // Late and completed: not shown late (`home` FR-17).
    { name: "Envoyer la déclaration de TVA", tag: "Travail", dueOffset: -5, isCompleted: true },
    // Pinned and completed: pinning is independent of the state (`todo` BR-05).
    { name: "Renouveler l'assurance habitation", tag: "Maison", dueOffset: null, isCompleted: true, isPinned: true },
    { name: "Appeler le plombier", tag: "Maison", dueOffset: -2 },
    { name: "Préparer la présentation du lundi", tag: "Travail", dueOffset: -1, isPinned: true },
    { name: "Acheter du pain et du lait", tag: "Courses", dueOffset: 0 },
    { name: "Réserver le restaurant pour samedi", tag: null, dueOffset: 3 },
    { name: "Relire le contrat de location", tag: "Maison", dueOffset: 14 },
    { name: "Prendre rendez-vous chez le dentiste", tag: null, dueOffset: null },
    { name: "Acheter des fruits", tag: "Courses", dueOffset: null, isCompleted: true },
  ];

  for (const [index, row] of rows.entries()) {
    const inserted = await todos.insert({
      name: row.name,
      tag: row.tag,
      dueDate: row.dueOffset === null ? null : dayFromToday(now, row.dueOffset),
      createdAt: new Date(now.getTime() - (rows.length - index) * MINUTE),
    });
    if (row.isCompleted === true) await todos.setCompleted(inserted.id, true);
    if (row.isPinned === true) await todos.setPinned(inserted.id, true);
  }
}
