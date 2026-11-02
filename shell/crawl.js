/* Reads the set from its HTML each time the shell opens. From design.js's start
 * page it follows every link and every component, loading each page and board
 * in a hidden frame with ?scan; the frame posts back its own markup (a page on
 * file:// cannot read another file, but a frame can describe itself).
 * describe.js turns what arrives into pages, links, journeys and components,
 * and model.js derives the rest. S.ready settles when the shell can draw.   */
(function () {
  var S = window.BABUL_SHELL, B = window.BABUL || {};
  if (!S || !window.BABUL_DESCRIBE) return;
  var TIMEOUT_MS = 8000;

  var c = BABUL_DESCRIBE.Collector(B.product || {}, B.tokens || {}, S.lucideVersion, S.size);
  var frames = [];
  window.addEventListener("message", function (e) {
    var hit = frames.filter(function (f) { return f.frame.contentWindow === e.source; })[0];
    if (hit && e.data && e.data.babulScan) hit.done(e.data.babulScan);
  });
  function scan(file) {
    return new Promise(function (done) {
      var frame = document.createElement("iframe");
      frame.hidden = true;
      frame.src = S.root + S.size + "/" + file + "?scan";
      var entry = { frame: frame, done: function (tree) {
        clearTimeout(timer);
        frame.remove();
        frames.splice(frames.indexOf(entry), 1);
        done(tree);
      } };
      var timer = setTimeout(function () { c.errors.push(file + " did not describe itself"); entry.done(null); }, TIMEOUT_MS);
      frames.push(entry);
      document.body.appendChild(frame);
    });
  }

  var seen = {};
  function follow(found) {
    return Promise.all(found.pages.map(page).concat(found.components.map(component)));
  }
  function page(id) {
    if (seen["page " + id]) return null;
    seen["page " + id] = true;
    return scan(id + ".html").then(function (tree) { return tree && follow(c.addPage(id, tree)); });
  }
  function component(id) {
    if (seen["component " + id]) return null;
    seen["component " + id] = true;
    return Promise.all([
      S.loadDefs([id]).then(function () {
        return S.defSource[id] ? follow(c.addDef(id, S.defSource[id])) : c.errors.push("components/" + id + ".html did not load");
      }),
      scan("components/" + id + ".html").then(function (tree) { return tree && follow(c.addBoard(id, tree)); }),
    ]);
  }

  /* The crawl loads every page in a frame, and every click in a page is a new document, so it would
     run again per click. The journey always reads fresh and stores the result; the other views reuse
     it for the tab's session. */
  var CACHE = "babul-crawl:" + S.root + S.size;
  var cached = null;
  try { if (S.view !== "journey") cached = JSON.parse(sessionStorage.getItem(CACHE)); } catch (e) {}

  S.ready = new Promise(function (done) {
    document.addEventListener("DOMContentLoaded", function () {
      Promise.resolve(cached ? null : page(BABUL_DESCRIBE.startOf(B.product || {}, S.size))).then(function () {
        var m = cached || c.finish();
        if (!cached) try { sessionStorage.setItem(CACHE, JSON.stringify(m)); } catch (e) {}
        m.errors.forEach(function (e) { console.warn("[crawl] " + e); });
        B.pages = m.pages;
        B.links = m.links;
        B.journeys = m.journeys;
        B.components = m.components;
        B.assets = m.assets;
        S.buildModel();
        done();
      });
    });
  });
})();
