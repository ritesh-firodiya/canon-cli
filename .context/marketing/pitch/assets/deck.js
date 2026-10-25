(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const bar = document.getElementById("bar");
  const counter = document.getElementById("counter");
  const fromHash = () => Math.min(Math.max(parseInt(location.hash.slice(1), 10) || 1, 1), slides.length) - 1;
  let current = fromHash();

  function show(index) {
    current = Math.min(Math.max(index, 0), slides.length - 1);
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === current);
      slide.classList.toggle("prev", i < current);
      slide.setAttribute("aria-hidden", i === current ? "false" : "true");
    });
    bar.style.width = `${((current + 1) / slides.length) * 100}%`;
    counter.textContent = `${current + 1} / ${slides.length}`;
    if (location.hash !== `#${current + 1}`) history.replaceState(null, "", `#${current + 1}`);
  }

  document.addEventListener("keydown", (event) => {
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) { event.preventDefault(); show(current + 1); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); show(current - 1); }
    else if (event.key === "Home") show(0);
    else if (event.key === "End") show(slides.length - 1);
    else if (event.key.toLowerCase() === "f") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });
  document.getElementById("prevBtn").addEventListener("click", () => show(current - 1));
  document.getElementById("nextBtn").addEventListener("click", () => show(current + 1));

  let touchX = null;
  document.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  window.addEventListener("hashchange", () => show(fromHash()));
  show(current);
})();
