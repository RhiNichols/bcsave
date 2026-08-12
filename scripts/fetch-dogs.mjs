/**
 * Pull the adoptable-dog list from ShelterManager and write src/data/dogs.json
 * plus WebP photos into public/dogs/.
 *
 * ShelterManager is BCSAVE's system of record — volunteers add dogs there, not
 * here. This script is the only bridge; nothing about dog data is hand-edited.
 *
 * The public `html_adoptable_animals` method needs no credentials but returns
 * HTML, so we parse it. If the ShelterManager service login ever turns up,
 * switch to `json_adoptable_animals` and most of src/lib/asm-core.mjs can go.
 *
 * The parser is imported, never copied. This file used to keep its own copy of
 * it, which meant a fix applied to the shared one silently did not reach the
 * build — see the note in src/lib/asm-core.mjs.
 *
 *   node scripts/fetch-dogs.mjs [--force-images]
 */
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ADOPTABLE_URL, fetchText, parseFeed, fetchPhoto, pool } from "./lib/asm.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "dogs");
const DATA = path.join(ROOT, "src", "data", "dogs.json");

const FORCE = process.argv.includes("--force-images");

async function main() {
  console.log(`Fetching ${ADOPTABLE_URL}`);
  const html = await fetchText(ADOPTABLE_URL);

  const dogs = parseFeed(html);
  console.log(`Parsed ${dogs.length} dogs`);

  await fs.mkdir(IMG_DIR, { recursive: true });

  const jobs = dogs.flatMap((d) =>
    d._photos.map((url, i) => ({ dog: d, url, stem: `${d.slug}-${i}`, i }))
  );
  console.log(`Resolving ${jobs.length} photos (${FORCE ? "forced" : "cached"})…`);

  const ok = new Map();
  let downloaded = 0;
  await pool(jobs, 8, async (job) => {
    try {
      const existed = existsSync(path.join(IMG_DIR, `${job.stem}.webp`));
      if (await fetchPhoto(job.url, IMG_DIR, job.stem, { force: FORCE })) {
        ok.set(`${job.dog.slug}:${job.i}`, `/dogs/${job.stem}`);
        if (!existed) downloaded++;
      }
    } catch (err) {
      console.warn(`  photo failed ${job.stem}: ${err.message}`);
    }
  });

  for (const d of dogs) {
    d.images = d._photos.map((_, i) => ok.get(`${d.slug}:${i}`)).filter(Boolean);
    delete d._photos;
  }

  const withPhotos = dogs.filter((d) => d.images.length);
  const dropped = dogs.length - withPhotos.length;

  await fs.writeFile(DATA, JSON.stringify(withPhotos, null, 2) + "\n");

  console.log(
    `Wrote ${withPhotos.length} dogs to src/data/dogs.json ` +
      `(${downloaded} new photos${dropped ? `, ${dropped} dogs dropped for having none` : ""})`
  );
}

main().catch((err) => {
  console.error(`fetch-dogs failed: ${err.message}`);

  // A scheduled rebuild must never be able to take the site down. If
  // ShelterManager is unreachable, fall back to the dogs.json already in the
  // repo — stale by a few hours beats a failed deploy. Only fail hard when
  // there is no snapshot to fall back to.
  if (existsSync(DATA)) {
    console.warn("Falling back to the committed src/data/dogs.json.");
    console.warn("Dogs will be stale until the next successful fetch.");
    process.exit(0);
  }

  console.error("No existing dogs.json to fall back to — failing the build.");
  process.exit(1);
});
