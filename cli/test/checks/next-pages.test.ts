import { describe, expect, test } from "vitest";
import { appRoute, isNextPage } from "../../src/checks/design-set/app.ts";
import type { Surface } from "../../src/checks/design-set/set.ts";

const web = { web: true } as Surface;

describe("Next.js page files per edition", () => {
  test("page.tsx and page.<edition>.tsx are pages; other files are not", () => {
    expect(["page.tsx", "page.cloud.tsx", "page.ce.tsx"].every(isNextPage)).toBe(true);
    expect(["screen.tsx", "layout.tsx", "Page.tsx", "page.cloud.ts"].some(isNextPage)).toBe(false);
  });

  test("an edition's page file is the same route as page.tsx", () => {
    expect(appRoute(web, "s/[space]/pipeline/page.cloud.tsx")).toBe(appRoute(web, "s/[space]/pipeline/page.tsx"));
    expect(appRoute(web, "s/[space]/page.ce.tsx")).toBe(appRoute(web, "s/[space]/page.tsx"));
  });
});
