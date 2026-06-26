import type { LessonOccurrence, Series } from "./types";
import { hashKey } from "./utils";

const LESSON_MINUTES = 90;

const TZID = "Europe/Moscow";
const MOSCOW_OFFSET_HOURS = 3;

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0300",
  "TZNAME:MSK",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

const pad = (n: number) => String(n).padStart(2, "0");

function fmtWall(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function fmtUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function moscowWallToUtc(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours() - MOSCOW_OFFSET_HOURS,
      d.getMinutes(),
      d.getSeconds(),
    ),
  );
}

function atTime(day: Date, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    limit = 74;
  }
  return chunks.join("\r\n ");
}

function groupSeries(occurrences: LessonOccurrence[]): Series[] {
  const map = new Map<string, Series>();
  for (const o of occurrences) {
    const weekday = o.date.getDay();
    const key = `${o.name}||${weekday}||${o.startTime}`;
    let s = map.get(key);
    if (!s) {
      s = { name: o.name, startTime: o.startTime, dates: [] };
      map.set(key, s);
    }
    s.dates.push(o.date);
  }
  const series = [...map.values()];
  for (const s of series) s.dates.sort((a, b) => a.getTime() - b.getTime());
  return series;
}

const DAY_MS = 86_400_000;

function uniformIntervalDays(dates: Date[]): number | null {
  if (dates.length < 2) return null;
  const first = Math.round((dates[1].getTime() - dates[0].getTime()) / DAY_MS);
  if (first !== 7 && first !== 14) return null;
  for (let i = 2; i < dates.length; i++) {
    const gap = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / DAY_MS);
    if (gap !== first) return null;
  }
  return first;
}

function buildEvent(s: Series, dtstamp: string): string {
  const weekday = s.dates[0].getDay();
  const uid = `itmo-${hashKey(`${s.name}|${weekday}|${s.startTime}`)}@itmo-schedule-export`;
  const start = atTime(s.dates[0], s.startTime);
  const end = new Date(start.getTime() + LESSON_MINUTES * 60_000);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TZID}:${fmtWall(start)}`,
    `DTEND;TZID=${TZID}:${fmtWall(end)}`,
    `SUMMARY:${escapeText(s.name)}`,
  ];

  if (s.dates.length > 1) {
    const interval = uniformIntervalDays(s.dates);
    if (interval) {
      const lastStart = atTime(s.dates[s.dates.length - 1], s.startTime);
      lines.push(
        `RRULE:FREQ=WEEKLY;INTERVAL=${interval / 7};UNTIL=${fmtUtc(moscowWallToUtc(lastStart))}`,
      );
    } else {
      const rdates = s.dates
        .slice(1)
        .map((d) => fmtWall(atTime(d, s.startTime)))
        .join(",");
      lines.push(`RDATE;TZID=${TZID}:${rdates}`);
    }
  }

  lines.push("END:VEVENT");
  return lines.map(foldLine).join("\r\n");
}

export function buildIcs(occurrences: LessonOccurrence[]): string {
  const dtstamp = fmtUtc(new Date());
  const series = groupSeries(occurrences);
  const events = series.map((s) => buildEvent(s, dtstamp));

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//itmo-schedule-export//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    VTIMEZONE,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
