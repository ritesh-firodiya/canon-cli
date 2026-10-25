(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const bar = document.getElementById("bar");
  const counter = document.getElementById("counter");
  const hint = document.querySelector(".hint");
  const baseTitle = document.title;
  const fromHash = () => Math.min(Math.max(parseInt(location.hash.slice(1), 10) || 1, 1), slides.length) - 1;
  let current = fromHash();

  // Toolbar: prev · counter · next · all slides · full screen.
  const toolbar = document.createElement("nav");
  toolbar.className = "toolbar";
  toolbar.setAttribute("aria-label", "Slide controls");
  const button = (label, text, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  };
  toolbar.append(
    button("Previous slide (←)", "‹", () => show(current - 1)),
    counter,
    button("Next slide (→)", "›", () => show(current + 1)),
    button("All slides (G)", "▦", () => toggleOverview()),
    button("Full screen (F)", "⤢", () => toggleFullscreen()),
  );
  document.body.append(toolbar);

  function show(index) {
    current = Math.min(Math.max(index, 0), slides.length - 1);
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === current);
      slide.classList.toggle("prev", i < current);
      slide.setAttribute("aria-hidden", i === current || overview() ? "false" : "true");
    });
    bar.style.width = `${((current + 1) / slides.length) * 100}%`;
    counter.textContent = `${current + 1} / ${slides.length}`;
    document.title = `${slides[current].getAttribute("aria-label")} · ${baseTitle}`;
    if (location.hash !== `#${current + 1}`) history.replaceState(null, "", `#${current + 1}`);
  }

  const overview = () => document.body.classList.contains("overview");
  function toggleOverview(force) {
    const on = force ?? !overview();
    document.body.classList.toggle("overview", on);
    slides.forEach((slide, i) => slide.setAttribute("aria-hidden", on || i === current ? "false" : "true"));
    if (on) slides[current].scrollIntoView({ block: "center" });
    else window.scrollTo(0, 0);
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
  slides.forEach((slide, i) =>
    slide.addEventListener("click", () => {
      if (!overview()) return;
      show(i);
      toggleOverview(false);
    }),
  );

  // The key hint goes away once someone has moved a slide.
  let hinted = false;
  const dismissHint = () => {
    if (hinted || !hint) return;
    hinted = true;
    hint.classList.add("gone");
  };

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key.toLowerCase() === "g" || key.toLowerCase() === "o") return toggleOverview();
    if (key === "Escape" && overview()) return toggleOverview(false);
    if (key.toLowerCase() === "f") return toggleFullscreen();
    if (overview()) return;
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(key)) { event.preventDefault(); show(current + 1); dismissHint(); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(key)) { event.preventDefault(); show(current - 1); dismissHint(); }
    else if (key === "Home") show(0);
    else if (key === "End") show(slides.length - 1);
  });
  document.getElementById("prevBtn").addEventListener("click", () => { show(current - 1); dismissHint(); });
  document.getElementById("nextBtn").addEventListener("click", () => { show(current + 1); dismissHint(); });

  let touchX = null;
  document.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX === null || overview()) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { show(current + (dx < 0 ? 1 : -1)); dismissHint(); }
    touchX = null;
  });
  window.addEventListener("hashchange", () => show(fromHash()));
  show(current);
})();
