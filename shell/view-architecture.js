/* Architecture: the repo's .context/architecture/*.json, one tab per diagram.
 * ============================================================================
 * The JSON is the only source, so what people see here and what an agent reads
 * cannot disagree. Only `canon ui` can reach it: a browser refuses fetch on
 * file://, so the bar's link is off when a set opens from disk.              */
(function () {
  var S = window.BABUL_SHELL;
  if (!S) return;
  var SVG = "http://www.w3.org/2000/svg";
  var PAD = 40;

  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVG, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  /* Where the line from a box's centre towards a point leaves the box. */
  function edge(box, toward) {
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var dx = toward.x - cx, dy = toward.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    var t = Math.min(dx ? box.w / 2 / Math.abs(dx) : Infinity, dy ? box.h / 2 / Math.abs(dy) : Infinity);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  function draw(diagram) {
    var boxes = {};
    diagram.components.forEach(function (c) {
      boxes[c.id] = { x: c.pos[0], y: c.pos[1], w: c.size[0], h: c.size[1], label: c.label, sublabel: c.sublabel };
    });
    var all = Object.keys(boxes).map(function (id) { return boxes[id]; });
    var left = Math.min.apply(null, all.map(function (b) { return b.x; })) - PAD;
    var top = Math.min.apply(null, all.map(function (b) { return b.y; })) - PAD;
    var right = Math.max.apply(null, all.map(function (b) { return b.x + b.w; })) + PAD;
    var bottom = Math.max.apply(null, all.map(function (b) { return b.y + b.h; })) + PAD;

    var root = svg("svg", { "class": "arch-svg", viewBox: [left, top, right - left, bottom - top].join(" "), role: "img", "aria-label": diagram.meta.title });
    var defs = svg("defs", {});
    var marker = svg("marker", { id: "arch-arrow", markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto" });
    marker.appendChild(svg("path", { d: "M0 0L8 4L0 8z", "class": "arch-arrow" }));
    defs.appendChild(marker);
    root.appendChild(defs);

    (diagram.connections || []).forEach(function (c) {
      var from = boxes[c.from], to = boxes[c.to];
      if (!from || !to) return;
      var a = edge(from, { x: to.x + to.w / 2, y: to.y + to.h / 2 });
      var b = edge(to, { x: from.x + from.w / 2, y: from.y + from.h / 2 });
      root.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, "marker-end": "url(#arch-arrow)", "class": "arch-line" + (c.variant ? " arch-line--" + c.variant : "") }));
      if (c.label) root.appendChild(svg("text", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 7, "class": "arch-edge-label" }, c.label));
    });
    all.forEach(function (b) {
      root.appendChild(svg("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, "class": "arch-box" }));
      var mid = b.y + b.h / 2;
      root.appendChild(svg("text", { x: b.x + b.w / 2, y: b.sublabel ? mid - 3 : mid + 5, "class": "arch-label" }, b.label));
      if (b.sublabel) root.appendChild(svg("text", { x: b.x + b.w / 2, y: mid + 15, "class": "arch-sublabel" }, b.sublabel));
    });
    return root;
  }

  function message(host, text) {
    host.appendChild(S.el("p", "arch-message", text));
  }

  function show(host, diagrams) {
    // Titles carry the order: "1 · Who uses it".
    var drawable = diagrams.filter(function (d) { return d.diagram_type === "architecture" && d.components; })
      .sort(function (a, b) { return a.meta.title.localeCompare(b.meta.title, undefined, { numeric: true }); });
    if (!drawable.length) return message(host, "No diagrams yet. Add them to .context/architecture/.");

    var tabs = S.el("div", "arch-tabs");
    var stage = S.el("div", "arch-stage");
    host.appendChild(tabs);
    host.appendChild(stage);
    var open = function (diagram) {
      history.replaceState(null, "", "#" + diagram.name);
      [].forEach.call(tabs.children, function (t) { t.classList.toggle("is-on", t.dataset.name === diagram.name); });
      stage.replaceChildren(draw(diagram), S.el("code", "arch-source", ".context/architecture/" + diagram.name + ".json"));
    };
    drawable.forEach(function (diagram) {
      var tab = S.el("button", "arch-tab", diagram.meta.title);
      tab.type = "button";
      tab.dataset.name = diagram.name;
      tab.addEventListener("click", function () { open(diagram); });
      tabs.appendChild(tab);
    });
    var wanted = location.hash.slice(1);
    open(drawable.filter(function (d) { return d.name === wanted; })[0] || drawable[0]);
  }

  S.onBuild = function () {
    var host = S.el("div", "arch-view");
    S.canvas.appendChild(host);
    document.title = window.BABUL_MODEL.product.name + " — Architecture";
    fetch("/_architecture.json")
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (diagrams) { show(host, diagrams); })
      .catch(function () { message(host, "Could not read the diagrams. Is canon ui still running?"); });
  };
})();
