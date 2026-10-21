// Calendar days travel as "YYYY-MM-DD" strings: no Date parsing of a due date, so no timezone shift.

// The device's calendar day (BR-06).
export function localDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// "2026-10-24" -> "24/10/2026" (FR-16).
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}
