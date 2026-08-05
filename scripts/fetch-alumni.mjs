/**
 * Build the alumni list — dogs BCSAVE has already placed — from ShelterManager.
 *
 * The feed carries no adoption date, but `&days=N` filters to dogs adopted in
 * the last N days. Requesting the day-count that lands on each month boundary
 * and diffing consecutive sets gives every dog an exact adoption *month*
 * without any date field existing.
 *
 * The feed caps at 180 records however far back you ask, so this is "recent
 * alumni", not an all-time history. The all-time number has to come from the
 * rescue's own records.
 *
 *   node scripts/fetch-alumni.mjs [--force-images] [--months=24]
 */
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseFeed, idsIn, fetchPhoto, pool, UA } from "./lib/asm.mjs";

const ACCOUNT = "jb3344";
const BASE = `https://service.sheltermanager.com/asmservice?account=${ACCOUNT}&method=html_adopted_animals`;

const ROOT = path.resolve(import.meta.dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "alumni");
const DATA = path.join(ROOT, "src", "data", "alumni.json");

const FORCE = process.argv.includes("--force-images");
const MONTHS = Number(
  process.argv.find((a) => a.startsWith("--months="))?.split("=")[1] ?? 24
);

const DAY = 86400000;

async function getFeed(days) {
  const res = await fetch(`${BASE}&days=${days}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`feed returned ${res.status} for days=${days}`);
  return res.text();
}

async function main() {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // One threshold per month boundary, newest first.
  const bounds = [];
  for (let k = 0; k <= MONTHS; k++) {
    const d = new Date(today);
    d.setUTCMonth(d.getUTCMonth() - k, 1);
    d.setUTCHours(0, 0, 0, 0);
    bounds.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      days: Math.max(1, Math.round((today - d.getTime()) / DAY)),
    });
  }

  console.log(`Probing ${bounds.length} month boundaries…`);

  // Sequential on purpose — these responses run to megabytes.
  const seen = new Set();
  const monthOf = new Map();
  for (const b of bounds) {
    const ids = new Set(idsIn(await getFeed(b.days)));
    let fresh = 0;
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        monthOf.set(id, b.key);
        fresh++;
      }
    }
    console.log(`  ${b.key}  (days=${String(b.days).padStart(4)})  total ${String(ids.size).padStart(3)}  +${fresh}`);
    if (ids.size >= 180) {
      console.log("  ↑ hit the feed's 180-record cap; older dogs are not retrievable.");
      break;
    }
  }

  // Full records come from the widest query.
  const dogs = parseFeed(await getFeed(9999));
  console.log(`Parsed ${dogs.length} adopted dogs`);

  await fs.mkdir(IMG_DIR, { recursive: true });

  // One photo each — this is a wall of faces, not 180 galleries.
  const jobs = dogs.filter((d) => d._photos.length).map((d) => ({ dog: d, url: d._photos[0] }));
  console.log(`Resolving ${jobs.length} photos…`);

  const ok = new Set();
  await pool(jobs, 8, async ({ dog, url }) => {
    try {
      if (await fetchPhoto(url, IMG_DIR, dog.slug, { force: FORCE, width: 700 })) {
        ok.add(dog.slug);
      }
    } catch (err) {
      console.warn(`  photo failed ${dog.slug}: ${err.message}`);
    }
  });

  const alumni = dogs
    .filter((d) => ok.has(d.slug))
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      sex: d.sex,
      location: d.location,
      // First sentence only — this is a gallery, not 180 life stories.
      blurb: (d.bio.split("\n\n")[0] ?? "").slice(0, 180),
      adoptedMonth: monthOf.get(d.id) ?? null,
      image: `/alumni/${d.slug}`,
    }))
    .sort((a, b) => (b.adoptedMonth ?? "").localeCompare(a.adoptedMonth ?? ""));

  const dated = alumni.filter((a) => a.adoptedMonth).length;
  await fs.writeFile(DATA, JSON.stringify(alumni, null, 2) + "\n");
  console.log(`Wrote ${alumni.length} alumni (${dated} with an adoption month) to src/data/alumni.json`);
}

main().catch((err) => {
  console.error(`fetch-alumni failed: ${err.message}`);
  if (existsSync(DATA)) {
    console.warn("Keeping the committed src/data/alumni.json.");
    process.exit(0);
  }
  process.exit(1);
});
