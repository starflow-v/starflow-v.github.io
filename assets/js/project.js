// BibTeX copy-to-clipboard for project detail pages.
(function () {
  const btn = document.querySelector(".copy-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const pre = document.querySelector(".bibtex-box pre");
    if (!pre) return;
    try {
      await navigator.clipboard.writeText(pre.innerText);
    } catch (e) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pre);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("copy");
      sel.removeAllRanges();
    }
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1800);
  });
})();

// Lightbox for the Highlights gallery.
(function () {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  const img = lb.querySelector("img");
  const open = (src) => { img.src = src; lb.classList.add("open"); };
  const close = () => { lb.classList.remove("open"); img.src = ""; };
  document.querySelectorAll("[data-lightbox]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); open(a.getAttribute("href")); })
  );
  lb.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

