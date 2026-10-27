#!/usr/bin/env python3
"""Gives a design set its architecture screens, the same in every product.

  canon arch-set <spec.json>

The spec names the set and says what to draw:
  {
    "set": "/abs/path/<product>/.context/designs/<surface>",
    "lead": "One or two sentences: how the product is built.",
    "diagrams": [["who-uses", "users", "Who uses it"], ...],    # slug, lucide icon, title
    "stack": [{"title": "App · src/", "icon": "smartphone", "rows": [["Expo", "57", "what it is for"], ...]}, ...],
    "own": "One sentence: the product's own code.",
    "cost": {"title": "Cost a month", "rows": [["RevenueCat", "purchases", "$0"], ...], "total": "$0", "note": "one sentence"}
  }

Each diagram is an asset Archify already drew: <product>/.context/designs/architecture/<slug>.json and .html.
This writes <set>/architecture/overview.html and one screen per diagram, and declares them in routes.js:
the `architecture` field, an `architecture` flow, and an edge from the overview to each diagram.
A phone set draws these screens without the phone frame, full width under the bar; a wide set keeps its frame.
"""
import json, os, re, sys

spec = json.load(open(sys.argv[1]))
SET = spec["set"]
ASSETS = os.path.normpath(os.path.join(SET, "..", "architecture"))
os.chdir(SET)

R = open("routes.js").read()
JSON_STYLE = '"product":' in R      # a manifest written with quoted keys
product = re.search(r'"?product"?:\s*"([^"]+)"', R).group(1)
fw = int(re.search(r'"?frame"?:\s*\{\s*"?w"?:\s*(\d+)', R).group(1))
WIDE = fw >= 800
BOX = "rounded-xl border border-line bg-surface"


def page(file, title, body):
    if WIDE:
        wrap_open = '<div class="stage">\n  <div class="phone">\n    <div class="screen h-frame bg-page text-ink flex flex-col">\n'
        wrap_close = '\n    </div>\n  </div>\n</div>\n'
    else:
        # A phone frame is 390px: too narrow to read a diagram. Fill the window under the bar instead.
        wrap_open = '<div class="bg-page text-ink flex flex-col" style="height:calc(100dvh - var(--chrome-h, 48px))">\n'
        wrap_close = '\n</div>\n'
    return ('''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s — %s</title>
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script src="../tailwind.config.js"></script>
  <script src="https://unpkg.com/lucide@0.544.0/dist/umd/lucide.js"></script>
  <link rel="stylesheet" href="../shared.css" />
</head>
<body data-chrome data-file="architecture/%s">

''' % (product, title, file) + wrap_open + body + wrap_close + '''
<script src="../routes.js"></script>
<script src="../_chrome.js"></script>
<script>lucide.createIcons();</script>
</body>
</html>
''')


os.makedirs("architecture", exist_ok=True)

# ---- one screen per diagram: Archify's embed mode, in a frame of the diagram's own shape
for slug, icon, title in spec["diagrams"]:
    src = open(os.path.join(ASSETS, slug + ".html")).read()
    w, h = map(float, re.search(r'<svg[^>]*viewBox="0 0 ([0-9.]+) ([0-9.]+)"', src).groups())
    body = ('<div class="flex-1 min-h-0 flex justify-center bg-page"><iframe src="../../architecture/%s.html?embed=1&amp;theme=light" title="%s" '
            'class="border-0 max-w-full" style="height:100%%;aspect-ratio:%d / %d"></iframe></div>') % (slug, title, w, h + 24)
    open("architecture/%s.html" % slug, "w").write(page(slug + ".html", "Architecture · " + title, body))

# ---- the overview: the diagrams, the stack, the cost
cards = "".join('<a href="%s.html" class="%s px-4 h-14 flex items-center gap-3 text-sm font-medium hover:border-line-strong"><i data-lucide="%s" class="w-4 h-4 text-ink-3"></i>%s'
                '<i data-lucide="arrow-right" class="ml-auto w-4 h-4 text-ink-4"></i></a>' % (s, BOX, i, t) for s, i, t in spec["diagrams"])


def table(t):
    return ('<div class="%s overflow-hidden"><div class="px-4 h-10 flex items-center gap-2 border-b border-line text-sm font-semibold"><i data-lucide="%s" class="w-4 h-4 text-ink-3"></i>%s</div>'
            % (BOX, t["icon"], t["title"])
            + "".join('<div class="px-4 h-9 flex items-center gap-3 border-t border-line first:border-t-0 text-sm"><span class="w-40 shrink-0 font-medium truncate">%s</span>'
                      '<span class="w-20 shrink-0 font-mono text-xs text-ink-3">%s</span><span class="flex-1 min-w-0 truncate text-ink-3">%s</span></div>' % tuple(r) for r in t["rows"])
            + '</div>')


c = spec["cost"]
cost = ("".join('<div class="px-4 h-9 flex items-center gap-3 border-t border-line first:border-t-0 text-sm"><span class="w-40 font-medium">%s</span>'
                '<span class="flex-1 text-ink-3">%s</span><span class="num">%s</span></div>' % tuple(r) for r in c["rows"])
        + '<div class="px-4 h-10 flex items-center border-t border-line text-sm font-semibold"><span>A month</span><span class="ml-auto num">%s</span></div>' % c["total"])
overview = ('<div class="flex-1 min-h-0 overflow-y-auto"><main class="max-w-[1180px] mx-auto px-6 py-8">'
            '<h1 class="text-h2 font-semibold">How %s is built</h1>' % product
            + '<p class="mt-2 text-base text-ink-3 max-w-[760px]">%s</p>' % spec["lead"]
            + '<div class="mt-6 grid grid-cols-3 gap-3">' + cards + '</div>'
            + '<h2 class="mt-10 text-h3 font-semibold">Stack</h2><div class="mt-3 grid grid-cols-2 gap-3">' + "".join(table(t) for t in spec["stack"]) + '</div>'
            + '<p class="mt-3 text-sm text-ink-3">%s</p>' % spec["own"]
            + '<h2 class="mt-10 text-h3 font-semibold">%s</h2>' % c["title"]
            + '<div class="mt-3 grid grid-cols-[1fr_320px] gap-3 items-start"><div class="%s overflow-hidden">%s</div>' % (BOX, cost)
            + '<div class="%s p-4 text-sm text-ink-3">%s</div></div>' % (BOX, c["note"])
            + '</main></div>')
open("architecture/overview.html", "w").write(page("overview.html", "Architecture", overview))

rows = [("overview", "Architecture")] + [(s, t) for s, _, t in spec["diagrams"]]
if JSON_STYLE:
    # ---- routes.js, JSON-style: the field, the flow, the edges
    if '"architecture": "architecture/overview.html"' not in R:
        R = re.sub(r'(\n(\s*)"product":\s*"[^"]+",\n)', lambda m: m.group(1) + m.group(2) + '"architecture": "architecture/overview.html",\n', R, 1)
    R = re.sub(r',\n    \{\n      "flow": "architecture",.*?\n    \}(?=\n  \])', "", R, flags=re.S)
    items = ",\n".join('        {\n          "file": "architecture/%s.html",\n          "route": null,\n          "screen": "%s",\n          "states": {},\n          "status": "review",\n          "notes": "architecture"\n        }' % r for r in rows)
    block = ',\n    {\n      "flow": "architecture",\n      "screens": [\n' + items + '\n      ]\n    }'
    m = re.search(r'\n  "flows": \[', R)
    end = R.index("\n  ],", m.end())
    R = R[:end] + block + R[end:]
    R = re.sub(r'\n\s*\{ "from": "architecture/[^"]+", "to": "architecture/[^"]+"[^}]*\},', "", R)
    edges = "".join('\n      { "from": "architecture/overview.html", "to": "architecture/%s.html", "side": true },' % s for s, _, _ in spec["diagrams"])
    m = re.search(r'\n\s*"edges": \[', R)
    R = R[:m.end()] + edges + R[m.end():]
    open("routes.js", "w").write(R)

else:
    # ---- routes.js: the field, the flow, the edges
    files = ["architecture/overview.html"] + ["architecture/%s.html" % s for s, _, _ in spec["diagrams"]]
    if "architecture:" not in R:
        R = re.sub(r'(\n(\s*)product:\s*"[^"]+",\n)', lambda m: m.group(1) + m.group(2) + 'architecture: "architecture/overview.html",\n', R, 1)
    R = re.sub(r'\n    \{ flow: "architecture", screens: \[.*?\n    \]\},', "", R, flags=re.S)
    block = ('\n    { flow: "architecture", screens: [\n' + "".join(
        '      { file: "architecture/%s.html", route: null, screen: "%s", status: "needs review", notes: "architecture" },\n' % r for r in rows) + '    ]},')
    m = re.search(r'\n  flows: \[', R)
    end = R.index("\n  ],", m.end())
    R = R[:end] + block + R[end:]
    R = re.sub(r'\n\s*\{ from: "architecture/[^"]+", to: "architecture/[^"]+"[^}]*\},', "", R)
    edges = "".join('\n      { from: "architecture/overview.html", to: "architecture/%s.html", side: true },' % s for s, _, _ in spec["diagrams"])
    m = re.search(r'\n\s*edges: \[', R)
    if m:
        R = R[:m.end()] + edges + R[m.end():]
    open("routes.js", "w").write(R)

print("%s: %d architecture screens, %s" % (product, len(rows), "wide" if WIDE else "phone"))
