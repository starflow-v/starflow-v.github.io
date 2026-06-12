// Light / dark theme toggle. The initial theme is applied by an inline script
// in <head> (to avoid a flash); this just handles the button + persistence.
(function () {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const root = document.documentElement;
  const set = (theme) => {
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try { localStorage.setItem("theme", theme); } catch (e) {}
  };
  btn.addEventListener("click", () => {
    const isLight = root.getAttribute("data-theme") === "light";
    set(isLight ? "dark" : "light");
  });
})();
