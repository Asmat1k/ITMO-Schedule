import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

// ics.ts is a single self-contained module (only a type-only import, erased by
// esbuild). Transpile it in-memory and load it, so the test exercises the real
// source without a separate build step.
const ts = readFileSync(new URL("../src/ics.ts", import.meta.url), "utf8");
const { code } = await transform(ts, { loader: "ts", format: "esm" });
const { buildIcs } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);

const occ = (dateStr, name, time) => ({
  date: new Date(dateStr + "T00:00:00"),
  name,
  startTime: time,
});

const weekly = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"].map((x) =>
  occ(x, "Исследование экосистем веб-языков и веб-технологий", "17:10"),
);
const biweekly = ["2026-09-03", "2026-09-17", "2026-10-01"].map((x) =>
  occ(x, "Базы данных и знаний", "18:50"),
);
const irregular = ["2026-09-04", "2026-09-11", "2026-10-02"].map((x) =>
  occ(x, "Научно-исследовательская работа", "15:30"),
);
const single = [occ("2026-09-05", "Разовая пара", "20:30")];

const ics = buildIcs([...weekly, ...biweekly, ...irregular, ...single]);

test("weekly series → RRULE INTERVAL=1, UNTIL in UTC (Moscow 17:10 → 14:10Z)", () => {
  assert.match(ics, /FREQ=WEEKLY;INTERVAL=1;UNTIL=20260922T141000Z/);
});

test("biweekly series → RRULE INTERVAL=2, UNTIL in UTC (Moscow 18:50 → 15:50Z)", () => {
  assert.match(ics, /FREQ=WEEKLY;INTERVAL=2;UNTIL=20261001T155000Z/);
});

test("irregular series → RDATE with TZID, no RRULE", () => {
  assert.match(ics, /RDATE;TZID=Europe\/Moscow:20260911T153000,20261002T153000/);
});

test("single occurrence → no recurrence rule", () => {
  const block = ics.split("Разовая")[1].split("END:VEVENT")[0];
  assert.doesNotMatch(block, /RRULE|RDATE/);
});

test("events carry an explicit Europe/Moscow timezone", () => {
  assert.match(ics, /BEGIN:VTIMEZONE[\s\S]*TZID:Europe\/Moscow[\s\S]*END:VTIMEZONE/);
  assert.match(ics, /DTSTART;TZID=Europe\/Moscow:20260901T171000/);
});

test("four VEVENTs are emitted", () => {
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
});

test("long Russian SUMMARY is folded under 75 octets", () => {
  assert.ok(ics.includes("\r\n "));
});

test("calendar uses CRLF line endings", () => {
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
});

test("UID is deterministic and order-independent (no duplicates on re-import)", () => {
  const a = buildIcs([...weekly, ...biweekly]);
  const b = buildIcs([...biweekly, ...weekly]); // reversed input order
  const uids = (s) => [...s.matchAll(/UID:(.+)/g)].map((m) => m[1].trim()).sort();
  assert.deepEqual(uids(a), uids(b));
});
