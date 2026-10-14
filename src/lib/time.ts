// Everything about "what day is it" uses the phone's own time zone.

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD for a moment, as seen in a time zone. */
export function dayInZone(date: Date, tz: string) {
  return date.toLocaleDateString("en-CA", { timeZone: tz });
}

/** Hour of day (0–23.99) in a time zone. */
export function hourInZone(date: Date, tz: string) {
  const [h, m] = date
    .toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return (h % 24) + m / 60;
}

/** The UTC instant when a calendar day starts in a time zone (handles daylight saving). */
export function zonedDayStart(day: string, tz: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  // How far the zone is from UTC at that moment, in minutes
  const asZone = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = asZone.getTime() - asUtc.getTime();
  return new Date(guess.getTime() - offset);
}
