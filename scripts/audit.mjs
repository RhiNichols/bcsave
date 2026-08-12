/**
 * Whole-site bug sweep.
 *
 * Walks every page at four widths and reports horizontal overflow, elements
 * past the viewport, missing alt text, sub-24px tap targets, heading-level
 * skips, console errors, failed requests, and broken internal links/anchors.
 *
 * Lives in the repo on purpose — an earlier version sat in a temp directory
 * and was lost on the first reboot.
 *
 *   npm run audit          # key pages + a six-dog sample
 *   npm run audit -- --all # every dog page too (slower, catches more)
 *
 * Needs the dev server running: npm run dev -- --host
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.env.AUDIT_BASE ?? "http://localhost:4321";

// Chrome, wherever it happens to live on this machine.
const CHROME =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH to the browser binary.");
  process.exit(1);
}

const dogs = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/dogs.json"), "utf8")
);

const ALL = process.argv.includes("--all");
const dogSlugs = (ALL ? dogs : dogs.slice(0, 6)).map((d) => d.slug);

const urls = [
  "/", "/dogs", "/alumni", "/about", "/faqs", "/lostdog", "/guide",
  "/donate", "/404",
  ...dogSlugs.map((s) => `/dogs/${s}`),
];

const widths = [
  { name: "320", w: 320, h: 700, mobile: true },
  { name: "390", w: 390, h: 844, mobile: true },
  { name: "768", w: 768, h: 1024, mobile: true },
  { name: "1440", w: 1440, h: 900, mobile: false },
];

const issues = [];
const add = (page, width, kind, detail) => issues.push({ page, width, kind, detail });

process.on("unhandledRejection", (e) => console.log("UNHANDLED:", String(e).slice(0, 140)));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
});

const seenLinks = new Map();

for (const url of urls) {
  for (const vp of widths) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.setViewport({
      width: vp.w,
      height: vp.h,
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });

    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + e.message.slice(0, 200)));

    const failed = [];
    page.on("requestfailed", (r) => failed.push(r.url().slice(0, 120)));

    try {
      const res = await page.goto(BASE + url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      // /404 is *supposed* to answer 404 — that is the page doing its job.
      if ((!res || res.status() >= 400) && url !== "/404")
        add(url, vp.name, "http", `status ${res?.status()}`);
    } catch (err) {
      add(url, vp.name, "load", err.message.slice(0, 120));
      await page.close().catch(() => {});
      continue;
    }

    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: vw,
        overflow: [], imgsNoAlt: [], smallTargets: [], headings: [],
        emptyLinks: [], links: [], brokenImgs: [],
      };

      // Content inside a deliberate horizontal scroller extends past the
      // viewport by design; only flag what actually widens the page.
      const inScroller = (el) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const o = getComputedStyle(n).overflowX;
          if (o === "auto" || o === "scroll") return true;
        }
        return false;
      };

      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.left < -500 || r.right > vw + 4000) continue; // skip-link etc
        if (r.right > vw + 1 && !inScroller(el))
          out.overflow.push(
            `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)}`
          );
      }

      for (const img of document.querySelectorAll("img")) {
        if (img.alt === null || img.alt === undefined) out.imgsNoAlt.push(img.src.slice(-60));
        if (img.complete && img.naturalWidth === 0) out.brokenImgs.push(img.src.slice(-70));
      }

      for (const el of document.querySelectorAll("a, button")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).position === "absolute" && r.left < 0) continue;
        // WCAG 2.5.8 exempts links inline within a sentence — the prose sets
        // their size, not us.
        const inProse =
          el.tagName === "A" &&
          ["P", "LI", "DD", "SPAN"].includes(el.parentElement?.tagName ?? "");
        if (!inProse && (r.height < 24 || r.width < 24))
          out.smallTargets.push(
            `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 25)}" ${Math.round(r.width)}x${Math.round(r.height)}`
          );
        if (!((el.textContent || "").trim() || el.getAttribute("aria-label")))
          out.emptyLinks.push(el.outerHTML.slice(0, 90));
      }

      for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        out.headings.push(+h.tagName[1]);

      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (href && !href.startsWith("mailto:")) out.links.push(href);
      }

      return out;
    });

    if (report.scrollWidth > report.clientWidth + 1)
      add(url, vp.name, "h-scroll", `scrollWidth ${report.scrollWidth} > ${report.clientWidth}`);
    for (const o of report.overflow.slice(0, 4)) add(url, vp.name, "overflow", o);
    for (const i of report.imgsNoAlt) add(url, vp.name, "img-no-alt", i);
    for (const i of report.brokenImgs) add(url, vp.name, "img-broken", i);
    for (const t of [...new Set(report.smallTargets)].slice(0, 4))
      add(url, vp.name, "small-target", t);
    for (const e of report.emptyLinks.slice(0, 3)) add(url, vp.name, "no-label", e);
    // The browser logs a console error for the 404 page's own 404 status.
    if (url !== "/404")
      for (const e of consoleErrors.slice(0, 3)) add(url, vp.name, "console", e);
    for (const f of failed.slice(0, 3)) add(url, vp.name, "req-failed", f);

    const hs = report.headings;
    if (hs.length && hs[0] !== 1) add(url, vp.name, "heading", `starts at h${hs[0]}, not h1`);
    for (let i = 1; i < hs.length; i++)
      if (hs[i] - hs[i - 1] > 1)
        add(url, vp.name, "heading", `h${hs[i - 1]} jumps to h${hs[i]}`);

    if (vp.name === "1440") for (const l of report.links) seenLinks.set(l, url);

    await page.close().catch(() => {});
  }
}

// Every internal link and anchor must resolve.
const checker = await browser.newPage();
checker.setDefaultNavigationTimeout(20000);

for (const [href, from] of seenLinks) {
  if (!href.startsWith("/") && !href.startsWith("#")) continue;
  const [rawPath, hash] = href.split("#");
  const target = rawPath || (href.startsWith("#") ? from : "/");
  try {
    const res = await checker.goto(BASE + target, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    if (!res || res.status() >= 400) {
      add(from, "-", "broken-link", `${href} -> ${res?.status() ?? "failed"}`);
      continue;
    }
    // A hash-only jump fires no navigation event, so check the id exists.
    if (hash) {
      const ok = await checker.evaluate((h) => !!document.getElementById(h), hash);
      if (!ok) add(from, "-", "broken-anchor", `${href} — no id="${hash}"`);
    }
  } catch {
    add(from, "-", "broken-link", `${href} -> timeout`);
  }
}

await checker.close().catch(() => {});
await browser.close();

const byKind = {};
for (const i of issues) (byKind[i.kind] ??= []).push(i);

console.log(`\n=== AUDIT: ${urls.length} pages x ${widths.length} widths ===`);
if (!issues.length) {
  console.log("\nClean — no issues found.\n");
} else {
  for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n## ${kind} (${list.length})`);
    const shown = new Set();
    for (const i of list) {
      const key = i.kind + i.detail;
      if (shown.has(key)) continue;
      shown.add(key);
      console.log(`  [${i.width}] ${i.page}: ${i.detail}`);
      if (shown.size >= 12) {
        console.log(`  … and ${list.length - shown.size} more`);
        break;
      }
    }
  }
  console.log();
}

const external = [...seenLinks.keys()].filter((l) => l.startsWith("http"));
console.log(`external links referenced (${external.length}):`);
for (const l of external) console.log("  " + l);

process.exit(issues.length ? 1 : 0);
