/* The shell's entry. A design set does not hold the shell: each page loads the
 * loader, shell.js —
 *
 *     <script src="../../shell.js"></script>                            a page
 *     <script src="../../shell.js" data-view="components"></script>     a component
 *     <script src="../../shell.js" data-view="styles"></script>         a styles page
 *     <script src="../shell.js" data-view="journey"></script>           the journey
 *
 * It writes the rest in, in order, while the head is still parsing: the set's
 * data, the theme, Tailwind, lucide, the stylesheets, then the shell. A page
 * names nothing else, so a new data file or a library bump is one edit here
 * rather than one in every screen.
 *
 * Everything else the shell knows it reads from the HTML at runtime (crawl.js).
 *
 * Plain <script> tags, not fetch: the set opens straight from disk, and a
 * browser refuses fetch on file://. That is also why every data file is JSON
 * behind one assignment rather than a .json file.                            */
(function () {
  var me = document.currentScript;
  var shell = me.src.replace(/boot\.js(\?.*)?$/, "");
  var root = me.getAttribute("data-root");
  var size = location.href.slice(root.length).split("/")[0];
  var view = me.getAttribute("data-view") || "";

  var CDN = {
    tailwind: "https://cdn.tailwindcss.com/3.4.17",
    lucide: "https://unpkg.com/lucide@0.544.0/dist/umd/lucide.js",
    react: "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
    reactDom: "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
    /* React Flow v11, not v12: v12's UMD build expects react/jsx-runtime as a
       global, which React's own UMD build does not provide. */
    reactFlow: "https://unpkg.com/reactflow@11.11.4/dist/umd/index.js",
    reactFlowCss: "https://unpkg.com/reactflow@11.11.4/dist/style.css",
  };
  var DATA = ["design", "tokens"];
  var flag = function (name) { return new RegExp("[?&]" + name + "\\b").test(location.search); };

  window.BABUL_SHELL = {
    root: root, size: size, view: view, bare: flag("bare"),
    /* Only canon ui serves the shell from here, and only it can read the repo beyond the set. */
    served: /\/_shell\/$/.test(shell),
    lucideVersion: (/lucide@([\d.]+)/.exec(CDN.lucide) || [])[1],
  };

  var out = [];
  var script = function (src) { out.push('<script src="' + src + '"></' + "script>"); };
  var style = function (href) { out.push('<link rel="stylesheet" href="' + href + '" />'); };

  /* ?scan: the page only describes itself to the shell that framed it (crawl.js). */
  if (flag("scan")) {
    script(shell + "describe.js");
    out.push("<script>document.addEventListener('DOMContentLoaded', function () { parent.postMessage({ babulScan: BABUL_DESCRIBE.fromDom(document) }, '*'); });</" + "script>");
    return document.write(out.join("\n"));
  }

  /* ?def: a board only hands its definition to the page that uses it (expand.js). */
  if (flag("def")) {
    out.push("<script>document.addEventListener('DOMContentLoaded', function () { parent.postMessage({ babulDef: [].map.call(document.head.querySelectorAll('template'), function (t) { return t.outerHTML; }).join('\\n') }, '*'); });</" + "script>");
    return document.write(out.join("\n"));
  }

  DATA.forEach(function (name) { script(root + name + ".js"); });
  script(shell + "expand.js");
  script(CDN.tailwind);
  script(shell + "theme.js");
  script(CDN.lucide);
  style(shell + "shell.css");
  style(root + size + "/styles.css");
  if (view === "journey") {
    script(CDN.react);
    script(CDN.reactDom);
    script(CDN.reactFlow);
    style(CDN.reactFlowCss);
  }
  if (!flag("bare")) {
    script(shell + "describe.js");
    script(shell + "model.js");
    script(shell + "crawl.js");
    script(shell + "shell.js");
    if (view) script(shell + "view-" + view + ".js");
  } else {
    script(shell + "shell.js");
  }

  document.write(out.join("\n"));
})();
