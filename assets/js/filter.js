// Category filter for the "Discover the Research" list on the portal page.
(function () {
  const buttons = document.querySelectorAll(".filter-btn");
  const items = document.querySelectorAll(".ritem");
  if (!buttons.length) return;

  function apply(cat) {
    items.forEach((it) => {
      const cats = (it.dataset.categories || "").split(",");
      // "All" shows the user's own work only — community "Related" work appears
      // exclusively under its own tab.
      const show = cat === "All" ? !cats.includes("Related") : cats.includes(cat);
      it.classList.toggle("hidden", !show);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      apply(btn.dataset.cat);
    });
  });

  // Apply the active filter on load (so "All" hides Related from the start).
  const active = document.querySelector(".filter-btn.active");
  apply(active ? active.dataset.cat : "All");
})();
