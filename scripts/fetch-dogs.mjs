/**
 * Pull the adoptable-dog list from ShelterManager and write src/data/dogs.json
 * plus WebP photos into public/dogs/.
 *
 * ShelterManager is BCSAVE's system of record — volunteers add dogs there, not
 * here. This script is the only bridge; nothing about dog data is hand-edited.
 *
 * The public `html_adoptable_animals` method needs no credentials but returns
 * HTML, so we parse it. If the ShelterManager service login ever turns up,
 * switch to `json_adoptable_animals` and delete most of this file.
 *
 *   node scripts/fetch-dogs.mjs [--force-images]
 */
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fetchText } from "./lib/asm.mjs";

const ACCOUNT = "BCSAVE";
const FEED = `https://service.sheltermanager.com/asmservice?account=${ACCOUNT}&method=html_adoptable_animals`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "dogs");
const DATA = path.join(ROOT, "src", "data", "dogs.json");

const FORCE = process.argv.includes("--force-images");

const FIELDS = [
  "Name", "Sex", "Age", "Weight", "Color", "Coat", "Energy Level",
  "Spayed/Neutered", "Heartworm Status", "Location", "Adoption Fee",
];

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  mdash: "—", ndash: "–", hellip: "…", deg: "°",
};

function unescapeHtml(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
}

/** Strip markup and collapse to de-duplicated visible lines. */
function visibleLines(chunk) {
  const stripped = chunk
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n");

  const out = [];
  for (const raw of unescapeHtml(stripped).split("\n")) {
    const line = raw.trim();
    if (line && out.at(-1) !== line) out.push(line);
  }
  return out;
}

function slugify(name, id) {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || `dog-${id}`;
}

function parseFeed(html) {
  const marks = [
    ...html.matchAll(/const animalId = "(\d+)";\s*\n\s*const animalName = "(.*?)";/g),
  ].map((m) => ({ pos: m.index, id: m[1], name: unescapeHtml(m[2]) }));

  if (!marks.length) throw new Error("No animal records found — feed format changed?");

  const dogs = [];
  let prev = 0;

  for (const { pos, id, name } of marks) {
    const chunk = html.slice(prev, pos);
    prev = pos;

    // ShelterManager seeds every account with an "- ANY DOG -" placeholder.
    if (name.replace(/-/g, "").trim().toUpperCase() === "ANY DOG") continue;

    const lines = visibleLines(chunk);

    const info = {};
    lines.forEach((line, i) => {
      if (!line.endsWith(":")) return;
      const label = line.slice(0, -1).trim();
      const next = lines[i + 1];
      if (FIELDS.includes(label) && next && !next.endsWith(":")) info[label] = next;
    });

    // Bio is the prose between the last field and the share buttons.
    const feeIdx = lines.lastIndexOf("Adoption Fee:");
    const bio = [];
    for (const line of lines.slice(feeIdx === -1 ? 0 : feeIdx + 2)) {
      if (line === "Share" || line.startsWith("Share ")) break;
      if (line.length > 30) bio.push(line);
    }

    const photos = [
      ...new Set(
        [...chunk.matchAll(
          /"(https:\/\/service\.sheltermanager\.com\/asmservice\?account=[^"&]+&method=animal_image&animalid=\d+(?:&seq=\d+)?)"/g
        )].map((m) => m[1])
      ),
    ];

    const weight = info.Weight ? `${info.Weight.replace(/\.0$/, "")} lb` : "";

    dogs.push({
      id,
      slug: slugify(name, id),
      name: name.trim(),
      sex: info.Sex ?? "",
      age: info.Age ?? "",
      weight,
      color: info.Color ?? "",
      coat: info.Coat ?? "",
      energy: info["Energy Level"] ?? "",
      fixed: info["Spayed/Neutered"] ?? "",
      heartworm: info["Heartworm Status"] ?? "",
      location: info.Location ?? "",
      fee: (info["Adoption Fee"] ?? "").replace(/\.00$/, ""),
      bio: bio.join("\n\n"),
      _photos: photos,
    });
  }

  // Two dogs can share a name; keep slugs unique and stable.
  const seen = new Map();
  for (const d of dogs) {
    const n = (seen.get(d.slug) ?? 0) + 1;
    seen.set(d.slug, n);
    if (n > 1) d.slug = `${d.slug}-${d.id}`;
  }

  return dogs;
}

async function fetchImage(url, stem) {
  const detail = path.join(IMG_DIR, `${stem}.webp`);
  const thumb = path.join(IMG_DIR, `${stem}-t.webp`);

  if (!FORCE && existsSync(detail) && existsSync(thumb)) return true;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  // ShelterManager returns a tiny error body rather than a 404 for missing pics.
  if (buf.length < 1000) return false;

  await sharp(buf).resize({ width: 1100, withoutEnlargement: true })
    .webp({ quality: 76 }).toFile(detail);
  await sharp(buf).resize({ width: 500, withoutEnlargement: true })
    .webp({ quality: 70 }).toFile(thumb);
  return true;
}

/** Run jobs with a fixed worker pool so we don't open 300 sockets at once. */
async function pool(items, workers, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (queue.length) await fn(queue.pop());
    })
  );
}

async function main() {
  console.log(`Fetching ${FEED}`);
  const html = await fetchText(FEED);

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
      if (await fetchImage(job.url, job.stem)) {
        ok.set(`${job.dog.slug}:${job.i}`, `/dogs/${job.stem}`);
        if (!existed) downloaded++;
      }
    } catch (err) {
      console.warn(`  photo failed ${job.stem}: ${err.message}`);
    }
  });

  for (const d of dogs) {
    d.images = d._photos
      .map((_, i) => ok.get(`${d.slug}:${i}`))
      .filter(Boolean);
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
