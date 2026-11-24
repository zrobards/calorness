// The app keeps up to 3 recently visited screens alive in the background
// (Next.js does this with React's <Activity>), so a form you go back to keeps
// whatever it showed last time, even after the saved data changed. Giving a
// form `key={dataKey(theData)}` makes it start over whenever the data it
// started from changes, while an unsaved draft is still kept if nothing
// changed underneath it.

/** A short fingerprint of some data (FNV-1a over its JSON). */
export function dataKey(value: unknown): string {
  const text = JSON.stringify(value, (_k, v) => (v instanceof Date ? v.toISOString() : v)) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
