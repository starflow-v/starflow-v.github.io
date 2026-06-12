#!/usr/bin/env node
// Local editor server (zero dependencies). Run: node scripts/admin.mjs
// Opens an editor at http://localhost:4173 where you can upload/replace tile
// images, toggle image-vs-artistic, edit text, reorder, and Save — which writes
// data/projects.json + uploaded images, then rebuilds the static site.
//
// This is a LOCAL authoring tool only; do not expose it publicly.

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, ".."); // web/
const DATA = join(ROOT, "data", "projects.json");
const IMG = join(ROOT, "assets", "img", "projects");
const PORT = 4173;

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function runBuild() {
  return new Promise((resolve) => {
    const ps = spawn(process.execPath, [join(__dirname, "build.mjs")], { cwd: ROOT });
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.stderr.on("data", (d) => (out += d));
    ps.on("close", () => resolve(out.trim()));
  });
}

const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const p = decodeURIComponent(u.pathname);

    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return send(res, 200, await readFile(join(__dirname, "admin.html")), "text/html");
    }
    if (req.method === "GET" && p === "/data/projects.json") {
      return send(res, 200, await readFile(DATA), "application/json");
    }
    // serve site assets / built pages for live preview
    if (req.method === "GET" && (p.startsWith("/assets/") || p.startsWith("/projects/") || p === "/favicon.ico")) {
      const f = join(ROOT, p);
      if (existsSync(f)) return send(res, 200, await readFile(f), MIME[extname(f).toLowerCase()] || "application/octet-stream");
      return send(res, 404, "not found", "text/plain");
    }
    if (req.method === "POST" && p === "/api/upload") {
      const { id, ext, dataUrl } = JSON.parse((await readBody(req)).toString());
      const b64 = String(dataUrl).split(",")[1] || "";
      const safeId = String(id).replace(/[^a-z0-9-]/gi, "");
      const safeExt = String(ext || "png").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const filename = `${safeId}-cover.${safeExt}`;
      await writeFile(join(IMG, filename), Buffer.from(b64, "base64"));
      return send(res, 200, JSON.stringify({ filename }));
    }
    if (req.method === "POST" && p === "/api/save") {
      const { projects, importanceOrder } = JSON.parse((await readBody(req)).toString());
      const data = JSON.parse(await readFile(DATA, "utf8"));
      if (Array.isArray(projects)) data.projects = projects;
      if (Array.isArray(importanceOrder)) data.site.importanceOrder = importanceOrder;
      await writeFile(DATA, JSON.stringify(data, null, 2) + "\n");
      const output = await runBuild();
      return send(res, 200, JSON.stringify({ ok: true, output }));
    }
    return send(res, 404, "not found", "text/plain");
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: String((e && e.stack) || e) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  ✎  Project editor running →  http://localhost:${PORT}`);
  console.log(`     Upload images, edit content & order, then Save (rebuilds the site).`);
  console.log(`     Ctrl+C to stop.\n`);
});
