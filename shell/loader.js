/* A design set's one link to its shell. The set holds no copy: `canon ui` serves
 * this with SHELL pointed at its own shell, and a site that publishes sets
 * writes it with SHELL pointed at the shell it hosts. */
(function () {
  var SHELL = "{shell}";
  var me = document.currentScript, view = me.getAttribute("data-view");
  document.write('<script src="' + SHELL + 'boot.js" data-root="' + me.src.replace(/shell\.js(\?.*)?$/, "") + '"' +
    (view ? ' data-view="' + view + '"' : "") + "></" + "script>");
})();
