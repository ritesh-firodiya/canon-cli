import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { checkSurface } from "../../src/checks/design-set/index.ts";
import { designs } from "../../src/checks/designs.ts";
import { contextFor } from "../helpers/context.ts";
import { classes, flat } from "../../src/checks/design-set/text.ts";
import { makeTree } from "../helpers/fixture.ts";

const SHELL = resolve(import.meta.dirname, "../../../shell");
const D = ".context/designs";
const page = (id: string, route: string, body: string) =>
  `<!doctype html><html><head><script src="../../shell.js"></script></head><body data-page="${id}" data-route="${route}" data-status="built">\n${body}\n</body></html>\n`;

/** A two-page Babul set, start → next, and the Expo app it draws; `files` overrides any of them. */
function product(files: Record<string, string> = {}) {
  return makeTree({
    [`${D}/babul.js`]: '(window.BABUL ||= {}).product = {"format":1,"name":"Demo","start":"home/start","sizes":["mobile"],"frames":{"mobile":{"w":390,"h":844}},"missing":[]};\n',
    [`${D}/tokens.js`]: '(window.BABUL ||= {}).tokens = {"color":{"ink":{"$value":"#000"}}};\n',
    [`${D}/mobile/index.html`]: '<!doctype html><html><head><script src="../shell.js" data-view="journey"></script></head><body data-shell="journey"></body></html>\n',
    [`${D}/mobile/styles.css`]: ".card { color: var(--ink) }\n",
    [`${D}/mobile/home/start.html`]: page("home/start", "index.tsx", '<div class="card text-ink"><a href="next.html">Next</a></div>'),
    [`${D}/mobile/home/next.html`]: page("home/next", "next.tsx", '<div class="card">Saved for later</div>'),
    "src/app/index.tsx": 'export default function S() { return <Link href="/next" /> }\n',
    "src/app/next.tsx": 'export default function N() { Alert.alert("Saved for later"); return null }\n',
    ...files,
  });
}

const fails = (files: Record<string, string> = {}) =>
  checkSurface(product(files), `${D}/mobile`, SHELL).output.split("\n").filter((l) => l.startsWith("   FAIL")).map((l) => l.slice(8));

describe("design-set checks", () => {
  test("a set that matches its app passes every check", () => {
    const result = checkSurface(product(), `${D}/mobile`, SHELL);
    expect(result.output).toMatch(/1 navigations checked, 1 forward edges honoured[\s\S]*1 dialog and toast strings checked, all drawn[\s\S]*ALL CHECKS PASS$/);
    expect(result.fail).toBe(0);
  });

  test("markup, tokens and dead styles are checked against the set itself", () => {
    expect(fails({
      [`${D}/mobile/home/next.html`]: page("home/next", "next.tsx", '<div class="card bg-ink-9 card--odd" style="color:var(--nope)">Saved for later'),
      [`${D}/mobile/styles.css`]: ".card { color: var(--ink) }\n.dead { color: red }\n",
    })).toEqual([
      "home/next.html: 1 <div> never closed",
      "home/next.html uses --nope — declared nowhere in shared.css",
      "home/next.html uses bg-ink-9 — no such token in tailwind.config.js",
      "home/next.html uses card--odd — declared nowhere in shared.css",
      "styles.css declares .dead and nothing draws it",
    ]);
  });

  test("the app is read for routes, navigation both ways, and the words its dialogs show", () => {
    expect(fails({
      "src/app/index.tsx": "export default function S() { return null }\n",
      "src/app/next.tsx": 'export default function N() { Alert.alert("Nothing was charged"); router.push("/"); return null }\n',
      "src/app/extra.tsx": "export default function E() { return null }\n",
    })).toEqual([
      "src/app/extra.tsx ships and no screen draws it, and `missing` does not say why",
      "home/next.html -> home/start.html  (next.tsx navigates to /)",
      "home/start.html -> home/next.html is drawn and the app never navigates there (Next)",
      'src/app/next.tsx puts "Nothing was charged" on screen and no wireframe draws it',
    ]);
  });

  test("a departure written down in `missing` is pending, not a failure", () => {
    const babul = '(window.BABUL ||= {}).product = {"format":1,"name":"Demo","start":"home/start","sizes":["mobile"],"frames":{"mobile":{"w":390,"h":844}},"missing":[{"what":"extra.tsx","why":"not drawn yet"}]};\n';
    expect(fails({ [`${D}/babul.js`]: babul, "src/app/extra.tsx": "export default function E() { return null }\n" })).toEqual([]);
  });

  test("canon check reports a failing surface as one error carrying the end of its report", () => {
    const repo = product({ "src/app/extra.tsx": "export default function E() { return null }\n" });
    const findings = designs.run({ ...contextFor(repo), canonRoot: resolve(SHELL, "..") }).filter((f) => f.file === `${D}/mobile`);
    expect(findings).toEqual([expect.objectContaining({ level: "error", message: expect.stringMatching(/extra\.tsx ships[\s\S]*1 FAILURES$/) })]);
  });

  test("classes and copy are read the way the shell draws them", () => {
    expect(classes('class="a {x?b:c}"')).toEqual([new Set(["a", "b", "c"]), new Set()]);
    expect(classes('class="p-2 bg-brand-{tone}-500 m-1"')).toEqual([new Set(["p-2", "m-1"]), new Set(["bg-brand-"])]);
    expect(flat("It&rsquo;s  done &mdash;\n now")).toBe("It's done - now");
  });
});
