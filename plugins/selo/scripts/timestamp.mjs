// Prints the dev-plan folder timestamp, {YYYYMMDD}-{HHmmss} in local time. Skills run it instead
// of writing a timestamp by hand (see the planning conventions).
const d = new Date();
const p = (n, w = 2) => String(n).padStart(w, "0");
process.stdout.write(`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}\n`);
