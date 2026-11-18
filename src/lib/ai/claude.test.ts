import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const created: Record<string, unknown>[] = [];
vi.mock("@/lib/db", () => ({ db: { aiUsage: { create: async ({ data }: { data: Record<string, unknown> }) => created.push(data) } } }));
import { claudeMessages, cleanModel, withCaching } from "./claude";
import { withAi } from "./usage";

describe("cleanModel", () => {
  it("accepts proper names and tidies pasted ones", () => {
    expect(cleanModel("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
    expect(cleanModel(" `claude-sonnet-5-5` ")).toBe("claude-sonnet-5-5");
    expect(cleanModel('"Claude-Sonnet-5-5"')).toBe("claude-sonnet-5-5");
  });
  it("ignores things that aren't model names", () => {
    expect(cleanModel("sonnet")).toBeNull();
    expect(cleanModel("claude sonnet 5.5")).toBeNull();
    expect(cleanModel("")).toBeNull();
  });
});

describe("prompt caching", () => {
  it("marks the shared instructions as cacheable without changing them", () => {
    const body = withCaching({ system: "Be a dietitian.", messages: [] });
    expect(body.system).toEqual([{ type: "text", text: "Be a dietitian.", cache_control: { type: "ephemeral" } }]);
    expect(body.cache_control).toBeUndefined();
    expect(withCaching({ system: "x" }, true).cache_control).toEqual({ type: "ephemeral" });
  });
});

describe("cost tracking", () => {
  it("records each call's tokens and cost under the person and feature", async () => {
    created.length = 0;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [], usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await withAi("u1", "describe", () => claudeMessages({ model: "claude-haiku-5-5", system: "hi", messages: [] }, "claude-sonnet-5-5"));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ userId: "u1", kind: "describe", model: "claude-haiku-5-5", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000, status: 200 });
    // 1000 × $0.10 + 500 × $0.50 + 2000 × $0.01, per million
    expect(created[0].costUsd).toBeCloseTo(0.00037, 8);
    vi.unstubAllGlobals();
  });

  it("drops caching and asks again if the API rejects it", async () => {
    created.length = 0;
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      const b = JSON.parse(init.body);
      bodies.push(b);
      if (Array.isArray(b.system)) return new Response(JSON.stringify({ error: { message: "cache_control is not supported" } }), { status: 400 });
      return new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 10, output_tokens: 2 } }), { status: 200 });
    }));
    const res = (await claudeMessages({ model: "claude-sonnet-5-5", system: "same words", messages: [] }, "claude-sonnet-5-5")) as { content: { text: string }[] };
    expect(res.content[0].text).toBe("ok");
    expect(bodies[1].system).toBe("same words");
    expect(created.map((c) => c.status)).toEqual([400, 200]);
    vi.unstubAllGlobals();
  });
});
