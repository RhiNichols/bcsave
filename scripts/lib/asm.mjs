/**
 * Build-time half of the ShelterManager integration.
 *
 * The parser itself lives in src/lib/asm-core.mjs so the browser's live
 * refresh (src/lib/live-dogs.ts) runs the exact same code — see the note
 * there. This file adds the parts that need Node: image conversion, a worker
 * pool, and photo pruning.
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { UA } from "../../src/lib/asm-core.mjs";

export {
  UA,
  ASM_BASE,
  ASM_ACCOUNT,
  ASM_IMAGE_ACCOUNT,
  ADOPTABLE_URL,
  fetchText,
  FIELDS,
  unescapeHtml,
  slugify,
  idsIn,
  parseFeed,
} from "../../src/lib/asm-core.mjs";

/** Be a good neighbour between large sequential reads. */
export const breathe = (ms = 800) => new Promise((r) => setTimeout(r, ms));

/** Download one photo and emit detail + thumbnail WebP. Returns success. */
export async function fetchPhoto(url, dir, stem, { force = false, width = 1100 } = {}) {
  const detail = path.join(dir, `${stem}.webp`);
  const thumb = path.join(dir, `${stem}-t.webp`);
  if (!force && existsSync(detail) && existsSync(thumb)) return true;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  // ShelterManager returns a tiny body rather than a 404 for missing pictures.
  if (buf.length < 1000) return false;

  await sharp(buf).resize({ width, withoutEnlargement: true })
    .webp({ quality: 76 }).toFile(detail);
  await sharp(buf).resize({ width: 500, withoutEnlargement: true })
    .webp({ quality: 70 }).toFile(thumb);
  return true;
}

/** Fixed worker pool so we never open hundreds of sockets at once. */
export async function pool(items, workers, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (queue.length) await fn(queue.pop());
    })
  );
}

/**
 * Delete photos in `dir` that no current record uses.
 *
 * Photos are no longer committed: they live in the GitHub Actions cache and
 * are restored before every build. Without this, every dog who ever passed
 * through the feed would stay in that cache — and in the published site —
 * forever. `keep` is the set of file names (e.g. "bear-0.webp") still in use.
 *
 * Only call this after a successful fetch and parse. On the fallback path the
 * data is a stale snapshot, and pruning against it could delete photos the
 * next good run needs.
 *
 * Returns how many files were removed.
 */
export async function prunePhotos(dir, keep) {
  // An empty keep-set means something upstream went wrong, not that every dog
  // was adopted at once. Deleting everything on that evidence would leave the
  // next build with no photos at all.
  if (!keep.size) {
    console.warn(`  not pruning ${dir}: nothing to keep, which looks like a bad fetch`);
    return 0;
  }
  let removed = 0;
  for (const name of await fs.readdir(dir)) {
    // Only ever touch our own generated images.
    if (!name.endsWith(".webp") || keep.has(name)) continue;
    await fs.unlink(path.join(dir, name));
    removed++;
  }
  return removed;
}
