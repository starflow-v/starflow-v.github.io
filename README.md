# Scalable Normalizing Flows — research portal

A static, Cambrian-style dark portal introducing the **Scalable Normalizing Flows** research
line (TARFlow → STARFlow → STARFlow-V → iTARFlow, NFM, STARFlow2, NTM, …). Each project is a
clickable card that opens its own full academic project page; STARFlow-V links out to its
existing site (https://starflow-v.github.io), and NF-CoT is a "coming soon" placeholder.

## How it works

All content lives in **`data/projects.json`** (single source of truth). A zero-dependency
Node script generates pure static HTML:

```
node scripts/build.mjs
```

This writes `index.html` and `projects/<id>/index.html` for every project (external-page
projects are skipped). Output is plain static files — host anywhere, e.g. GitHub Pages.

## Layout

```
web/
├── index.html              # generated portal page
├── data/projects.json      # ← edit this to add/update projects, then re-run build
├── scripts/build.mjs       # generator (no npm install needed)
├── assets/
│   ├── css/style.css        # dark portal theme
│   ├── css/project.css      # project detail page styles
│   ├── js/filter.js         # category filter on the portal
│   ├── js/project.js        # BibTeX copy button
│   └── img/projects/         # teaser images / videos
└── projects/<id>/index.html # generated project pages
```

## Editing

- **Add a project:** append an entry to `data/projects.json`, drop its teaser image in
  `assets/img/projects/`, then `node scripts/build.mjs`.
- **Featured row:** set `"featured": true`.
- **External page (no generated page):** set `"external": "https://..."`.
- **Placeholder:** set `"comingSoon": true`.

## Preview locally

```
cd web && python3 -m http.server 8000   # → http://localhost:8000
```

## Image editor (choose / upload tile images)

A local, zero-dependency editor for picking each project's tile image (and editing
text & order) without touching JSON by hand:

```
cd web && node scripts/admin.mjs        # → http://localhost:4173
```

In the editor you can, per project:
- **Upload / drop an image or mp4** to set its tile cover (saved as `<id>-cover.<ext>`).
- Switch a tile between its **uploaded image** and an **artistic block**.
- Edit name / venue / title / authors / links / abstract, toggle **hidden** / **in line**.
- Reorder the **importance** of the top block grid with ▲▼.

Click **Save & Rebuild** — it writes `data/projects.json` + images and regenerates the
site. Refresh your preview tab to see changes. (Run it in your own terminal; it binds to
`127.0.0.1` and is a local authoring tool only — don't expose it publicly.)

