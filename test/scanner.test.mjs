import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { loadBundle, installDom, FixedDate } from "./helpers.mjs";

function dayCell(day, lesson) {
  const greyClass = lesson?.grey ? " text-gray-40" : "";
  const inner = lesson
    ? `<div><div><div id="lesson-${day}" class="el-calendar-month-item">
         <div class="item-name">${lesson.name}</div>
         <div class="item-time">${lesson.time}</div>
       </div></div></div>`
    : "<div></div>";
  return `<div class="day-cell"><div class="el-calendar-cell-content">
      <div class="cell-date${greyClass}"><div>${day}</div></div>${inner}
    </div></div>`;
}

// months: array of arrays of { day, name, time, grey? }. Index 0 is the month
// shown after "Сегодня"; each "next" click advances to the following index.
function buildCalendar(months) {
  installDom(`<!doctype html><html><body>
    <div class="el-calendar-header-switch">
      <button class="btn-schedule">Сегодня</button>
      <a id="dates">init</a>
      <button class="nav-next"><span class="icon icon-arrow-right"></span></button>
    </div>
    <div class="wrapper"><div class="el-calendar-table"></div></div>
  </body></html>`);

  const table = document.querySelector(".el-calendar-table");
  const dates = document.getElementById("dates");
  const state = { todayClicks: 0 };

  const render = (idx) => {
    const month = months[idx] ?? [];
    table.innerHTML = month.map((l) => dayCell(l.day, l)).join("");
    dates.textContent = "M" + idx;
  };

  let idx = 0;
  document.querySelector("button.btn-schedule").addEventListener("click", () => {
    idx = 0;
    state.todayClicks++;
    render(0);
  });
  document.querySelector(".nav-next").addEventListener("click", () => {
    idx++;
    render(idx);
  });

  return state;
}

let scanSemester;
const RealDate = globalThis.Date;

before(async () => {
  ({ scanSemester } = await loadBundle("../src/scanner.ts"));
});

after(() => {
  globalThis.Date = RealDate;
});

test("scrapes lessons across months and stops at the first empty month", async () => {
  globalThis.Date = FixedDate;
  const state = buildCalendar([
    [{ day: 16, name: "Базы данных", time: "18:50" }],
    [{ day: 1, name: "Сети", time: "12:00" }],
    [], // empty → stop
  ]);

  const { occurrences, monthsScanned } = await scanSemester(() => {});

  assert.equal(monthsScanned, 3);
  assert.equal(occurrences.length, 2);
  assert.deepEqual(
    occurrences.map((o) => o.name).sort(),
    ["Базы данных", "Сети"],
  );
  // Restores the user's view by clicking "Сегодня" at start and at the end.
  assert.equal(state.todayClicks, 2);
});

test("ignores lessons in greyed adjacent-month cells", async () => {
  globalThis.Date = FixedDate;
  buildCalendar([
    [
      { day: 16, name: "Своя пара", time: "10:00" },
      { day: 20, name: "Чужой месяц", time: "15:30", grey: true },
    ],
    [],
  ]);

  const { occurrences } = await scanSemester(() => {});

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].name, "Своя пара");
});

test("drops lessons earlier than today (forward only)", async () => {
  globalThis.Date = FixedDate; // today = 2026-09-15
  buildCalendar([
    [
      { day: 10, name: "Прошедшая пара", time: "17:10" },
      { day: 16, name: "Будущая пара", time: "17:10" },
    ],
    [],
  ]);

  const { occurrences } = await scanSemester(() => {});

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].name, "Будущая пара");
});

test("maps day numbers to dates anchored at the current month", async () => {
  globalThis.Date = FixedDate; // anchor = September 2026
  buildCalendar([
    [{ day: 16, name: "Сентябрьская", time: "09:00" }],
    [{ day: 1, name: "Октябрьская", time: "09:00" }],
    [],
  ]);

  const { occurrences } = await scanSemester(() => {});
  const byName = Object.fromEntries(occurrences.map((o) => [o.name, o.date]));

  assert.equal(byName["Сентябрьская"].getMonth(), 8); // September (0-based)
  assert.equal(byName["Сентябрьская"].getDate(), 16);
  assert.equal(byName["Октябрьская"].getMonth(), 9); // October
  assert.equal(byName["Октябрьская"].getDate(), 1);
});

test("reports progress once per scanned month", async () => {
  globalThis.Date = FixedDate;
  buildCalendar([
    [{ day: 16, name: "A", time: "10:00" }],
    [{ day: 16, name: "B", time: "10:00" }],
    [],
  ]);

  const seen = [];
  await scanSemester((m) => seen.push(m));

  assert.deepEqual(seen, [1, 2, 3]);
});
