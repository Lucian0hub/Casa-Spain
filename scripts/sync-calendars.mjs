// Pulls the Airbnb and Booking.com iCal feeds, merges them with the
// bookings in data/manual-bookings.json, and writes:
//   data/availability.json  - the dates the website shows as taken (dates only, no names)
//   data/calendar.ics       - your own (email) bookings, for Airbnb/Booking.com to import
//
// Feed links come from the ICAL_URLS environment variable (one per line),
// stored as a GitHub secret so they never appear in the public code.
// Run locally with:  ICAL_URLS="https://..." node scripts/sync-calendars.mjs

import { readFile, writeFile } from "node:fs/promises";

const urls = (process.env.ICAL_URLS || "").split(/\s+/).filter(Boolean);
const toIso = v => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

function parseIcs(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);   // unfold lines
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") { if (cur?.start && cur?.end) events.push(cur); cur = null; }
    else if (cur) {
      const m = line.match(/^(DTSTART|DTEND)[^:]*:(\d{8})/);
      if (m) cur[m[1] === "DTSTART" ? "start" : "end"] = toIso(m[2]);
    }
  }
  return events;
}

let ranges = [];
let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "house-calendar-sync" } });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    const evs = parseIcs(await res.text());
    console.log(`Feed ${new URL(url).hostname}: ${evs.length} bookings`);
    ranges.push(...evs);
  } catch (e) {
    failed++;
    console.error(`Could not read feed ${new URL(url).hostname}: ${e.message}`);
  }
}

// Keep the old data if every feed failed, rather than wiping the calendar.
if (urls.length && failed === urls.length) {
  console.error("All feeds failed; leaving availability.json unchanged.");
  process.exit(1);
}

const manual = JSON.parse(await readFile("data/manual-bookings.json", "utf8"));
ranges.push(...manual.map(({ start, end }) => ({ start, end })));

// Drop the past, sort, and merge overlapping ranges.
const today = new Date().toISOString().slice(0, 10);
ranges = ranges.filter(r => r.end > today).sort((a, b) => a.start.localeCompare(b.start));
const merged = [];
for (const r of ranges) {
  const last = merged.at(-1);
  if (last && r.start <= last.end) { if (r.end > last.end) last.end = r.end; }
  else merged.push({ start: r.start, end: r.end });
}

await writeFile("data/availability.json",
  JSON.stringify({ updated: new Date().toISOString(), booked: merged }, null, 2) + "\n");

// Export only your own bookings, so Airbnb/Booking.com don't re-import their own.
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const ics = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//house-website//EN", "CALSCALE:GREGORIAN",
  ...manual.flatMap((b, i) => [
    "BEGIN:VEVENT",
    `UID:manual-${b.start}-${i}@house-website`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${b.start.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${b.end.replace(/-/g, "")}`,
    "SUMMARY:Not available",
    "END:VEVENT",
  ]),
  "END:VCALENDAR", "",
].join("\r\n");
await writeFile("data/calendar.ics", ics);

console.log(`Wrote ${merged.length} taken periods.`);
