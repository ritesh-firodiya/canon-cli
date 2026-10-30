import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, test } from "vitest";

const context = vm.createContext({});
vm.runInContext(readFileSync(join(import.meta.dirname, "../../../shell/describe.js"), "utf8").replace("typeof window", '"undefined"').replace(": globalThis", ": this"), context);
const { definitionIn } = vm.runInContext("this.BABUL_DESCRIBE", context) as { definitionIn: (html: string) => string };

describe("a board's definition", () => {
  test("is every template in its head", () => {
    const html = `<html><head><title>x</title><template variant="a"><b>A</b></template>\n<template><i>B</i></template>\n</head><body><template>not this</template></body></html>`;
    expect(definitionIn(html)).toBe(`<template variant="a"><b>A</b></template>\n<template><i>B</i></template>`);
  });

  test("is empty when the head has no template", () => {
    expect(definitionIn("<html><head></head><body><template>x</template></body></html>")).toBe("");
  });
});
