// Making food search forgiving: "chickfila nuggets", "chick fil a nuggets",
// and "Chick-fil-A Nuggets" should all find the same food, and small typos
// ("chiken") shouldn't hide results.

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "") // mcdonald's → mcdonalds
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const compact = (s: string) => normalize(s).replace(/ /g, "");

// Restaurant and brand names people type many ways. Key: compacted spelling.
// Value: how the databases usually write it.
const BRANDS: Record<string, string> = {
  chickfila: "chick-fil-a", cfa: "chick-fil-a",
  mcdonalds: "mcdonald's", mcds: "mcdonald's", mickeyds: "mcdonald's",
  wendys: "wendy's", tacobell: "taco bell", burgerking: "burger king", bk: "burger king",
  chipotle: "chipotle", subway: "subway", starbucks: "starbucks", sbux: "starbucks", dunkin: "dunkin", dunkindonuts: "dunkin",
  panera: "panera", panerabread: "panera", popeyes: "popeyes", kfc: "kfc", dominos: "domino's", pizzahut: "pizza hut",
  arbys: "arby's", zaxbys: "zaxby's", raisingcanes: "raising cane's", canes: "raising cane's", fiveguys: "five guys",
  innout: "in-n-out", jimmyjohns: "jimmy john's", pandaexpress: "panda express", whataburger: "whataburger",
  culvers: "culver's", jerseymikes: "jersey mike's", wingstop: "wingstop", qdoba: "qdoba", cava: "cava",
  sweetgreen: "sweetgreen", dutchbros: "dutch bros", sonic: "sonic", jackinthebox: "jack in the box",
  krispykreme: "krispy kreme", fairlife: "fairlife", benandjerrys: "ben & jerry's", reeses: "reese's",
  hersheys: "hershey's", kelloggs: "kellogg's", traderjoes: "trader joe's", costco: "kirkland", kirkland: "kirkland",
};

const STOP = new Set(["a", "an", "the", "of", "with", "and", "in", "on", "from", "for", "1", "one"]);

/** Turn what was typed into the spelling the databases use, e.g. "chickfila nuggets" → "chick-fil-a nuggets". */
export function expandQuery(q: string): string {
  const words = normalize(q).split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    // try 3-, 2-, then 1-word brand spellings ("chick fil a", "taco bell", "chickfila")
    let matched = false;
    for (let n = Math.min(3, words.length - i); n >= 1 && !matched; n--) {
      const key = words.slice(i, i + n).join("");
      if (BRANDS[key]) {
        out.push(BRANDS[key]);
        i += n - 1;
        matched = true;
      }
    }
    // a brand with one typo ("chikfila", "mcdonlds")
    if (!matched && words[i].length >= 5) {
      const near = Object.keys(BRANDS).find((k) => k.length >= 5 && closeEnough(words[i], k));
      if (near) {
        out.push(BRANDS[near]);
        matched = true;
      }
    }
    if (!matched) out.push(words[i]);
  }
  return out.join(" ");
}

/** Levenshtein distance, capped (we only care about 0, 1, or "more"). */
function closeEnough(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Is there a one-letter-off version of `w` anywhere in `text`? ("chikfila" in "chickfilanuggets") */
function typoInside(w: string, text: string): boolean {
  for (let len = w.length - 1; len <= w.length + 1; len++)
    for (let i = 0; i + len <= text.length; i++) if (closeEnough(w, text.slice(i, i + len))) return true;
  return false;
}

/** 0–1: how much of the search the food's name and brand cover. */
export function textMatch(query: string, candidate: { name: string; brand: string | null }): number {
  const qWords = normalize(expandQuery(query)).split(" ").filter((w) => w && !STOP.has(w));
  if (qWords.length === 0) return 0;
  const text = normalize(`${candidate.brand ?? ""} ${candidate.name}`);
  const words = text.split(" ");
  const squashed = text.replace(/ /g, "");
  let total = 0;
  for (const w of qWords) {
    if (words.includes(w) || words.includes(w.replace(/s$/, "")) || words.includes(`${w}s`)) total += 1;
    else if (squashed.includes(w)) total += 0.95; // "chickfila" inside "chick fil a"
    else if (w.length >= 4 && words.some((t) => t.startsWith(w))) total += 0.8;
    else if (w.length >= 5 && (words.some((t) => closeEnough(w, t)) || typoInside(w, squashed))) total += 0.7; // one typo
  }
  return total / qWords.length;
}
