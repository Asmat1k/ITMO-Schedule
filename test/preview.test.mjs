import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadBundle,
  installDom,
  previewOverlay,
  clickPreviewButton,
} from "./helpers.mjs";

const { summarize, showPreview } = await loadBundle("../src/preview.ts");

const occ = (name) => ({
  date: new Date("2026-09-15T00:00:00"),
  name,
  startTime: "10:00",
});

test("summarize counts lessons and groups subjects, sorted by name", () => {
  const summary = summarize([
    occ("Физика"),
    occ("Алгебра"),
    occ("Физика"),
    occ("Физика"),
  ]);
  assert.equal(summary.lessonCount, 4);
  assert.deepEqual(summary.subjects, [
    { name: "Алгебра", count: 1 },
    { name: "Физика", count: 3 },
  ]);
});

test("summarize on an empty list reports nothing", () => {
  assert.deepEqual(summarize([]), { lessonCount: 0, subjects: [] });
});

test("showPreview renders the count headline and a per-subject list", () => {
  installDom();
  showPreview({
    lessonCount: 4,
    subjects: [
      { name: "Алгебра", count: 1 },
      { name: "Физика", count: 3 },
    ],
  });
  const overlay = previewOverlay();
  assert.ok(overlay);
  assert.match(overlay.textContent, /Нашёл 4 занятий, 2 предметов/);
  const items = overlay.querySelectorAll("li");
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /Алгебра/);
  assert.match(items[1].textContent, /Физика/);
});

test("confirming resolves true and removes the modal", async () => {
  installDom();
  const p = showPreview({ lessonCount: 1, subjects: [{ name: "X", count: 1 }] });
  clickPreviewButton("Скачать .ics");
  assert.equal(await p, true);
  assert.equal(previewOverlay(), null);
});

test("cancelling resolves false and removes the modal", async () => {
  installDom();
  const p = showPreview({ lessonCount: 1, subjects: [{ name: "X", count: 1 }] });
  clickPreviewButton("Отмена");
  assert.equal(await p, false);
  assert.equal(previewOverlay(), null);
});
