import { describe, expect, test } from "vitest";
import { gatherModels } from "../src/models/models.ts";
import { priceOf } from "../src/usage/prices.ts";

const NONE = { settings: [], env: {}, apiIds: [], config: {} };

describe("the models this machine can run", () => {
  test("with nothing set, the list is the family names Claude Code resolves", () => {
    const models = gatherModels(NONE);
    expect(models.map((m) => [m.id, m.size])).toEqual([["haiku", "small"], ["sonnet", "medium"], ["opus", "large"]]);
    expect(models[0]?.price).toEqual(priceOf("claude-haiku-5-5", 0));
  });

  test("a company's own ids come from settings and env, the default slots give their size, and availableModels is the whole list", () => {
    const models = gatherModels({
      ...NONE,
      settings: [{ availableModels: ["acme-large-2", "claude-sonnet-5-5"], model: "acme-large-2" }],
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: "acme-large-2", ANTHROPIC_DEFAULT_HAIKU_MODEL: "acme-small-1" },
    });
    expect(models.map((m) => [m.id, m.size])).toEqual([["acme-large-2", "large"], ["claude-sonnet-5-5", "medium"], ["acme-small-1", "small"]]);
    expect(models.find((m) => m.id === "acme-large-2")?.price).toBeNull();
  });

  test("config wins for size and price, and a model with no size is listed but not routable", () => {
    const price = { input: 1, output: 2, write5m: 1, write1h: 1, cacheRead: 0.1 };
    const models = gatherModels({
      ...NONE,
      env: { ANTHROPIC_MODEL: "acme-x" },
      apiIds: ["acme-y"],
      config: { models: { "acme-x": "medium" }, prices: { "acme-x": price } },
    });
    expect(models).toEqual([
      { id: "acme-x", size: "medium", price, source: "env ANTHROPIC_MODEL" },
      { id: "acme-y", size: null, price: null, source: "api" },
      ...gatherModels(NONE),
    ]);
  });

  test("a Bedrock or Vertex id finds the list price of the model it wraps", () => {
    const models = gatherModels({ ...NONE, env: { ANTHROPIC_MODEL: "us.anthropic.claude-sonnet-4-5-20250929-v1:0" }, settings: [{ model: "claude-opus-4-5@20251101" }] });
    expect(models.slice(0, 2).map((m) => [m.size, m.price])).toEqual([["large", priceOf("claude-opus-4-5", 0)], ["medium", priceOf("claude-sonnet-4-5", 0)]]);
  });

  test("a family with a larger window is priced as the family, and only availableModels limits the list", () => {
    const models = gatherModels({ ...NONE, settings: [{ model: "opus[1m]" }] });
    expect(models.map((m) => m.id)).toEqual(["opus[1m]", "haiku", "sonnet", "opus"]);
    expect(models[0]?.price).toEqual(priceOf("opus", 0));
  });

  test("a config entry that is not a size or a full price is refused", () => {
    expect(() => gatherModels({ ...NONE, config: { models: { a: "huge" } } })).toThrow(/size of a/);
    expect(() => gatherModels({ ...NONE, config: { prices: { a: { input: 1 } } } })).toThrow(/price of a/);
  });
});
