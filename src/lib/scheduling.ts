import { formatInTimeZone, toDate } from "date-fns-tz";

const TZ = "America/Chicago";
const WINDOW_START_HOUR = 9; // 9am local
const WINDOW_END_HOUR = 21; // 9pm local
const MIN_DELAY_MIN = 60;
const MAX_DELAY_MIN = 180;

// Pick a send time: now + random(60..180) minutes, then clamp into the
// 9am-9pm America/Chicago window (roll forward to next day's 9am if needed).
export function pickScheduledSendAt(from: Date = new Date()): Date {
  const delayMs =
    (MIN_DELAY_MIN + Math.random() * (MAX_DELAY_MIN - MIN_DELAY_MIN)) * 60_000;
  const candidate = new Date(from.getTime() + delayMs);
  return clampToSendWindow(candidate);
}

function clampToSendWindow(d: Date): Date {
  const hour = Number(formatInTimeZone(d, TZ, "H"));
  if (hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR) return d;

  // Pick the next occurrence of WINDOW_START_HOUR local time.
  const targetDay =
    hour >= WINDOW_END_HOUR
      ? addLocalDays(d, 1) // past 9pm — move to tomorrow 9am
      : d; // before 9am — still today 9am
  const ymd = formatInTimeZone(targetDay, TZ, "yyyy-MM-dd");
  return toDate(`${ymd}T${String(WINDOW_START_HOUR).padStart(2, "0")}:00:00`, {
    timeZone: TZ
  });
}

function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
