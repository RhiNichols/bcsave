/**
 * Shared parsing for the ShelterManager public service feed.
 *
 * Both the adoptable and adopted feeds render the same BCSAVE template, so
 * one parser serves both. The feed is HTML because the json_/xml_/csv_
 * variants require credentials the rescue has not handed over.
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import path from "node:path";

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export const FIELDS = [
  "Name", "Sex", "Age", "Weight", "Color", "Coat", "Energy Level",
  "Spayed/Neutered", "Heartworm Status", "Location", "Adoption Fee",
];

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  mdash: "—", ndash: "–", hellip: "…", deg: "°",
};

export function unescapeHtml(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
}

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

export function slugify(name, id) {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || `dog-${id}`;
}

/** Every animalId in a feed, in feed order. Cheap — used for date bucketing. */
export function idsIn(html) {
  return [...html.matchAll(/const animalId = "(\d+)";/g)].map((m) => m[1]);
}

/** Parse a feed into dog records. Photos stay as remote URLs in `_photos`. */
export function parseFeed(html) {
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

    dogs.push({
      id,
      slug: slugify(name, id),
      // Names sometimes carry a disambiguating suffix like "Hollie (72)".
      name: name.replace(/\s*\(\d+\)\s*$/, "").trim(),
      sex: info.Sex ?? "",
      age: info.Age ?? "",
      weight: info.Weight ? `${info.Weight.replace(/\.0$/, "")} lb` : "",
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

  const seen = new Map();
  for (const d of dogs) {
    const n = (seen.get(d.slug) ?? 0) + 1;
    seen.set(d.slug, n);
    if (n > 1) d.slug = `${d.slug}-${d.id}`;
  }

  return dogs;
}

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
