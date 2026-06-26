import type { LessonOccurrence, ScanResult } from "./types";

function findButtonByText(text: string): HTMLElement | null {
  const buttons = document.querySelectorAll<HTMLElement>("button.btn-schedule");
  for (const b of buttons) {
    if (b.textContent?.trim() === text) return b;
  }
  return null;
}

function nextMonthButton(): HTMLElement | null {
  const arrow = document.querySelector(".el-calendar-header-switch .icon-arrow-right");
  return (arrow?.closest("button") as HTMLElement) ?? null;
}

function datesLabel(): string {
  return document.getElementById("dates")?.textContent?.trim() ?? "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForMonthChange(prev: string, timeout = 3000): Promise<boolean> {
  const step = 100;
  for (let waited = 0; waited < timeout; waited += step) {
    await sleep(step);
    if (datesLabel() !== prev) {
      await sleep(150);
      return true;
    }
  }
  return false;
}

function scrapeMonth(year: number, month: number): LessonOccurrence[] {
  const out: LessonOccurrence[] = [];
  const lessons = document.querySelectorAll<HTMLElement>(
    '.el-calendar-table [id^="lesson-"]',
  );
  for (const el of lessons) {
    const cell = el.closest(".day-cell");
    const cellDate = cell?.querySelector(".cell-date");
    if (!cellDate || cellDate.classList.contains("text-gray-40")) continue;

    const day = parseInt(cellDate.textContent?.trim() ?? "", 10);
    if (!Number.isFinite(day)) continue;

    const name = el.querySelector(".item-name")?.textContent?.trim() ?? "";
    const startTime = el.querySelector(".item-time")?.textContent?.trim() ?? "";
    if (!name || !/^\d{1,2}:\d{2}$/.test(startTime)) continue;

    out.push({ date: new Date(year, month, day), name, startTime });
  }
  return out;
}

export async function scanSemester(
  onProgress: (month: number) => void,
  maxMonths = 10,
): Promise<ScanResult> {
  findButtonByText("Сегодня")?.click();
  await sleep(400);

  const anchor = new Date();
  let year = anchor.getFullYear();
  let month = anchor.getMonth();

  const collected: LessonOccurrence[] = [];
  let monthsScanned = 0;

  for (let i = 0; i < maxMonths; i++) {
    const monthLessons = scrapeMonth(year, month);
    monthsScanned++;
    onProgress(monthsScanned);
    collected.push(...monthLessons);
    if (monthLessons.length === 0) break;

    const prev = datesLabel();
    const next = nextMonthButton();
    if (!next) break;
    next.click();
    if (!(await waitForMonthChange(prev))) break;

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  findButtonByText("Сегодня")?.click();

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const occurrences = collected.filter((o) => o.date >= todayMidnight);

  return { occurrences, monthsScanned };
}
