#!/usr/bin/env node
// Zero-dependency static site generator for "Scalable Normalizing Flows".
// Reads data/projects.json and writes index.html + projects/<id>/index.html.
// Usage: node scripts/build.mjs   (run from the web/ dir or anywhere)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const data = JSON.parse(readFileSync(join(ROOT, "data", "projects.json"), "utf8"));
const { site, categories } = data;
// `hidden: true` projects are excluded from the block grid, timeline, and page generation.
const projects = data.projects.filter((p) => !p.hidden);

// ---------- helpers ----------
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const isVideo = (img) => img && img.toLowerCase().endsWith(".mp4");

// Recency key: arXiv ids encode YYMM in the first 4 digits and a submission
// sequence after the dot (e.g. 2605.08078). We fold both into one comparable
// number (YYMM + .sequence) so same-month papers order by submission too.
// No arXiv link (e.g. "coming soon") falls back to the year alone.
function recency(p) {
  const m = p.links && p.links.arxiv && p.links.arxiv.match(/abs\/(\d{2})(\d{2})\.(\d+)/);
  if (m) return Number(m[1]) * 100 + Number(m[2]) + Number("0." + m[3]);
  return ((p.year || 2000) - 2000) * 100;
}
const byNewest = (a, b) => recency(b) - recency(a);

// where a card/item points to: external page wins, else internal project page.
// Link to the explicit index.html so it also works when opened via file://
// (directory URLs aren't auto-resolved to index.html under file://).
const hrefOf = (p, prefix = "") =>
  p.external ? p.external : `${prefix}projects/${p.id}/index.html`;
const isExternal = (p) => !!p.external;

function media(p, imgBase, cls) {
  if (p.comingSoon || !p.image) {
    return `<div class="${cls} placeholder">${esc(p.name)}</div>`;
  }
  const src = `${imgBase}${p.image}`;
  const fit = p.fit === "contain" ? " fit-contain" : "";
  if (isVideo(p.image)) {
    return `<div class="${cls}${fit}"><video src="${src}" autoplay muted loop playsinline></video></div>`;
  }
  return `<div class="${cls}${fit}"><img src="${src}" alt="${esc(p.name)}" loading="lazy"></div>`;
}

// short one-liner for cards: first sentence of abstract, or venue
function blurb(p) {
  if (p.comingSoon) return "New work in this direction — coming soon.";
  const a = p.abstract || "";
  const dot = a.indexOf(". ");
  return dot > 0 ? a.slice(0, dot + 1) : (a || p.title);
}

// ---------- icons (inline SVG) ----------
const ICON = {
  arxiv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  blog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  page: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.2h3.7l-8 9.1L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9zM17.6 20.6h2L6.5 3.3H4.3z"/></svg>`,
  scholar: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L1 7l11 6 9-4.9V17h2V7zM4 13.2V17l8 4 8-4v-3.8l-8 4.4z"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
};

const LINK_LABEL = { arxiv: "arXiv", code: "Code", blog: "Blog", page: "Project Page" };
const LINK_ORDER = ["arxiv", "page", "blog", "code"];

// On-theme decorative background: smooth flowing curves (a "normalizing flow").
function flowBg() {
  const W = 1500, H = 760, N = 9, seg = 5, step = W / seg;
  let paths = "";
  for (let i = 0; i < N; i++) {
    const y = 60 + (i * (H - 120)) / (N - 1);
    const amp = 26 + (i % 3) * 16;
    let d = `M 0 ${y.toFixed(1)}`;
    for (let s = 0; s < seg; s++) {
      const x0 = s * step, x1 = (s + 1) * step;
      const cx1 = x0 + step * 0.4, cx2 = x0 + step * 0.6;
      const dir = (s + i) % 2 === 0 ? -1 : 1;
      d += ` C ${cx1.toFixed(1)} ${(y + dir * amp).toFixed(1)}, ${cx2.toFixed(1)} ${(y - dir * amp).toFixed(1)}, ${x1.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths += `<path d="${d}"/>`;
  }
  return `<div class="flow-bg" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice">
  <defs><linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#e0314f"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fbbf24"/>
  </linearGradient></defs>${paths}</svg></div>`;
}

// Compact flowing-curve SVG used as the artistic motif inside designed tiles.
function tileFlow() {
  const W = 480, H = 300, N = 7, seg = 4, step = W / seg;
  let paths = "";
  for (let i = 0; i < N; i++) {
    const y = 26 + (i * (H - 52)) / (N - 1);
    const amp = 16 + (i % 3) * 13;
    let d = `M 0 ${y.toFixed(1)}`;
    for (let s = 0; s < seg; s++) {
      const x0 = s * step, x1 = (s + 1) * step;
      const cx1 = x0 + step * 0.4, cx2 = x0 + step * 0.6;
      const dir = (s + i) % 2 === 0 ? -1 : 1;
      d += ` C ${cx1.toFixed(1)} ${(y + dir * amp).toFixed(1)}, ${cx2.toFixed(1)} ${(y - dir * amp).toFixed(1)}, ${x1.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths += `<path d="${d}"/>`;
  }
  return `<svg class="tile-flow" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${paths}</svg>`;
}

function linkButtons(p, { big } = {}) {
  const cls = big ? "btn" : "rlink";
  return LINK_ORDER.filter((k) => p.links && p.links[k])
    .map((k) => {
      const icon = big && ICON[k] ? ICON[k] : "";
      return `<a class="${cls}" href="${p.links[k]}" target="_blank" rel="noopener">${icon}${LINK_LABEL[k]}</a>`;
    })
    .join("");
}

function authorsHTML(s = "") {
  return esc(s).replace(/Jiatao Gu/g, '<span class="me">Jiatao Gu</span>');
}

// ---------- shared chrome ----------
function head(title, cssPrefix, extraCss = "") {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${cssPrefix}assets/css/style.css">${extraCss}
  <script>(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();</script>
</head>`;
}

// sun / moon icons for the theme toggle
const THEME_ICON = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
};

function themeToggle() {
  return `<button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light / dark theme">
      <span class="ic-sun">${THEME_ICON.sun}</span><span class="ic-moon">${THEME_ICON.moon}</span>
    </button>`;
}

function nav(prefix) {
  return `<nav class="nav"><div class="wrap">
    <a class="nav-brand" href="${prefix}index.html">Scalable Normalizing Flows<span class="dot">.</span></a>
    <div class="nav-right">
      <div class="nav-links">
        <a href="${prefix}index.html#projects">Projects</a>
        <a href="${prefix}index.html#idea">The Idea</a>
        <a href="${prefix}index.html#foundations">Foundations</a>
        <a href="${prefix}index.html#research">Timeline</a>
      </div>
      ${themeToggle()}
    </div>
  </div></nav>`;
}

function socials() {
  const a = site.author;
  const s = [];
  if (a.github) s.push(`<a href="${a.github}" target="_blank" rel="noopener" aria-label="GitHub">${ICON.github}</a>`);
  if (a.twitter) s.push(`<a href="${a.twitter}" target="_blank" rel="noopener" aria-label="X">${ICON.twitter}</a>`);
  if (a.scholar) s.push(`<a href="${a.scholar}" target="_blank" rel="noopener" aria-label="Scholar">${ICON.scholar}</a>`);
  if (a.homepage) s.push(`<a href="${a.homepage}" target="_blank" rel="noopener" aria-label="Homepage">${ICON.home}</a>`);
  return s.join("");
}

// ---------- portal page ----------
function buildIndex() {
  const imgBase = "assets/img/projects/";

  // Diagram/plot figures look cluttered cropped into dark tiles, so projects
  // flagged `styledTile` get an artistic procedural tile — a colored mesh
  // gradient + drifting "normalizing flow" curves + bold name — instead of the
  // raw figure. Sample-grid images stay full-bleed. (The full figure still
  // shows, uncropped, on the project's own page.)
  const MESH = [
    "--c1:rgba(224,49,79,.60);--c2:rgba(245,158,11,.55);--c3:rgba(124,58,10,.65)",
    "--c1:rgba(245,158,11,.58);--c2:rgba(251,191,36,.50);--c3:rgba(95,40,120,.65)",
    "--c1:rgba(90,205,215,.50);--c2:rgba(224,49,79,.55);--c3:rgba(28,75,120,.65)",
    "--c1:rgba(255,150,205,.50);--c2:rgba(245,158,11,.55);--c3:rgba(120,40,95,.65)",
    "--c1:rgba(125,150,255,.55);--c2:rgba(120,225,205,.45);--c3:rgba(48,55,135,.65)",
    "--c1:rgba(155,140,255,.55);--c2:rgba(255,175,150,.45);--c3:rgba(64,52,130,.65)",
  ];
  const tileMesh = (p) => {
    const i = projects.findIndex((x) => x.id === p.id);
    return MESH[((i % MESH.length) + MESH.length) % MESH.length];
  };
  const coverMedia = (p, cls) => {
    if (p.styledTile || p.comingSoon || !p.image) {
      const flow = cls === "media" ? tileFlow() : "";
      return `<div class="${cls} styled" style="${tileMesh(p)}">${flow}<span class="wm">${esc(p.name)}</span></div>`;
    }
    return media(p, imgBase, cls);
  };

  // TOP block grid: every project, ordered by importance (from site.importanceOrder),
  // with STARFlow2 leading and the largest tile. Collaborator-led work (iTARFlow,
  // NFM, TarFlowLM) and the placeholder fall to the small tiles at the back.
  const rank = (id) => {
    const i = (site.importanceOrder || []).indexOf(id);
    return i === -1 ? 999 : i;
  };
  // The block grid shows ONLY the user's own papers — community "related" work
  // and classical "foundation" work are excluded (they live in the timeline /
  // Foundations strip).
  const byImportance = [...projects]
    .filter((p) => !p.related && !p.foundation)
    .sort((a, b) => rank(a.id) - rank(b.id));

  // Varied size pattern, dynamic rhythm. Two lg(2×2) heroes lead; the rest
  // interleaves wide/tall/sm so the lower area reads as an organic mosaic
  // rather than a tidy row. Pattern adapts to the visible tile count.
  const PATTERNS = {
    10: ["lg", "lg", "wide", "tall", "sm", "tall", "sm", "wide", "sm", "sm"],
    9: ["lg", "lg", "wide", "tall", "sm", "wide", "sm", "sm", "sm"],
    8: ["lg", "tall", "wide", "sm", "sm", "wide", "sm", "sm"],
  };
  const pattern = PATTERNS[byImportance.length] ||
    byImportance.map((_, i) => (i === 0 ? "lg" : i <= 3 ? "wide" : "sm"));
  const tileAt = (i) => pattern[i] || "sm";

  const cards = byImportance
    .map((p, i) => {
      const ext = isExternal(p);
      const target = ext ? ` target="_blank" rel="noopener"` : "";
      const soon = p.comingSoon ? " coming-soon" : "";
      const tile = p.size || tileAt(i);
      const size = `size-${tile}`;
      const delay = ` reveal d${(i % 3) + 1}`;
      const badge = p.comingSoon
        ? `<span class="badge-soon">Soon</span>`
        : `<span class="venue-badge">${esc(p.venue)}</span>`;
      const go = ext
        ? `Visit project <span class="arrow">↗</span>`
        : `Read more <span class="arrow">→</span>`;
      const showTitle = true;
      const split = p.fit === "contain" ? " tile-split" : "";
      return `<a class="tile ${size}${soon}${split}${delay}" href="${hrefOf(p)}"${target}>
        ${coverMedia(p, "media")}
        <div class="t-top">${badge}</div>
        <div class="overlay">
          <div class="name-row"><span class="name">${esc(p.name)}</span></div>
          ${showTitle ? `<p class="ptitle">${esc(p.title)}</p>` : ""}
          <div class="go">${go}</div>
        </div>
      </a>`;
    })
    .join("\n");

  // "More to come" tile — closes the grid, signalling the program is ongoing.
  const moreTile = `<div class="tile size-sm tile-more reveal d2" aria-hidden="true">
        <div class="more-inner">
          <div class="more-plus">+</div>
          <div class="more-text">More to come</div>
          <div class="more-sub">New work in this direction</div>
        </div>
      </div>`;

  const filters = categories
    .map((c, i) => `<button class="filter-btn${i === 0 ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");

  // FOUNDATIONS lineage strip — classical normalizing-flow works (foundation:true),
  // shown as its own block between The Idea and the timeline (oldest → newest),
  // capped by the "Transformer turn" into TARFlow.
  const foundations = [...projects].filter((p) => p.foundation).sort((a, b) => recency(a) - recency(b));
  const foundationStrip = `<section id="foundations">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="kicker">Foundations</div>
      <h2>Standing on classical flows</h2>
      <p>The normalizing-flow lineage this program builds on — exact-likelihood models that stayed behind diffusion on sample quality, until the Transformer turn.</p>
    </div>
    <div class="lineage-row reveal">
      ${foundations
        .map((p) => {
          const yr = String(p.year);
          return `<a class="prior" href="${p.external}" target="_blank" rel="noopener"><div class="prior-top"><span class="prior-name">${esc(p.name)}</span><span class="prior-year">${esc(yr)}</span></div><div class="prior-auth">${esc(p.venue)}</div><p class="prior-desc">${esc(p.title)}</p></a>`;
        })
        .join("\n      ")}
      <a class="prior prior-turn" href="https://arxiv.org/abs/2412.06329" target="_blank" rel="noopener"><div class="prior-top"><span class="prior-name">TARFlow →</span><span class="prior-year">2025</span></div><div class="prior-auth">The Transformer turn</div><p class="prior-desc">Diffusion-level samples from a stand-alone flow — where the program begins.</p></a>
    </div>
  </div>
</section>`;

  // BOTTOM timeline list: strictly chronological (newest first). Own work plus
  // community "related" work (external, arXiv-only, tagged). Classical
  // "foundation" work lives in its own block above, not here.
  const ordered = [...projects].filter((p) => !p.foundation).sort(byNewest);
  const items = ordered
    .map((p) => {
      const ext = isExternal(p);
      const rel = !!p.related;
      const target = ext ? ` target="_blank" rel="noopener"` : "";

      // Related work has no teaser image — render a compact, thumb-less row with
      // a left accent bar instead of an empty placeholder thumbnail.
      if (rel) {
        return `<a class="ritem ritem-rel reveal" href="${hrefOf(p)}"${target} data-categories="${esc((p.categories || []).join(","))}">
        <div class="meta">
          <div class="rname">${esc(p.name)} <span class="related-badge">Related</span> <span class="venue-badge rel">${esc(p.venue)}</span></div>
          <div class="rtitle">${esc(p.title)}</div>
        </div>
        <div class="rlinks"><span class="rlink">arXiv ↗</span></div>
      </a>`;
      }

      const venue = p.comingSoon
        ? `<span class="badge-soon">Soon</span>`
        : `<span class="venue-badge">${esc(p.venue)}${p.award ? " · " + esc(p.award) : ""}</span>`;
      const links =
        linkButtons(p) +
        (p.comingSoon || isExternal(p)
          ? `<a class="rlink" href="${hrefOf(p)}"${target}>${ext ? "Project Page ↗" : "Details →"}</a>`
          : `<a class="rlink" href="${hrefOf(p)}">Details →</a>`);
      const thumb = coverMedia(p, "thumb");
      return `<div class="ritem reveal" data-categories="${esc((p.categories || []).join(","))}">
        ${thumb}
        <div class="meta">
          <div class="rname">${esc(p.name)} ${venue}</div>
          <div class="rtitle">${esc(p.title)}</div>
        </div>
        <div class="rlinks">${links}</div>
      </div>`;
    })
    .join("\n");

  const chain = [
    ["TARFlow", "The core architecture — a Transformer autoregressive flow that models images directly, with diffusion-level samples from a stand-alone flow."],
    ["STARFlow", "A deep–shallow design scales the flow in latent space to high-resolution, text-conditional image synthesis."],
    ["STARFlow-V", "Causal roll-out extends the flow to video — an end-to-end, likelihood-based world model."],
    ["STARFlow2", "One causal stream unifies the flow with a language model for multimodal understanding and generation."],
  ]
    .map(
      ([n, d], i) =>
        `<div class="flow-node reveal d${(i % 3) + 1}"><div class="fn-name">${n}</div><div class="fn-desc">${d}</div></div>`
    )
    .join("");

  // "The Idea" — teaches the core normalizing-flow concept (the x⇌z duality,
  // the three pillars, why now) before the chronological timeline.
  const ideaHTML = `<section id="idea" class="section-alt">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="kicker">The Idea</div>
      <h2>Normalizing flows that scale</h2>
      <p>One invertible network, one likelihood objective — a single backbone for images, video, language, and unified multimodality.</p>
    </div>
    <p class="idea-lead reveal">${site.lead}</p>

    <div class="idea-core reveal">
      <div class="nf-left">
        <div class="nf-tag">A normalizing flow in one idea</div>
        <div class="nf-eq">
          <span class="nf-var">x</span>
          <span class="nf-arrows"><span class="fa">f →</span><span class="fb">← f<sup>-1</sup></span></span>
          <span class="nf-var">z ~ 𝒩(0,&nbsp;I)</span>
        </div>
        <p class="nf-cap">A normalizing flow is a single <strong>invertible</strong> network <em>f</em> that maps data <em>x</em> to simple Gaussian noise <em>z</em> — and runs backward to map it home.</p>
        <div class="nf-dir">
          <div class="nf-d"><span class="nf-op">f<sup>-1</sup></span><div><b>Generate.</b> Draw a <em>z</em>, push it back through <em>f<sup>-1</sup></em> to a sample <em>x</em>.</div></div>
          <div class="nf-d"><span class="nf-op">f</span><div><b>Score.</b> Map <em>x</em> to <em>z</em> and read off its <em>exact</em> likelihood — the same network, one objective.</div></div>
        </div>
        <div class="nf-formula"><span>p(x) = p<sub>0</sub>(f(x))</span> <span class="nf-jac">·&nbsp;|det&nbsp;∂f/∂x|</span></div>
      </div>
      <div class="nf-right">
        <div class="pillar reveal d1"><div class="pillar-h">Exact likelihood</div><p>Trained by exact maximum likelihood — one clean objective. No ELBO, no noise schedule, no discretization.</p></div>
        <div class="pillar reveal d2"><div class="pillar-h">Invertible &amp; lossless</div><p>x&nbsp;↔&nbsp;z is exactly reversible — encoding and generation share the very same network and weights.</p></div>
        <div class="pillar reveal d3"><div class="pillar-h">Continuous, end-to-end</div><p>x stays in ℝ<sup>d</sup> throughout — no codebook, no quantization. The same machinery LLMs already run at scale.</p></div>
      </div>
    </div>

    <p class="idea-sub reveal">Normalizing flows were always there — RealNVP, Glow, MAF/IAF, Flow++ — and always kept exact likelihood, but lost ground to GANs and diffusion on sample quality. The <strong>Transformer revival</strong> changes the verdict: <strong>TARFlow</strong> gets diffusion-level samples from a stand-alone flow, and the work below scales that one backbone to new modalities.</p>

    <div class="why-now reveal">
      <div class="why-head">
        <div class="kicker">Why now</div>
        <h3>Same principle, three ingredients that finally make it scale</h3>
        <p>Classical flows leaned on hand-designed coupling layers — expressive enough for densities, but their samples stayed behind GANs and diffusion. The architecture, not the principle, was the bottleneck. Three ingredients close the gap:</p>
      </div>
      <div class="why-grid">
        <div class="why-card reveal d1">
          <div class="why-n">01</div>
          <div class="why-t">Deep–shallow Transformer flow</div>
          <p><b>Then:</b> shallow stacks of affine coupling / 1×1 convs — limited capacity, hard to scale.<br><b>Now:</b> one <em>deep</em> autoregressive Transformer block carries most of the capacity (acting like a language model over tokens), plus a few cheap <em>shallow</em> blocks with alternating scan direction for local detail — parallelizable in the inverse.</p>
        </div>
        <div class="why-card reveal d2">
          <div class="why-n">02</div>
          <div class="why-t">Noise-augmented training</div>
          <p><b>Then:</b> exact MLE on clean data overfits high-frequency detail and yields noisy samples.<br><b>Now:</b> Gaussian noise augmentation during training, paired with a small <em>post-hoc denoiser</em> at sampling — the same trick that lets the flow produce clean, sharp images while staying an exact-likelihood model.</p>
        </div>
        <div class="why-card reveal d3">
          <div class="why-n">03</div>
          <div class="why-t">Classifier-free guidance</div>
          <p><b>Then:</b> no quality/diversity knob — flows generated unconditionally from the prior.<br><b>Now:</b> guidance applied in the deep block (a new recipe for flows) trades diversity for fidelity, just like diffusion — pushing samples to diffusion-level quality from one MLE objective.</p>
        </div>
      </div>
    </div>

    <div class="flow-chain">${chain}</div>
  </div>
</section>`;

  const html = `<!doctype html>
<html lang="en">
${head(`${site.title} — ${site.tagline}`, "")}
<body>
${nav("")}

<header class="hero" id="top">
  ${flowBg()}
  <div class="wrap">
    <span class="eyebrow">${esc(site.tagline)}</span>
    <h1><span class="gradient-text">${esc(site.title)}</span></h1>
    <p class="tagline">${esc(site.subtitle)}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="#projects">Explore Projects</a>
      <a class="btn" href="#idea">The Idea</a>
    </div>
  </div>
</header>

<section id="projects">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="kicker">Projects</div>
      <h2>The TARFlow family</h2>
      <p>A connected line of work taking normalizing flows from a single architecture to a scalable, general-purpose generative paradigm. Tiles are sized by significance.</p>
    </div>
    <div class="bento">
${cards}
      ${moreTile}
    </div>
  </div>
</section>

${ideaHTML}

${foundationStrip}

<section id="research" class="section-alt">
  <div class="wrap">
    <div class="section-head reveal">
      <div class="kicker">Timeline</div>
      <h2>All work</h2>
      <p>Every paper in the program, newest first. Switch to <strong>Related</strong> to see work from the wider community.</p>
    </div>
    <div class="filter-bar reveal">${filters}</div>
    <div class="research-list">
${items}
    </div>
  </div>
</section>

<footer class="site-foot">
  <div class="wrap">
    <div class="foot-social">${socials()}</div>
    <div>© ${new Date().getFullYear()} Scalable Normalizing Flows</div>
  </div>
</footer>

<script src="assets/js/filter.js"></script>
<script src="assets/js/reveal.js"></script>
<script src="assets/js/theme.js"></script>
</body>
</html>`;

  writeFileSync(join(ROOT, "index.html"), html);
  return 1;
}

// ---------- project detail pages ----------
function buildProject(p) {
  // STARFlow-V has an external page — don't generate one.
  if (isExternal(p)) return 0;

  const prefix = "../../";
  const imgBase = `${prefix}assets/img/projects/`;
  const extraCss = `\n  <link rel="stylesheet" href="${prefix}assets/css/project.css">`;

  let body;
  if (p.comingSoon) {
    body = `<header class="proj-hero">
  <div class="wrap">
    <a class="back-link" href="${prefix}index.html">← Back to all projects</a>
    <div class="coming-wrap">
      <div class="proj-venue"><span class="badge-soon">Coming Soon</span></div>
      <div class="big"><span class="gradient-text">${esc(p.name)}</span></div>
      <p>${esc(p.title)}. This project is part of the Scalable Normalizing Flows research line — details and paper will appear here soon.</p>
    </div>
  </div>
</header>`;
  } else {
    const figure = p.image
      ? `<div class="proj-media wrap">${
          isVideo(p.image)
            ? `<video src="${imgBase}${p.image}" autoplay muted loop playsinline></video>`
            : `<img src="${imgBase}${p.image}" alt="${esc(p.name)} method figure">`
        }</div>`
      : "";

    const tldr = p.tldr
      ? `<section class="sec" id="tldr">
    <h3>TL;DR</h3>
    <div class="tldr-box">${esc(p.tldr)}</div>
  </section>`
      : "";

    const overview = p.overview
      ? `<section class="sec" id="overview">
    <h3>Overview</h3>
    ${p.overview.split("\n\n").map((para) => `<p class="proj-prose">${esc(para)}</p>`).join("\n    ")}
  </section>`
      : "";

    const method = p.image
      ? `<section class="sec" id="method">
    <h3>Method</h3>
    ${figure}
    <p class="fig-caption">Overview figure from the paper — see the linked paper for full details.</p>
  </section>`
      : "";

    const contribs = (p.contributions && p.contributions.length)
      ? `<section class="sec" id="contributions">
    <h3>Key Contributions</h3>
    <div class="contrib-grid">
      ${p.contributions
        .map((c, i) => `<div class="contrib-card"><div class="contrib-num">${i + 1}</div><p>${esc(c)}</p></div>`)
        .join("\n      ")}
    </div>
  </section>`
      : "";

    const bib = p.bibtex
      ? `<section class="sec" id="bibtex">
    <h3>BibTeX</h3>
    <div class="bibtex-box">
      <button class="copy-btn">Copy</button>
      <pre>${esc(p.bibtex)}</pre>
    </div>
  </section>`
      : "";

    const gallery = (p.gallery && p.gallery.length)
      ? `<section class="sec" id="gallery">
    <h3>Highlights</h3>
    <div class="gallery-grid">
      ${p.gallery
        .map((g) => `<a class="gallery-item" href="${imgBase}${g}" data-lightbox><img src="${imgBase}${g}" alt="${esc(p.name)} highlight" loading="lazy"></a>`)
        .join("\n      ")}
    </div>
  </section>`
      : "";

    // Thread walkthrough: lay the page out like the X thread — each tweet's text
    // followed by its image(s). When present, this replaces overview/method/
    // contributions/gallery so the narrative drives the page.
    const useThread = p.thread && p.thread.length;
    const threadHTML = useThread
      ? `<section class="sec" id="walkthrough">
    <h3>How it works</h3>
    <div class="thread">
      ${p.thread
        .map((t) => {
          const imgs = (t.images || [])
            .map((src) => `<a class="tw-shot" href="${imgBase}${src}" data-lightbox><img src="${imgBase}${src}" alt="" loading="lazy"></a>`)
            .join("");
          const media = imgs
            ? `<div class="tw-media n${t.images.length}">${imgs}</div>`
            : "";
          return `<div class="tw">
        <p class="tw-text">${esc(t.text)}</p>
        ${media}
      </div>`;
        })
        .join("\n      ")}
    </div>
  </section>`
      : "";

    // in-page section nav (only links to sections that exist)
    const navItems = useThread
      ? [
          tldr && ["tldr", "TL;DR"],
          ["abstract", "Abstract"],
          ["walkthrough", "How it works"],
          bib && ["bibtex", "BibTeX"],
        ].filter(Boolean)
      : [
          tldr && ["tldr", "TL;DR"],
          overview && ["overview", "Overview"],
          ["abstract", "Abstract"],
          method && ["method", "Method"],
          contribs && ["contributions", "Contributions"],
          gallery && ["gallery", "Highlights"],
          bib && ["bibtex", "BibTeX"],
        ].filter(Boolean);
    const secNav = `<nav class="sec-nav">${navItems
      .map(([id, label]) => `<a href="#${id}">${label}</a>`)
      .join("")}</nav>`;

    const mainSections = useThread
      ? `<section class="sec" id="abstract">
    <h3>Abstract</h3>
    <p class="proj-abstract">${esc(p.abstract)}</p>
  </section>
  ${threadHTML}
  ${bib}`
      : `${overview}
  <section class="sec" id="abstract">
    <h3>Abstract</h3>
    <p class="proj-abstract">${esc(p.abstract)}</p>
  </section>
  ${method}
  ${contribs}
  ${gallery}
  ${bib}`;

    body = `<header class="proj-hero">
  <div class="wrap">
    <a class="back-link" href="${prefix}index.html">← Back to all projects</a>
    <h1 class="proj-name"><span class="gradient-text">${esc(p.name)}</span></h1>
    <p class="proj-fulltitle">${esc(p.title)}</p>
    <div class="proj-venue">
      <span class="venue-pill">${esc(p.venue)}</span>
      ${p.award ? `<span class="award-pill">${esc(p.award)}</span>` : ""}
    </div>
    <p class="proj-authors">${authorsHTML(p.authors)}</p>
    <div class="link-row">${linkButtons(p, { big: true })}</div>
  </div>
</header>

${secNav}

<div class="proj-body wrap">
  ${tldr}
  ${mainSections}
</div>`;
  }

  const html = `<!doctype html>
<html lang="en">
${head(`${p.name} — Scalable Normalizing Flows`, prefix, extraCss)}
<body>
${nav(prefix)}
${body}
<div class="lightbox" id="lightbox"><button class="lb-close" aria-label="Close">×</button><img src="" alt=""></div>
<footer class="site-foot">
  <div class="wrap">© ${new Date().getFullYear()} ${esc(site.author.name)} · <a href="${prefix}index.html">Scalable Normalizing Flows</a></div>
</footer>
<script src="${prefix}assets/js/project.js"></script>
<script src="${prefix}assets/js/theme.js"></script>
</body>
</html>`;

  const dir = join(ROOT, "projects", p.id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  return 1;
}

// ---------- run ----------
buildIndex();
let n = 0;
for (const p of projects) n += buildProject(p);
console.log(`✓ Built index.html + ${n} project pages (${projects.length} projects total).`);
console.log(`  Skipped (external page): ${projects.filter(isExternal).map((p) => p.name).join(", ") || "none"}`);
