# Architecture page

One page per product: how it fits together, what it costs, what grows the bill,
what breaks, and what is not known. The source is one file,
`.context/architecture/architecture.json`. `canon ui` draws it under Architecture
in the top bar, agents read it, and `canon check` verifies it.

## What belongs here

Write what helps someone decide. A map of folders does not. If a line would be
the same for any app, cut it. Why a part was chosen stays in a wiki concept page;
link to it instead of repeating it.

**Never invent a fact.** A number comes from a bill, a log, the code or a wiki page,
and says which. What nobody wrote down is shown as not known, and listed in
`unknowns`. A page full of honest unknowns is correct; a tidy page of guesses is the
failure this page exists to stop. Do not fill a price from memory.

## Format

```json
{
  "schema_version": 2,
  "verified": "YYYY-MM-DD",
  "summary": "One or two sentences: what runs where, in plain words.",
  "headlines": [{ "label": "Known cost a month", "value": "$8", "note": "What it covers, and what is missing." }],
  "areas": [{ "id": "device", "label": "On the phone" }, { "id": "server", "label": "Our server" }, { "id": "outside", "label": "Outside services" }],
  "parts": [{
    "id": "model", "area": "outside", "label": "Vision model", "does": "Reads a plate",
    "price": "Short text on the map box; defaults to cost.today",
    "cost": { "today": "$0 on free tier", "grows": "Photo scans", "basis": "measured", "source": "wiki/entities/cost.md, Sep" },
    "ifDown": { "user": "What the user sees.", "data": "What happens to their data.", "basis": "stated", "source": "wiki/concepts/x.md" }
  }],
  "flows": [{
    "name": "Photo scan", "cost": "$0.00088", "note": "a scan",
    "path": ["app", "server", "model"], "steps": ["The phone sends the photo.", "..."]
  }],
  "growth": {
    "unit": "Scans a month", "rate": 0.00088, "today": 97, "steps": [97, 1000, 10000],
    "limitPerDay": 1500, "limitLabel": "Free tier (~1,500 a day)", "costLabel": "Model cost",
    "summary": "What this counts and what it leaves out.", "note": "Where the rate came from."
  },
  "data": [{ "what": "Meal log", "where": "Stays on the phone" }],
  "unknowns": ["The real monthly bill: no hosting cost is recorded."]
}
```

- `basis` is one of `measured` (a bill, log or run), `code` (read in the source),
  `stated` (a wiki page or doc says so), `assumed` (reasoned, not tested) and
  `unknown`. Anything but `unknown` names its `source`.
- A cost marked `unknown` holds no number: `"today": "Not read"`.
- `parts` are what runs or is paid for, not folders. Four to ten is usual. A part
  that costs nothing still gets `"today": "$0"` with a basis.
- `flows` are what a user does, the ones that cost money or carry risk first. `path`
  is the order the request travels, ids from `parts`; going through the server twice
  is fine. `growth` is only for a product with a real per-use cost and a known rate.
- A product with no server or no users says so. Keep it short: a small page for a
  small product.
- Change `verified` only after checking the costs. `canon check` warns after 90 days.
