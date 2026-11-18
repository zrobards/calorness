// What each Claude model costs, in dollars per million tokens, from
// Anthropic's price list. Used to turn the token counts the API reports into
// a real cost. Cache writes (5-minute) are 1.25× the input price; cache reads
// are much cheaper than sending the same tokens again.
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number };

const PRICES: { match: RegExp; price: Price; longPrompt?: { over: number; price: Price } }[] = [
  {
    match: /^claude-haiku-5-5/,
    price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
    // Haiku 5.5 charges more once a single prompt passes 100K tokens
    longPrompt: { over: 100_000, price: { input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 } },
  },
  { match: /^claude-sonnet-5-5/, price: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 } },
  { match: /^claude-sonnet-4-[56]/, price: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 } },
  { match: /^claude-haiku-4-5/, price: { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 } },
];

// Anything not in the table is counted at Sonnet 5.5 prices, so it's never shown as free
const FALLBACK = PRICES[1].price;

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

/** Dollars for one API call, and what caching saved compared with no cache. */
export function costOf(model: string, usage: Usage | undefined) {
  const input = usage?.input_tokens ?? 0;
  const output = usage?.output_tokens ?? 0;
  const read = usage?.cache_read_input_tokens ?? 0;
  const write = usage?.cache_creation_input_tokens ?? 0;
  const entry = PRICES.find((p) => p.match.test(model));
  const promptTokens = input + read + write;
  const p = entry?.longPrompt && promptTokens > entry.longPrompt.over ? entry.longPrompt.price : entry?.price ?? FALLBACK;
  const cost = (input * p.input + output * p.output + read * p.cacheRead + write * p.cacheWrite) / 1_000_000;
  // Without caching, cached tokens would have been ordinary input. Negative
  // when a cache write's small premium wasn't paid back (yet) by a read.
  const uncached = ((input + read + write) * p.input + output * p.output) / 1_000_000;
  return { costUsd: cost, savedUsd: uncached - cost, known: !!entry, input, output, read, write };
}
