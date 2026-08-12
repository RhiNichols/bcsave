/**
 * Build-time half of the ShelterManager integration.
 *
 * The parser itself lives in src/lib/asm-core.mjs so the Cloudflare Worker can
 * run the exact same code at the edge — see the note there. This file adds the
 * parts that need Node: image conversion and a worker pool.
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
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
