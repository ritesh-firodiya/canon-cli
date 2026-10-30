/* Architecture: .context/architecture/architecture.json, drawn as one page.
 * ============================================================================
 * Where the product stands, how it fits together, what it costs, what breaks,
 * what leaves the device and what is not known yet. The JSON is the only source,
 * so what people see and what an agent reads cannot disagree. Only `canon ui` can
 * reach it: a browser refuses fetch on file://, so the bar's link is off there.
 *
 * Everything is set as text, never as markup: the file is data.              */
(function () {
  var S = window.BABUL_SHELL;
  if (!S) return;
  var NS = "http://www.w3.org/2000/svg";
  var MAP = { width: 1072, pad: 16, gap: 56, head: 32, box: 62, boxGap: 10 };
  var BASIS = { measured: "Measured", stated: "Stated", code: "In code", assumed: "Assumed", unknown: "Not known" };

  function el(tag, cls, text) { return S.el(tag, cls, text); }
  function svg(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function section(host, title, note) {
    var s = el("section", "arch-section"), head = el("header", "arch-head");
    head.appendChild(el("h2", null, title));
    if (note) head.appendChild(el("p", null, note));
    s.appendChild(head);
    host.appendChild(s);
    return s;
  }
  function basisCell(value) {
    var td = el("td");
    if (!value || !value.basis) return td;
    td.appendChild(el("span", "arch-pill arch-pill--" + value.basis, BASIS[value.basis] || value.basis));
    if (value.source) td.appendChild(el("span", "arch-source", value.source));
    return td;
  }
  function table(parent, headers, rows) {
    var wrap = el("div", "arch-card arch-scroll"), t = el("table"), body = el("tbody");
    if (headers) {
      var head = el("thead"), tr = el("tr");
      headers.forEach(function (h) { tr.appendChild(el("th", null, h)); });
      head.appendChild(tr);
      t.appendChild(head);
    }
    rows.forEach(function (cells) {
      var tr = el("tr");
      cells.forEach(function (cell) { tr.appendChild(cell instanceof Node ? cell : el("td", null, cell)); });
      body.appendChild(tr);
    });
    t.appendChild(body);
    wrap.appendChild(t);
    parent.appendChild(wrap);
  }

  /* ---- the map: one column per area, a box per part, a line per step of a flow */
  function layout(arch) {
    var count = arch.areas.length;
    var colW = (MAP.width - MAP.pad * 2 - MAP.gap * (count - 1)) / count;
    var tallest = 0, boxes = {};
    arch.areas.forEach(function (area, i) {
      var x = MAP.pad + i * (colW + MAP.gap);
      var parts = arch.parts.filter(function (p) { return p.area === area.id; });
      parts.forEach(function (p, j) {
        boxes[p.id] = { x: x + 12, y: MAP.pad + MAP.head + j * (MAP.box + MAP.boxGap), w: colW - 24, h: MAP.box, part: p };
      });
      tallest = Math.max(tallest, parts.length);
      area._x = x;
    });
    var height = MAP.pad * 2 + MAP.head + tallest * (MAP.box + MAP.boxGap) + 8;
    return { boxes: boxes, colW: colW, height: height };
  }
  function linkPath(a, b) {
    if (a.x === b.x) {
      var up = a.y > b.y, x = a.x + a.w - 14;
      return "M" + x + " " + (up ? a.y : a.y + a.h) + "L" + x + " " + (up ? b.y + b.h : b.y);
    }
    var right = a.x < b.x, x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
    var y1 = a.y + a.h / 2, y2 = b.y + b.h / 2, m = (x1 + x2) / 2;
    return "M" + x1 + " " + y1 + "C" + m + " " + y1 + " " + m + " " + y2 + " " + x2 + " " + y2;
  }
  var pairsOf = function (path) { return path.slice(1).map(function (id, i) { return [path[i], id]; }); };
  var keyOf = function (a, b) { return a < b ? a + "|" + b : b + "|" + a; };

  function drawMap(parent, arch) {
    var card = el("div", "arch-card"), tabs = el("div", "arch-tabs"), line = el("div", "arch-flow");
    var map = layout(arch);
    var root = svg("svg", { "class": "arch-map", viewBox: "0 0 " + MAP.width + " " + map.height, role: "img", "aria-label": "How the parts connect" });
    arch.areas.forEach(function (area) {
      root.appendChild(svg("rect", { "class": "arch-area", x: area._x, y: MAP.pad, width: map.colW, height: map.height - MAP.pad * 2, rx: 10 }));
      root.appendChild(svg("text", { "class": "arch-area-label", x: area._x + 12, y: MAP.pad + 22 }, area.label.toUpperCase()));
    });
    var defs = svg("defs", {});
    [["arch-arrow", "arch-arrow"], ["arch-arrow-on", "arch-arrow arch-arrow--on"]].forEach(function (m) {
      var marker = svg("marker", { id: m[0], markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" });
      marker.appendChild(svg("path", { d: "M0 0L8 4L0 8z", "class": m[1] }));
      defs.appendChild(marker);
    });
    root.appendChild(defs);
    var links = {}, nodes = {}, flows = arch.flows || [];
    flows.forEach(function (flow) {
      pairsOf(flow.path).forEach(function (pair) {
        var key = keyOf(pair[0], pair[1]);
        if (links[key] || pair[0] === pair[1] || !map.boxes[pair[0]] || !map.boxes[pair[1]]) return;
        links[key] = svg("path", { "class": "arch-link", d: linkPath(map.boxes[pair[0]], map.boxes[pair[1]]) });
        links[key].dataset.from = pair[0];
        root.appendChild(links[key]);
      });
    });
    Object.keys(map.boxes).forEach(function (id) {
      var b = map.boxes[id], p = b.part, g = svg("g", { "class": "arch-node" }), cost = p.cost || {};
      g.appendChild(svg("rect", { "class": "arch-box", x: b.x, y: b.y, width: b.w, height: b.h, rx: 8 }));
      g.appendChild(svg("text", { "class": "arch-name", x: b.x + 10, y: b.y + 20 }, p.label));
      g.appendChild(svg("text", { "class": "arch-what", x: b.x + 10, y: b.y + 36 }, p.does));
      g.appendChild(svg("text", { "class": "arch-price arch-price--" + (cost.basis || "unknown"), x: b.x + 10, y: b.y + 53 }, p.price || cost.today || ""));
      nodes[id] = g;
      root.appendChild(g);
    });
    function pick(i) {
      var flow = flows[i], on = {}, used = {};
      [].forEach.call(tabs.children, function (t, j) { t.setAttribute("aria-pressed", String(j === i)); });
      if (!flow) return;
      flow.path.forEach(function (id) { on[id] = true; });
      pairsOf(flow.path).forEach(function (pair) { used[keyOf(pair[0], pair[1])] = true; });
      Object.keys(nodes).forEach(function (id) { nodes[id].setAttribute("class", "arch-node" + (on[id] ? " is-on" : " is-dim")); });
      // A path shows the way it travels; a line off the path shows every way any action uses it.
      var travelled = {};
      (flows.length ? flows : []).forEach(function (f) {
        if (f !== flow) pairsOf(f.path).forEach(function (pair) { travelled[keyOf(pair[0], pair[1])] = travelled[keyOf(pair[0], pair[1])] || []; travelled[keyOf(pair[0], pair[1])].push(pair[0]); });
      });
      var own = {};
      pairsOf(flow.path).forEach(function (pair) { var k = keyOf(pair[0], pair[1]); (own[k] = own[k] || []).push(pair[0]); });
      Object.keys(links).forEach(function (key) {
        var link = links[key], lit = used[key], starts = (lit ? own[key] : travelled[key]) || [], marker = "url(#" + (lit ? "arch-arrow-on" : "arch-arrow") + ")";
        link.setAttribute("class", "arch-link" + (lit ? " is-on" : " is-dim"));
        link.removeAttribute("marker-end");
        link.removeAttribute("marker-start");
        if (starts.indexOf(link.dataset.from) >= 0) link.setAttribute("marker-end", marker);
        if (starts.some(function (id) { return id !== link.dataset.from; })) link.setAttribute("marker-start", marker);
      });
      line.replaceChildren();
      var head = el("div");
      head.appendChild(el("b", null, flow.cost));
      if (flow.note) head.appendChild(el("span", "arch-source", flow.note));
      var list = el("ol");
      (flow.steps || []).forEach(function (step) { list.appendChild(el("li", null, step)); });
      line.append(head, list);
    }
    flows.forEach(function (flow, i) {
      var b = el("button", "arch-tab", flow.name);
      b.type = "button";
      b.addEventListener("click", function () { pick(i); });
      tabs.appendChild(b);
    });
    if (flows.length) card.appendChild(tabs);
    card.appendChild(root);
    if (flows.length) card.appendChild(line);
    parent.appendChild(card);
    // Measured once on the page: the map keeps one line per box, and the Cost table below has the full text.
    Object.keys(nodes).forEach(function (id) {
      var b = map.boxes[id];
      nodes[id].querySelectorAll("text").forEach(function (t) { fit(t, b.w - 20); });
    });
    pick(0);
  }
  function fit(text, width) {
    var full = text.textContent;
    if (text.getComputedTextLength() <= width) return;
    var low = 0, high = full.length;
    while (low < high) {
      var mid = Math.ceil((low + high) / 2);
      text.textContent = full.slice(0, mid).trimEnd() + "…";
      if (text.getComputedTextLength() <= width) low = mid;
      else high = mid - 1;
    }
    text.textContent = full.slice(0, low).trimEnd() + "…";
    text.appendChild(svg("title", {}, full));
  }

  /* ---- growth: one number scaled up, against its limit ---------------------- */
  function drawGrowth(parent, growth) {
    var card = el("div", "arch-card arch-pad"), row = el("div", "arch-scale"), out = el("div", "arch-out");
    row.appendChild(el("span", "arch-muted", growth.unit));
    var cost = el("b"), perDay = el("b"), limit = el("b");
    [[growth.costLabel || "Cost a month", cost], [growth.unit + ", per day", perDay]].concat(growth.limitPerDay ? [[growth.limitLabel || "Limit", limit]] : []).forEach(function (pair) {
      var d = el("div");
      d.appendChild(el("small", null, pair[0]));
      d.appendChild(pair[1]);
      out.appendChild(d);
    });
    var money = function (v) { return v < 1 ? "$" + v.toFixed(2) : "$" + Math.round(v).toLocaleString("en-US"); };
    function pick(i) {
      var n = growth.steps[i], day = n / 30;
      [].forEach.call(row.querySelectorAll("button"), function (b, j) { b.setAttribute("aria-pressed", String(j === i)); });
      cost.textContent = money(n * growth.rate) + " / mo";
      perDay.textContent = Math.round(day).toLocaleString("en-US");
      if (growth.limitPerDay) {
        var share = day / growth.limitPerDay;
        limit.textContent = share > 1 ? "Over the limit" : share < 0.01 ? "Under 1% used" : Math.round(share * 100) + "% used";
        limit.className = share > 1 ? "arch-warn" : "";
      }
    }
    growth.steps.forEach(function (n, i) {
      var b = el("button", "arch-tab", n.toLocaleString("en-US") + (n === growth.today ? " (today)" : ""));
      b.type = "button";
      b.addEventListener("click", function () { pick(i); });
      row.appendChild(b);
    });
    card.append(row, out);
    if (growth.note) card.appendChild(el("p", "arch-note", growth.note));
    parent.appendChild(card);
    pick(0);
  }

  function show(host, arch) {
    host.appendChild(el("h1", "arch-title", window.BABUL_MODEL.product.name + " architecture"));
    host.appendChild(el("p", "arch-summary", arch.summary));
    if (arch.verified) host.appendChild(el("p", "arch-source", "Verified " + arch.verified));

    if ((arch.headlines || []).length) {
      var tiles = el("div", "arch-tiles");
      arch.headlines.forEach(function (h) {
        var t = el("div", "arch-card arch-tile");
        t.appendChild(el("small", null, h.label));
        t.appendChild(el("b", null, h.value));
        if (h.note) t.appendChild(el("span", null, h.note));
        tiles.appendChild(t);
      });
      host.appendChild(tiles);
    }
    drawMap(section(host, "How it fits together", (arch.flows || []).length ? "Pick something a user does to see its path and what it costs." : null), arch);

    table(section(host, "Cost", "Every number says where it came from, so a guess cannot pass for a fact."),
      ["Service", "Pays for", "Today", "Grows with", "Basis"],
      arch.parts.filter(function (p) { return p.cost && !p.cost.hide; }).map(function (p) {
        return [p.label, p.does, p.cost.today, p.cost.grows || "", basisCell(p.cost)];
      }));

    if (arch.growth) drawGrowth(section(host, "What if it grows?", arch.growth.summary), arch.growth);

    var failing = arch.parts.filter(function (p) { return p.ifDown; });
    if (failing.length) {
      table(section(host, "What breaks when something fails"), ["If this fails", "The user sees", "Their data", "Basis"],
        failing.map(function (p) { return [p.label, p.ifDown.user || "", p.ifDown.data || "", basisCell(p.ifDown)]; }));
    }

    var two = el("div", "arch-two");
    if ((arch.data || []).length) {
      var data = section(two, "Where the data goes");
      table(data, null, arch.data.map(function (d) { return [d.what, d.where]; }));
    }
    if ((arch.unknowns || []).length) {
      var unknowns = section(two, "What we do not know yet"), card = el("div", "arch-card"), list = el("ul", "arch-gaps");
      arch.unknowns.forEach(function (u) { list.appendChild(el("li", null, u)); });
      card.appendChild(list);
      unknowns.appendChild(card);
    }
    host.appendChild(two);
  }

  function message(host, text) { host.appendChild(el("p", "arch-note", text)); }

  S.onBuild = function () {
    var host = el("div", "arch-view");
    S.canvas.appendChild(host);
    document.title = window.BABUL_MODEL.product.name + " — Architecture";
    fetch("/_architecture.json")
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (arch) {
        if (!arch || !arch.parts || !arch.areas) return message(host, "No architecture yet. Add .context/architecture/architecture.json.");
        show(host, arch);
      })
      .catch(function () { message(host, "Could not read the architecture. Run canon check, and make sure canon ui is still running."); });
  };
})();
