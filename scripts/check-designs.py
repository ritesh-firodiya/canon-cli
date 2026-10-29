#!/usr/bin/env python3
"""The checks from the design-sets standard §12, over a design surface.

    python3 scripts/check-designs.py .context/designs/mobile

There is no lint and no build for a design set, so these are it:

  inventory      every file on disk is declared in routes.js, and vice versa
  well-formed    every <div> is closed exactly once, in order
  links          every local href points at a file that exists
  tokens         every var(--x) and every colour class resolves against
                 shared.css + tailwind.config.js
  click-through  every declared edge is a real link in the screen it leaves
  flow-complete  every link between screens is a declared edge
  acyclic        the forward graph ranks by depth, so it must be a DAG
  routes         every app screen is drawn, and every drawing has an app screen
  app-flow       the app and the chart navigate alike, in both directions
  copy           every word a dialog or a toast puts on screen is drawn somewhere

The last two are a pair and the set needs both. Without the first the chart is
a diagram of an intention; without the second it quietly under-reports the
product. Exits non-zero on any failure.
"""
import re, os, sys, json, subprocess, glob

SURF = sys.argv[1] if len(sys.argv) > 1 else '.context/designs/mobile'
ROOT = os.path.abspath(os.path.join(SURF, '..', '..', '..'))
# A surface is checked against the app that RENDERS it. Every surface used to be
# read against the Expo app, so a web set was told that all of its screens had
# no route and that every mobile screen "ships and no screen draws it" — 190
# failures that said nothing about the web set at all.
WEB = os.path.basename(os.path.normpath(SURF)) == 'web'
# A monorepo keeps its Expo app in apps/mobile/; a single-package app at the root.
# The site is Next.js and only ever lives in a monorepo.
CANDIDATES = ('apps/website/src', 'apps/web/src') if WEB else ('apps/mobile/src', 'src')
SRC_DIR = next((d for d in (os.path.join(ROOT, c) for c in CANDIDATES)
                if os.path.isdir(os.path.join(d, 'app'))), os.path.join(ROOT, CANDIDATES[-1]))
APP_DIR = os.path.join(SRC_DIR, 'app')
# expo-router makes every .tsx under app/ a screen except a layout; the Next.js
# app router makes a screen of `page.tsx` and of nothing else in the folder.
def is_screen(name):
    return name == 'page.tsx' if WEB else name.endswith('.tsx') and name != '_layout.tsx'
os.chdir(SURF)
fail = 0
def head(t): print('\n== ' + t)
def bad(m):
    global fail; fail += 1; print('   FAIL ' + m)

# ---- the manifest ------------------------------------------------------------
# Two formats. A Babul set is described from its HTML (_shell/scan.mjs, the
# same code its shell runs) beside two hand files, babul.js and tokens.js. It
# is mapped here onto the routes.js shape the checks below were written
# against, so every check runs on both. The older
# format is routes.js, read through node so it stays the only parser.
BABUL = os.path.exists('../babul.js')
DATA_FILE = re.compile(r'^\(window\.BABUL \|\|= \{\}\)\.(\w+) = ([\s\S]*);\s*$')
DATA_KEY = {'babul': 'product'}

def babul(name):
    """One data file, as Babul reads it: the fixed prefix, then strict JSON."""
    path = os.path.join('..', name + '.js')
    if not os.path.exists(path):
        return None
    key = DATA_KEY.get(name, name)
    m = DATA_FILE.match(open(path).read())
    if not m or m.group(1) != key:
        bad('%s.js is not `(window.BABUL ||= {}).%s = <JSON>;`' % (name, key))
        return None
    try:
        return json.loads(m.group(2))
    except ValueError as e:
        bad('%s.js does not parse as strict JSON: %s' % (name, e))
        return None

def scanned():
    """The set as its shell reads it: described from the HTML by _shell/scan.mjs."""
    out = subprocess.run(['node', os.path.join('..', '_shell', 'scan.mjs'), os.path.basename(os.getcwd()), '--json'],
                         capture_output=True, text=True)
    if out.returncode:
        bad('_shell/scan.mjs failed: %s' % out.stderr.strip()[:300])
        return {}
    return json.loads(out.stdout)

def from_babul():
    S = scanned()
    product, pages, links = babul('babul') or {}, S.get('pages', []), S.get('links', [])
    journeys, components = S.get('journeys', {}), S.get('components', {}).get('components', [])
    # One file holds every state of a page, so a frame's file is its page's.
    html = lambda frame: frame.split('.')[0] + '.html'
    flows, by_group = [], {}
    for p in pages:
        group = p['id'].split('/')[0]
        if group not in by_group:
            by_group[group] = {'flow': group, 'screens': []}
            flows.append(by_group[group])
        by_group[group]['screens'].append({
            'file': html(p['id']), 'route': p.get('route'), 'screen': p['name'], 'states': {},
            'status': p.get('status'),
        })
    if components:
        flows.append({'flow': 'components', 'screens': [
            {'file': 'components/%s.html' % c['id'], 'route': None, 'screen': c['name'], 'states': {}}
            for c in components]})
    # Between files only: a link to another state of the same page is checked
    # frame by frame in the babul section, where the states are visible.
    edges = []
    for l in links:
        e = {'from': html(l['from']), 'to': html(l['to'])}
        if e['from'] == e['to']:
            continue
        for k in ('label', 'back', 'side'):
            if k in l:
                e[k] = l[k]
        if l.get('tap') is False:
            e['state'] = True
        edges.append(e)
    return {
        'product': product.get('name'), 'flows': flows, 'missing': product.get('missing', []),
        'flow': {'start': html(journeys.get('start', '')), 'end': [html(f) for f in journeys.get('end', [])], 'edges': edges},
        '_babul': {'product': product, 'pages': pages, 'links': links, 'journeys': journeys,
                   'components': components, 'tokens': babul('tokens') or {}, 'assets': S.get('assets', {}),
                   'errors': S.get('errors', [])},
    }

if BABUL:
    R = from_babul()
else:
    R = json.loads(subprocess.run(
        ['node','-e','global.window={};require("./routes.js");console.log(JSON.stringify(window.ROUTES))'],
        capture_output=True, text=True, check=True).stdout)

# `order` is declaration order; `declared_files` is a set and must never be
# iterated where the ORDER reaches output. See owners below.
screens, states, files, order = [], {}, {}, []
for fl in R['flows']:
    for s in fl['screens']:
        screens.append(s['file']); files[s['file']] = s
        order.append(s['file'])
        for w, sf in (s.get('states') or {}).items():
            states[sf] = s['file']; order.append(sf)
declared_files = set(screens) | set(states)
on_disk = {f for f in glob.glob('*/**/*.html', recursive=True)}
# The shell's own pages: drawn from the data, never declared in it.
SHELL_PAGES = ('index.html', 'styles.html', 'screenshots.html')
if BABUL:
    on_disk = {f for f in on_disk if not f.startswith('styles/')}

def hrefs(f):
    s = open(f).read()
    out = []
    for m in re.finditer(r'\b(?:%s)="([^"]+)"' % '|'.join(LINK_ATTRS), s):
        h = m.group(1)
        # tel: and sms: leave the set the same way mailto: does — a wireframe that
        # draws a helpline number as a real link is correct, not a dead path.
        if h.startswith(('http','#','mailto:','tel:','sms:')): continue
        out.append((h, os.path.normpath(os.path.join(os.path.dirname(f), h.split('?')[0].split('#')[0]))))
    return out

# A Babul set defines each component once, in components/<id>.js, and pages
# use it as <c-id>. Those definitions are drawn markup too: every token,
# class, icon and word in them is checked with the pages'.
DEFS = sorted(glob.glob('components/*.js')) if BABUL else []
# A property a definition puts in an href — top-bar's `back` — is a link where
# an instance sets it, exactly as an href is.
LINK_ATTRS = ['href'] + sorted({n for d in DEFS for n in re.findall(r'href="\{([a-z][a-z0-9-]*)\}"', open(d).read())})
def unbrace(text):
    """A definition with its {prop} holes out and both arms of every {test?a:b} in."""
    return re.sub(r'\{!?[a-z][a-z0-9-]*(?:=[^?}]*)?(?:\?([^:}]*)(?::([^}]*))?)?\}',
                  lambda m: ' '.join(x for x in m.groups() if x), text)

# ---- 1. inventory ----------------------------------------------------------
head('inventory — every file declared, every declaration on disk')
for f in sorted(on_disk - declared_files): bad(f + ' is on disk and in no manifest entry')
for f in sorted(declared_files - on_disk): bad(f + ' is declared and not on disk')
print('   %d screens + %d states = %d files' % (len(screens), len(states), len(declared_files)))

# ---- 2. well-formed --------------------------------------------------------
# A browser silently repairs a stray or missing </div>, so a screen can be
# malformed for months and still LOOK right — which is exactly what happened to
# food/barcode.html, where a lost opening tag took the protein figure and the
# whole calorie total off the screen with it, and to gallery/photo-empty.html,
# which closed the phone frame two blocks early. Every other check here passed
# on both. Divs only: they are what the layout is built from, and the void and
# self-closing tags around them are not worth a real parser.
head('well-formed — every <div> is closed exactly once, in order')
for f in sorted(declared_files & on_disk):
    # Comments are stripped from the WHOLE text, not line by line: several
    # screens carry a rationale comment that says "<div>" in prose, and one of
    # them spans two lines. Newlines are kept so the line numbers still point at
    # the real fault.
    src = re.sub(r'<!--.*?-->', lambda m: '\n' * m.group(0).count('\n'), open(f).read(), flags=re.S)
    depth, stray = 0, []
    for i, line in enumerate(src.split('\n'), 1):
        for m in re.finditer(r'</?div\b', line):
            depth += 1 if m.group(0) == '<div' else -1
            if depth < 0:
                stray.append(i); depth = 0
    if stray: bad('%s: </div> with nothing open at line %s' % (f, ', '.join(map(str, stray))))
    elif depth: bad('%s: %d <div> never closed' % (f, depth))
print('   %d screens parse' % len(declared_files & on_disk))

# ---- 3. links --------------------------------------------------------------
head('links — every local href points at a file that exists')
n = 0
for f in sorted(declared_files):
    for raw, t in hrefs(f):
        n += 1
        if not os.path.exists(t): bad('%s -> %s (%s)' % (f, t, raw))
print('   %d local hrefs resolved' % n)

# ---- 4. tokens -------------------------------------------------------------
head('tokens — every var(--x) and every component class resolves')
def token_paths(node, path=()):
    """Every W3C token under node, as its path; DEFAULT is its group's own name."""
    if isinstance(node, dict) and '$value' in node:
        yield path
    elif isinstance(node, dict):
        for k, v in node.items():
            if not k.startswith('$'):
                yield from token_paths(v, path if k == 'DEFAULT' else path + (k,))

if BABUL:
    # theme.js writes one variable per token, under exactly these names.
    css = open('../_shell/shell.css').read() + open('styles.css').read()
    T = R['_babul']['tokens']
    tw_colors = {'-'.join(p) for p in token_paths(T.get('color', {}))}
    declared_vars = {'--' + c for c in tw_colors}
    for p in token_paths(T.get('typography', {})):
        declared_vars |= {'--%s-%s' % (k, '-'.join(p)) for k in ('fs', 'lh', 'ls')}
    for group in ('radius', 'shadow'):
        declared_vars |= {'--' + '-'.join((group,) + p) for p in token_paths(T.get(group, {}))}
    declared_vars |= set(re.findall(r"(--[a-z0-9-]+)\s*:", css))
else:
    css = open('shared.css').read()
    declared_vars = set(re.findall(r"(--[a-z0-9-]+)\s*:", css))
    tw = subprocess.run(['node','-e','''
  const fs=require("fs"); const tailwind={}; eval(fs.readFileSync("tailwind.config.js","utf8"));
  const out=[]; (function walk(o,p){for(const k in o){const v=o[k];
    if(typeof v==="string"||Array.isArray(v)) out.push(p.concat(k==="DEFAULT"?[]:[k]).join("-"));
    else walk(v,p.concat(k==="DEFAULT"?[]:[k]));}})(tailwind.config.theme.extend.colors,[]);
  console.log(JSON.stringify(out));'''], capture_output=True, text=True, check=True)
    tw_colors = set(json.loads(tw.stdout))
declared_vars |= {'--chrome-h','--stage-pad'}          # published at runtime by the shell
declared_vars |= {'--tile-w','--tile-h','--tile-scale'}  # published at runtime by screenshots.html, from the frame
declared_cls  = set(re.findall(r'\.([a-zA-Z][a-zA-Z0-9_-]*)', css))

missing_vars, missing_cls = set(), set()
for f in sorted(declared_files) + [p for p in SHELL_PAGES if os.path.exists(p)] + DEFS:
    s = unbrace(open(f).read())
    for v in re.findall(r'var\((--[a-z0-9-]+)', s):
        if v not in declared_vars: missing_vars.add((f, v))
    for attr in re.findall(r'class="([^"]*)"', s):
        for c in attr.split():
            c = c.split(':')[-1]                         # strip sm:/hover: prefixes
            if re.match(r'^(bg|text|border|ring|fill|stroke|from|to|via|decoration|shadow|outline)-', c):
                stem = c.split('-',1)[1].split('/')[0]
                if re.match(r'^(brand|accent|conf|macro|ink|page|frame|surface|muted|sunken|line|success|warn|danger|info|camera)\b', stem):
                    if stem not in tw_colors: missing_cls.add((f, c))
            # A MODIFIER MUST BE DECLARED. Only colour utilities were checked
            # here, so `phone--camera` — used by both camera screens and
            # declared nowhere — resolved to nothing for as long as the set has
            # existed. Both got away with it by painting their own dark area
            # inline; anything outside that block rendered as dark text on white.
            #
            # `--` is the precise test: every component modifier in this system
            # uses it (card--muted, opt--ask, phone--page) and no Tailwind
            # utility ever contains it, so there is nothing to allow-list.
            elif '--' in c and c not in declared_cls:
                missing_cls.add((f, c))
for f,v in sorted(missing_vars): bad('%s uses %s — declared nowhere in shared.css' % (f, v))
for f,c in sorted(missing_cls):
    bad('%s uses %s — declared nowhere in shared.css' % (f, c) if '--' in c
        else '%s uses %s — no such token in tailwind.config.js' % (f, c))
print('   %d CSS variables and %d classes declared' % (len(declared_vars), len(declared_cls)))

# ---- 5+6. click-through and flow-complete ----------------------------------
head('click-through — every declared edge is a real link in the screen it leaves')
head2 = 'flow-complete — every link between screens is a declared edge'
real = set()
for f in sorted(declared_files):
    for raw, t in hrefs(f):
        if t in SHELL_PAGES or t == f: continue
        # A link that leaves the surface — the mobile drawer opening the
        # website — is not a link between two screens of THIS set. Its target
        # is in another manifest, so no edge here could name it; check 3 has
        # already proved the file is there.
        if t.startswith('..'): continue
        # A Babul page may open a component's board (the alert it raises); it is not a page.
        if BABUL and t.startswith(('components/', 'styles/')): continue
        if t.endswith('.html'): real.add((f, t))
decl = {(e['from'], e['to']) for e in R['flow']['edges'] if not e.get('state')}
state_edges = {(e['from'], e['to']) for e in R['flow']['edges'] if e.get('state')}
for a,b in sorted(decl - real): bad('edge %s -> %s is declared and is not a link' % (a,b))
print('   %d declared edges, all present as links' % len(decl))
print('\n== ' + head2)
for a,b in sorted(real - decl - state_edges): bad('link %s -> %s is not a declared edge' % (a,b))
print('   %d real links, all declared' % len(real))


# ---- 7. acyclic ------------------------------------------------------------
# The fifth check in the style guide, and the one it calls worst to fail: the
# chart ranks nodes by longest-path depth from the start, which only terminates
# on a DAG. A forward cycle makes the layout either hang or silently pick an
# arbitrary column, and unlike the other four this cannot be eyeballed on a
# thirty-screen set. It was missing from this script entirely.
#
# States collapse into their base screen and `state`/`back`/`side` edges are
# dropped first, exactly as _chrome.js does when it builds the ranked graph —
# a return edge is a cycle by definition and is not what this is looking for.
head('acyclic — the forward graph ranks, so it must be a DAG')

base = {}
for fl in R['flows']:
    for sc in fl['screens']:
        base[sc['file']] = sc['file']
        for st in (sc.get('states') or {}).values():
            base[st] = sc['file']

fwd = {}
for e in R['flow']['edges']:
    if e.get('state') or e.get('back') or e.get('side'):
        continue
    a, b = base.get(e['from'], e['from']), base.get(e['to'], e['to'])
    if a != b:
        fwd.setdefault(a, set()).add(b)

WHITE, GREY, BLACK = 0, 1, 2
colour, cycles = {}, []

def walk(n, path):
    colour[n] = GREY
    path.append(n)
    for m in sorted(fwd.get(n, ())):
        c = colour.get(m, WHITE)
        if c == GREY:
            cycles.append(' -> '.join(path[path.index(m):] + [m]))
        elif c == WHITE:
            walk(m, path)
    path.pop()
    colour[n] = BLACK

for n in sorted(set(fwd) | {b for v in fwd.values() for b in v}):
    if colour.get(n, WHITE) == WHITE:
        walk(n, [])

for c in cycles:
    bad('forward cycle: %s' % c)
print('   %d forward edges over %d screens, no cycles' % (
    sum(len(v) for v in fwd.values()), len(base)))


# ---- 8. routes — the set and the app describe the same product -------------
# The style guide's §11 rule ("the designs describe the app that exists") is the
# one broken most often, and the other six checks cannot see it: they compare
# the set against itself. This one compares it against src/app.
#
# Each screen declares the route that renders it. Several screens may share one
# route — food/item.tsx wears three portion faces, scan/correct.tsx two scopes —
# because which face it wears is a fact about the data. A `route: null` is a
# specimen page that nothing in the app renders, which patterns pages are.
# ---- architecture ------------------------------------------------------------
# Every set carries an architecture flow, opened from the bar's chip (decided
# 2026-10-23): the manifest names its overview, the flow declares it, and each
# screen frames an Archify diagram from ../architecture/ whose .json source sits
# beside it. The links check above reads href only; a framed diagram is an
# iframe src, so a deleted diagram would otherwise go unnoticed.
head('architecture — the overview is declared and every framed diagram has its source')
if BABUL:
    print('   skipped — a Babul set holds no architecture; it lives in canon')
arch_page = R.get('architecture') if not BABUL else None
arch_flow = next((fl for fl in R['flows'] if fl.get('flow') == 'architecture'), None)
if not arch_page and not BABUL:
    bad('routes.js names no `architecture` page — run `canon arch-set` with this set\'s spec')
elif arch_page and arch_page not in declared_files:
    bad('`architecture: "%s"` is not a declared screen' % arch_page)
if arch_flow is None and not BABUL:
    bad('no `architecture` flow in routes.js')
framed = set()
for f in sorted(x for x in declared_files if x.startswith('architecture/')):
    for src in re.findall(r'<iframe[^>]*\ssrc="([^"]+)"', open(f).read()):
        t = os.path.normpath(os.path.join(os.path.dirname(f), src.split('?')[0].split('#')[0]))
        framed.add(t)
        if not os.path.exists(t): bad('%s frames %s, which does not exist' % (f, t))
        elif not os.path.exists(t[:-5] + '.json'): bad('%s has no %s.json source beside it' % (t, os.path.basename(t)[:-5]))
assets = os.path.normpath('../architecture')
for d in ([] if BABUL else sorted(glob.glob(os.path.join(assets, '*.html')))):
    if os.path.normpath(d) not in framed: bad('%s is drawn and no architecture screen frames it' % d)
print('   %d diagrams framed' % len(framed))

head('routes — every app screen is drawn, and every drawing has a screen')

app_dir = APP_DIR
if not os.path.isdir(app_dir):
    print('   skipped — no app at %s' % app_dir)
else:
    on_disk_routes = set()
    for root, _dirs, fs in os.walk(app_dir):
        for f in fs:
            if not is_screen(f):
                continue
            rel = os.path.relpath(os.path.join(root, f), app_dir)
            on_disk_routes.add(rel)

    declared_routes, undeclared = set(), []
    for f in sorted(declared_files):
        sc = files.get(f) or files.get(states.get(f))
        if sc is None:
            continue
        if 'route' not in sc:
            undeclared.append(f)
        elif sc['route']:
            declared_routes.add(sc['route'])

    for f in undeclared:
        bad('%s declares no `route` — say which app screen renders it, or null' % f)
    for r in sorted(declared_routes - on_disk_routes):
        bad('routes.js points at src/app/%s, which does not exist' % r)
    # A route that ships with no drawing is allowed ONLY while it is written
    # down. `missing` is the set's record of what the app has and the wireframes
    # do not, and a divergence nobody recorded is the one that rots — §11 says a
    # deliberate departure is fine and must be stated.
    recorded = " ".join((m.get('what', '') + ' ' + m.get('why', ''))
                        for m in (R.get('missing') or []))
    for r in sorted(on_disk_routes - declared_routes):
        if r in recorded:
            print('   pending: src/app/%s ships and is recorded in `missing`' % r)
        else:
            bad('src/app/%s ships and no screen draws it, and `missing` does not say why' % r)
    print('   %d app screens, all drawn by %d wireframes' % (
        len(on_disk_routes), len([f for f in declared_files
                                  if (files.get(f) or {}).get('route')])))

# ---- 9. app-flow — the app navigates where the chart says it does ----------
# Checks 5 and 6 prove the design set agrees with ITSELF. This one is the pair
# they were missing: that the APP agrees with it too. A chart can be internally
# perfect and still describe a product that navigates somewhere else entirely,
# and until this check existed nothing would have said so.
#
# Comments are stripped first. Three of the first seven "findings" were prose
# in a comment explaining a navigation that had been REMOVED — the same trap the
# well-formed check fell into, and the reason both now strip before matching.
head('app-flow — every navigation the app performs is a declared edge')

# A design file may be the SOURCE of a navigation whether it is the screen or
# one of its states: food/barcode-locked is reached in barcode.tsx and links to
# search from there, and the edge is declared on the state.
# DECLARATION ORDER, and it has to be a list rather than whatever a set hands
# back. `declared_files` is a set, so `froms[0]` below was a different one of
# food/item.tsx's three portion faces on every run — and the `missing` entry
# naming one of them therefore matched about a third of the time. The check
# passed or failed on PYTHONHASHSEED, which is the worst thing a check can do.
owners = {}
for f in order:
    r = (files.get(f) or {}).get('route') or (files.get(states.get(f, '')) or {}).get('route')
    if r: owners.setdefault(r, []).append(f)

def app_route(href):
    """A route and a filename, reduced to the same thing.

    `routes.js` names a FILE — "(tabs)/today.tsx" — and the app navigates to a
    ROUTE — "/(tabs)/today". Both lose the extension, the leading slash, any
    query string and every route group, so the two can be compared at all.
    """
    h = href.split('?')[0].strip('/')
    # EVERY group, not only a leading one. `(app)/(tabs)/tax/index.tsx` is
    # reached as "/tax"; stripping one group left "(tabs)/tax", which no
    # navigation in the app ever names.
    h = re.sub(r'\([^)/]+\)/', '', h + '/').rstrip('/')
    h = re.sub(r'\.tsx$', '', h)
    # A dynamic segment is the same segment whatever it is called: the file says
    # `inbox/[docId]`, a template says `/inbox/${id}`, and both mean "one of them".
    h = re.sub(r'\[[^\]/]*\]', '[]', h)
    # `group/[id]/index.tsx` is reached as "/group/[id]", and `(tabs)/index.tsx`
    # as "/". Without this the first screen after entry matched nothing. On the
    # web the same file is called `page.tsx`.
    return re.sub(r'(^|/)(?:index|page)$' if WEB else r'(^|/)index$', '', h)

# A route literal, in whichever quote the app writes them. Reading only `"` and
# backticks found NO navigation at all in an app that single-quotes its strings:
# "0 navigations checked", and every forward edge reported as never performed.
ROUTE_LIT = r'(?:["\'](/[^"\'`$]*)|`(/[^`]*)`)'
def route_lits(text, before=''):
    """Every route literal in `text`, optionally only those following `before`.

    A template literal used to be read up to its first `${`, so
    router.push(`/inbox/${id}`) was "a navigation to /inbox/" — the LIST, from
    the list — and the document screen it really opens was reported as a
    drawing the app never reaches. The interpolation is a dynamic segment.
    """
    return {quoted or re.sub(r'\$\{[^}]*\}', '[]', template)
            for quoted, template in re.findall(before + ROUTE_LIT, text)}
# The site also navigates from the server, with next/navigation's redirect().
NAV_CALL = r'(?:router\.(?:push|replace)|\bredirect)\(' if WEB else r'router\.(?:push|replace)\('

def strip_comments(src):
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    return re.sub(r'^\s*//.*$', '', src, flags=re.M)

def strip_guards(src):
    """Drop the redirects that recover from a state that should not happen.

    `if (!plate) router.replace("/scan/camera")` is not a route a user can take
    — it is what a screen does when the thing it was opened to edit has gone.
    The chart describes the product, and a guard is not part of it; demanding an
    edge for one would demand a LINK for it, and a "go to Today" control on the
    cooking-fat screen is not a thing any of these wireframes should grow.
    """
    return re.sub(r'if\s*\(\s*\(?\s*![^;{]*?\)\s*\{?[^;}]*?router\.replace\([^;]*?\);',
                  '', src, flags=re.S)

def routes_in(src):
    """Every app route this source navigates to.

    Deliberately blunt: any "/..." string inside a router call, a <Redirect>, or
    a ternary in either. Reading them individually missed
    `router.replace(ask ? "/scan/clarify" : "/scan/result")` — both arms — and
    the splash screen's <Redirect>, and reported five screens as unbuilt that
    had been built for weeks. A false POSITIVE here costs a declared edge; a
    false negative costs the trust in the whole check.
    """
    out = set()
    for m in re.finditer(NAV_CALL, src):
        # Balance the parens rather than stopping at the first one. The
        # non-greedy `(.*?)\)` this replaced stopped at the `)` of any call
        # INSIDE the argument, so `router.push(isFat(c) ? A : B)` was read as
        # `isFat(c` and both destinations went unseen.
        i, depth = m.end(), 1
        while i < len(src) and depth:
            depth += (src[i] == '(') - (src[i] == ')')
            i += 1
        out |= route_lits(src[m.end():i])
    for m in re.finditer(r'<Redirect\b[^>]*>', src, re.S):
        out |= route_lits(m.group(0))
    # A route handed to a component as a prop — <Link href>, a settings row's
    # path — is a navigation too; the component makes the call, not this file.
    out |= route_lits(src, r'\b(?:href|path|to)=\{?\s*')
    # ...and a route handed over by NAME: `const bookHref = signedIn ? `/ca/hire…`
    # : `/sign-in…`` and then `href={bookHref}`. The literal is one line up from
    # the prop, and reading only the prop called the Book button a dead end.
    for name in set(re.findall(r'\b(?:href|path|to)=\{\s*([A-Za-z_]\w*)\s*\}', src)):
        for m in re.finditer(r'\bconst\s+%s\s*=(.*?);' % re.escape(name), src, re.S):
            out |= route_lits(m.group(1))
    return out

# How many files import each hook. One means the hook belongs to that file.
HOOK_USERS = {}
if not WEB:
    for _f in glob.glob(os.path.join(SRC_DIR, '**', '*.ts*'), recursive=True):
        for _h in set(re.findall(r"""from\s+["']@/(hooks/[^"']+)["']""", open(_f).read())):
            HOOK_USERS[_h] = HOOK_USERS.get(_h, 0) + 1

def screen_source(path):
    """The source that renders one screen.

    In Expo that is the route file. In Next.js `page.tsx` is usually a shell —
    thirteen lines that mount `<VerifyForm />` — and the form beside it is where
    router.push lives. Reading the shell alone found 42 navigations in a
    109-page site and called the KYC flow a drawing the app never performs. So
    on the web a screen is its folder: every file under it, stopping at any
    folder that is a page of its own.
    """
    if not WEB:
        # A route is thin: it reads params and mounts one screen component, and
        # that component is where router.push lives. Reading the route alone
        # found 0 navigations in chess and imposter. So in Expo a screen is its
        # route file and the components that file mounts.
        #
        # One step further, and only inside the feature: a screen keeps its
        # state and navigation in a hook and its sections in the same folder,
        # so those are read too. Splitting aakalan's screens that way took it
        # from 33 navigations to 15. A component from ANOTHER folder is not
        # followed — a shared back button is not this screen's navigation —
        # and neither is a hook two files use: imposter's useHomeActions
        # serves Home and History, and reading it into History charged that
        # screen with every route Home can reach.
        def resolve(spec):
            return next((p for p in (os.path.join(SRC_DIR, spec + e) for e in ('.tsx', '.ts'))
                         if os.path.isfile(p)), None)
        def imports(src, prefix):
            return re.findall(r"""from\s+["']@/(%s[^"']+)["']""" % prefix, src)
        src, seen = open(path).read(), []
        for spec in imports(src, 'components/'):
            hit = resolve(spec)
            if not hit or hit in seen: continue
            seen.append(hit)
            inner = open(hit).read()
            feature = os.path.dirname(spec) + '/'
            own = [h for h in imports(inner, 'hooks/') if HOOK_USERS.get(h, 0) == 1]
            for more in own + imports(inner, feature):
                deep = resolve(more)
                if deep and deep not in seen: seen.append(deep)
        return '\n'.join([src] + [open(p).read() for p in seen])
    here, parts = os.path.dirname(path), []
    for root, dirs, fs in os.walk(here):
        if root != here and 'page.tsx' in fs:
            dirs[:] = []
            continue
        parts += [open(os.path.join(root, f)).read() for f in sorted(fs) if f.endswith(('.tsx', '.ts'))]
    return '\n'.join(parts)

# A screen navigates through its components too, and through the tab bar.
# WaysInTiles is where Today reaches search and barcode; (tabs)/_layout is where
# every tab screen reaches every other one and the shutter. Attributing those to
# the file that happens to contain the call would mean the chart could never
# describe a tab bar at all.
shared_targets = set()
KNOWN_ROUTES = {'/' + app_route(r) for r in owners}
for pattern in ('components/**/*.tsx', 'components/**/*.ts', 'hooks/**/*.ts'):
    for path in glob.glob(os.path.join(SRC_DIR, pattern), recursive=True):
        src_shared = strip_comments(open(path).read())
        shared_targets |= routes_in(src_shared)
        # Any route-shaped literal, because a component that names one is going
        # there — useGo says `go("/food/search")` and hands the result to
        # router.push, which reading router calls alone will never see.
        shared_targets |= {t for t in re.findall(r'["\'`](/[a-z(][^"\'`$]*)', src_shared)
                           if '/' + app_route(t) in KNOWN_ROUTES}
# The tab group sits at the top of app/ in a small app and inside an auth group
# in a larger one — `(app)/(tabs)/` — so it is found, not assumed.
TABS_LAYOUT = next(iter(sorted(glob.glob(os.path.join(APP_DIR, '**', '(tabs)', '_layout.tsx'), recursive=True))),
                   os.path.join(APP_DIR, '(tabs)/_layout.tsx'))
TABS_DIR = os.path.dirname(TABS_LAYOUT)
TABS_REL = os.path.relpath(TABS_DIR, APP_DIR)
tab_targets = routes_in(strip_comments(open(TABS_LAYOUT).read())) if os.path.isfile(TABS_LAYOUT) else set()
# Every screen directly in (tabs)/ is a tab, reachable from every other one. A
# tab that owns a stack of its own is a FOLDER there, entered at its index.
tab_routes = {'/(tabs)/' + os.path.splitext(f)[0] for f in os.listdir(TABS_DIR)
              if (f.endswith('.tsx') and not f.startswith('_'))
              or os.path.isfile(os.path.join(TABS_DIR, f, 'index.tsx'))} if os.path.isdir(TABS_DIR) else set()

nav_n, undeclared = 0, []
for path in sorted(glob.glob(os.path.join(APP_DIR, '**/*.tsx'), recursive=True)):
    rel = os.path.relpath(path, APP_DIR)
    froms = owners.get(rel, [])
    if not froms: continue
    targets = routes_in(strip_guards(strip_comments(screen_source(path))))
    for t in sorted(targets):
        tos = [f for r, fs in owners.items() if app_route(r) == app_route(t) for f in fs]
        if not tos: continue
        nav_n += 1
        if not any(e['from'] in froms and e['to'] in tos for e in R['flow']['edges']):
            undeclared.append('%s -> %s  (%s navigates to %s)' % (froms[0], tos[0], rel, t))
recorded_flow = ' '.join((m.get('what', '') + ' ' + m.get('why', ''))
                         for m in (R.get('missing') or []))
for u in sorted(set(undeclared)):
    # Same rule check 8 uses: a deliberate departure is fine and must be STATED.
    key = u.split('  (')[0]
    if all(part in recorded_flow for part in key.split(' -> ')):
        print('   pending: %s — recorded in `missing`' % key)
    else:
        bad(u)

# ---- and the other direction ------------------------------------------------
# The check above finds navigations the chart does not know about. This finds
# edges the chart promises and the app never performs, which is the half that
# let onboarding/welcome's "see what costs money" link to the paywall sit in the
# design, and nowhere in the app, through every previous pass.
#
# FORWARD edges only. A `back` is usually the system gesture or a header control
# that resolves to router.back(), a `side` is often a tab bar, and a `state` is
# reached by circumstance — none of those appear as a literal route in the
# source, and demanding them would be demanding the wrong thing.
performed = set()
for path in sorted(glob.glob(os.path.join(APP_DIR, '**/*.tsx'), recursive=True)):
    rel = os.path.relpath(path, APP_DIR)
    froms = owners.get(rel, [])
    if not froms: continue
    reach = routes_in(strip_comments(screen_source(path))) | shared_targets
    # THE TAB BAR IS ON EVERY TAB SCREEN. It navigates by route NAME rather than
    # by href, so no amount of reading for a "/..." string will find it — and
    # the chart is right to draw those edges, because a user really can tap
    # Trends from Today. Every tab and the shutter, available from all of them.
    if rel.startswith(TABS_REL + '/'):
        reach |= tab_targets | tab_routes
    for f in froms:
        for t in reach:
            performed.add((f, app_route(t)))

unbuilt = not_built = 0
for e in R['flow']['edges']:
    if e.get('back') or e.get('side') or e.get('state'): continue
    src_route = (files.get(e['from']) or {}).get('route')
    dst_route = (files.get(e['to']) or {}).get('route')
    if not src_route or not dst_route: continue        # a screen with no app yet
    # A correction returns to the screen it was pushed from, which then renders
    # the corrected state. There is no literal route for that and there should
    # not be, so the edge says so rather than the check pretending not to notice.
    if e.get('viaBack'): continue
    key = '%s -> %s' % (e['from'], e['to'])
    # THROUGH A FILE THE SET DOES NOT DRAW. Consent leads to the plan picker by
    # way of a details form nobody drew, and a verified sign-in reaches consent
    # because the root layout's gate sends it there — the screen itself only
    # ever asks for "/". Neither is a navigation `from` performs, and both are
    # true of the app, so the edge names the file in between and BOTH hops are
    # read out of the source: `from` reaches it, and it reaches `to`. A layout
    # wraps the screen rather than being navigated to, so it owes only the
    # second hop.
    via = e.get('via')
    if via:
        via_path = os.path.join(APP_DIR, via)
        via_reach = ({app_route(t) for t in routes_in(strip_comments(screen_source(via_path)))}
                     if os.path.isfile(via_path) else set())
        wraps = os.path.basename(via) in ('_layout.tsx', 'layout.tsx')
        if app_route(dst_route) in via_reach and (wraps or (e['from'], app_route(via)) in performed):
            continue
        unbuilt += 1
        bad('%s is drawn as going through src/app/%s, and the app does not go that way' % (key, via))
        continue
    # Two faces of one route — a countdown becoming the round, a modal over the
    # screen that opened it — change state, not route. No call can exist.
    if app_route(src_route) == app_route(dst_route): continue
    if (e['from'], app_route(dst_route)) not in performed:
        unbuilt += 1
        # The same rule as the other direction, and as check 8: a departure is
        # fine and must be STATED. Here the set and the app part ways — it draws
        # a step the app has not built, or takes by another road — and `missing`
        # is where the gallery prints that. The entry has to name this edge
        # exactly, so one sentence cannot excuse two.
        if any(m.get('what') == key for m in (R.get('missing') or [])):
            not_built += 1
            print('   pending: %s is drawn and the app does not go there — recorded in `missing`' % key)
        else:
            bad('%s is drawn and the app never navigates there%s'
                % (key, ' (%s)' % e['label'] if e.get('label') else ''))

print('   %d navigations checked, %d forward edges honoured%s'
      % (nav_n, sum(1 for e in R['flow']['edges']
                    if not (e.get('back') or e.get('side') or e.get('state'))) - unbuilt,
         ', %d recorded as departures' % not_built if not_built else ''))

# ---- 10. copy — a string on screen is drawn, wherever it is raised from ----
# The other nine checks compare structure: files, links, edges, routes. None of
# them can see COPY, and that is how nine Alert.alert calls — four on the money
# path, one on an irreversible delete — shipped with no wireframe holding a word
# of them. A dialog drawn by the OS has no route and no layout of ours to get
# wrong, so it slips past every structural check there is.
head('copy — every string a dialog or a toast shows appears in the set')

# Straight vs curly, entity vs character, one line vs wrapped: the same sentence
# is written three ways across .tsx and .html, so both sides are flattened before
# they are compared.
import html as _html
def flat(t):
    t = _html.unescape(t)
    for a, b in (('\u2019', "'"), ('\u2018', "'"), ('\u201c', '"'), ('\u201d', '"'),
                 ('\u2014', '-'), ('\u2013', '-'), ('\u00a0', ' ')):
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()

drawn = flat(' '.join(open(f).read() for f in sorted(on_disk) + DEFS))

# An option's `style`, and the mimeType/UTI an onPress hands to the share sheet,
# sit inside the same parentheses without being copy. A word someone reads either
# contains a space or is a bare word; "image/png" and "public.png" are neither.
# Toasts are here for the same reason and were the same story: the set drew their
# titles in a table with no Detail column, so 12 detail lines — "Nothing was
# charged", "Your scans are back" — were undrawn, and one title was missing.
# A browser has no Alert.alert: the site raises its own toast() and the
# browser's confirm box, and their words are as undrawn as a native dialog's.
RAISERS = re.compile(r'(?:\btoast|window\.confirm)\(' if WEB else r'(?:Alert\.alert|showToast)\(')
KEYWORDS = {'cancel', 'destructive', 'default', 'plain',
            'success', 'error', 'warning', 'warn', 'info', 'ask', 'neutral'}
STR = re.compile(r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'')
# `outcome.status === 'invalid-vpa'` sits inside the call and is a code, not copy.
# So is the name of a callable an option's onPress invokes — "removeFamilyMember"
# is one bare word, which is otherwise exactly what a button label looks like.
CODE = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]*)+')

# AN APP THAT TRANSLATES RAISES NO LITERALS. charades writes
# `Alert.alert(t("history.clearTitle"), t("history.clearBody"))`, and a key has
# a dot in it and no space, so it was never copy: "0 dialog and toast strings
# checked, all drawn" for an app with a confirm on an irreversible delete. The
# key is resolved through the English dictionary — the one the other languages
# fall back to — and the sentence it names is what gets checked.
I18N = {}
I18N_FILE = os.path.join(SRC_DIR, 'i18n', 'en.ts')
if os.path.isfile(I18N_FILE):
    for key, double, single in re.findall(
            r'["\']([\w.-]+)["\']\s*:\s*(?:"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\')',
            open(I18N_FILE).read()):
        I18N[key] = double or single
T_CALL = re.compile(r'\bt\(\s*["\']([\w.-]+)["\']\s*\)')
def translated(call):
    """The call with every `t("key")` replaced by the sentence it resolves to."""
    return T_CALL.sub(lambda m: json.dumps(I18N[m.group(1)]) if m.group(1) in I18N else m.group(0), call)
# A template literal is not read for copy — it is mostly interpolation — but it
# has to be REMOVED before single-quoted strings are, or the apostrophe in
# `${x} isn't valid` opens a string that runs to the next one.
TEMPLATE = re.compile(r'`(?:[^`\\]|\\.)*`')
def is_copy(t):
    if t.lower() in KEYWORDS or not re.search(r'[A-Za-z]', t) or len(t) < 2:
        return False
    if CODE.fullmatch(t):
        return False
    return ' ' in t or not re.search(r'[/:._]', t)

dialog_n, before = 0, fail
if not os.path.isdir(app_dir):
    print('   skipped — no app at %s' % app_dir)
else:
    for root, _dirs, fs in os.walk(app_dir if False else os.path.join(app_dir, '..')):
        for fn in sorted(fs):
            if not fn.endswith(('.tsx', '.ts')):
                continue
            path = os.path.join(root, fn)
            src = open(path).read()
            for m in RAISERS.finditer(src):
                i, depth = m.end() - 1, 0
                while i < len(src):
                    if src[i] == '(': depth += 1
                    elif src[i] == ')':
                        depth -= 1
                        if depth == 0: break
                    i += 1
                call = src[m.end():i]
                rel = os.path.relpath(path, os.path.join(app_dir, '..'))
                for double, single in STR.findall(TEMPLATE.sub('', translated(call))):
                    lit = double or single
                    piece = flat(lit.replace('\\"', '"').replace("\\'", "'"))
                    if not is_copy(piece): continue
                    dialog_n += 1
                    if piece not in drawn:
                        bad('src/%s puts "%s" on screen and no wireframe draws it'
                            % (rel, piece if len(piece) < 60 else piece[:57] + '...'))
    print('   %d dialog and toast strings checked%s'
          % (dialog_n, ', all drawn' if fail == before else ', %d undrawn' % (fail - before)))

# ---- Babul: the data is whole, so Babul can import it as it stands -----------
# The checks above compare the drawing with the app. These compare the data
# with itself and with the drawing: every name a file uses resolves, so an
# import never meets a page, state, variant or icon that is not there.
if BABUL:
    head('babul — the set reads whole from its HTML, and styles.css holds nothing dead')
    B = R['_babul']
    # Reading the HTML checks every instance, prop, variant, state block and
    # link, and that the crawl reaches every file (_shell/scan.mjs).
    for e in B['errors']:
        bad(e)
    for a in (B['assets'].get('logos') or []) + (B['assets'].get('images') or []):
        if not os.path.exists(os.path.join('..', a['file'])):
            bad('assets.js: %s does not exist' % a['file'])

    # A class in styles.css that nothing draws is dead weight that drifts.
    used_cls = set()
    for f in sorted(declared_files & on_disk) + DEFS:
        for attr in re.findall(r'class="([^"]*)"', unbrace(open(f).read())):
            used_cls |= set(attr.split())
    own = set(re.findall(r'\.([a-z][a-z0-9-]*)', re.sub(r'/\*.*?\*/', '', open('styles.css').read(), flags=re.S)))
    for c in sorted(own - used_cls):
        bad('styles.css declares .%s and nothing draws it' % c)
    print('   %d pages, %d links, %d components, %d icons'
          % (len(B['pages']), len(B['links']), len(B['components']), len((B['assets'].get('icons') or {}).get('names', []))))

print('\n' + ('ALL CHECKS PASS' if not fail else '%d FAILURES' % fail))
sys.exit(1 if fail else 0)
