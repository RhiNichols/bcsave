/**
 * Refuse to publish a build whose pages point at missing files.
 *
 *   node scripts/check-dist.mjs [distDir]
 *
 * Why this exists: photos are not in git. CI carries them between runs in the
 * Actions cache and tops them up from ShelterManager. If the cache has been
 * evicted AND ShelterManager is unreachable in the same run, the build falls
 * back to the committed dogs.json with no photos behind it, and would happily
 * deploy a site full of broken images over a working one. Failing here stops
 * the deploy, so the last good deployment stays live.
 *
 * Checks every same-site src, srcset and href in the built HTML (images,
 * scripts, stylesheets, pages) against the files in dist. External URLs,
 * mailto: and #anchors are ignored. The base path (e.g. /bcsave) is read from
 * BASE_PATH, the same variable the build uses.
 */
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve(process.argv[2] ?? "dist");
const base = (process.env.BASE_PATH || "/").replace(/\/*$/, "/");

const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) htmlFiles.push(p);
  }
})(dist);

/** Resolve a site path to the file GitHub Pages would serve for it, or null. */
function served(urlPath) {
  let p = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  if (!p.startsWith(base)) return null; // outside this site: not ours to check
  p = p.slice(base.length);
  const f = path.join(dist, p);
  if (!f.startsWith(dist)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  const index = path.join(f, "index.html");
  return fs.existsSync(index) ? index : false;
}

const missing = new Map(); // path -> first page that referenced it
let checked = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const refs = [];
  for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) refs.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(",")) refs.push(part.trim().split(/\s+/)[0]);
  }
  for (const raw of refs) {
    const ref = raw.replace(/&amp;/g, "&");
    if (!ref.startsWith("/") || ref.startsWith("//")) continue;
    // The 404 page is reached by addresses that do not exist; that is its job.
    const result = served(ref);
    if (result === null) continue;
    checked++;
    if (result === false && !missing.has(ref)) missing.set(ref, path.relative(dist, file));
  }
}

if (missing.size) {
  console.error(`check-dist: ${missing.size} referenced file(s) missing from ${dist}:`);
  for (const [ref, page] of [...missing].slice(0, 25)) console.error(`  ${ref}  (from ${page})`);
  if (missing.size > 25) console.error(`  …and ${missing.size - 25} more`);
  console.error("Not publishing: the last good deployment stays live.");
  process.exit(1);
}
console.log(`check-dist: ${checked} references across ${htmlFiles.length} pages, all present.`);
