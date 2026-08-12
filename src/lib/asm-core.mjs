/**
 * ShelterManager feed parsing — the half that runs anywhere.
 *
 * Deliberately free of Node built-ins so the same parser can run in the build
 * scripts *and* inside the Cloudflare Worker. If these two ever drift, the
 * static build and the live refresh start disagreeing about the same dog, so
 * they share this file rather than each keeping a copy.
 *
 * The image half (sharp, fs) stays in scripts/lib/asm.mjs — the edge has
 * neither.
 */

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export const ASM_BASE = "https://service.sheltermanager.com/asmservice";
export const ASM_ACCOUNT = "BCSAVE";
/** Photos are served under the internal id, not the account name. */
export const ASM_IMAGE_ACCOUNT = "jb3344";

export const ADOPTABLE_URL =
  `${ASM_BASE}?account=${ASM_ACCOUNT}&method=html_adoptable_animals`;

/**
 * Fetch a feed with retries.
 *
 * The widest adopted-animals query runs to ~2.7MB and can take 30s+, and the
 * connection sometimes drops partway. A scheduled rebuild should not fail over
 * one flaky read, so back off and try again.
 */
export async function fetchText(url, { attempts = 4, timeoutMs = 120000 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      if (body.length < 200) throw new Error(`suspiciously short body (${body.length}b)`);
      return body;
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      const wait = 2000 * 2 ** (i - 1); // 2s, 4s, 8s
      console.warn(`  retry ${i}/${attempts - 1} after ${err.message} — waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`failed after ${attempts} attempts: ${lastErr?.message}`);
}

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

/**
 * Drop script blocks the slice cut in half.
 *
 * A dog's span starts at its `const animalId` line, which sits *inside* a
 * script element that opened before the slice — and the last dog's span runs
 * to the end of the document, catching the opening of the page's trailing
 * script. Neither orphan matches the paired-tag strip below, so without this
 * the page's JavaScript is read as prose and ends up in a dog's biography.
 */
function stripOrphanedScripts(chunk) {
  const close = chunk.indexOf("</script>");
  const open = chunk.indexOf("<script");
  // A closing tag before any opening one means we began mid-block.
  if (close !== -1 && (open === -1 || close < open)) {
    chunk = chunk.slice(close + "</script>".length);
  }

  const lastOpen = chunk.lastIndexOf("<script");
  if (lastOpen !== -1 && chunk.indexOf("</script>", lastOpen) === -1) {
    chunk = chunk.slice(0, lastOpen);
  }
  return chunk;
}

function visibleLines(chunk) {
  const stripped = stripOrphanedScripts(chunk)
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

/**
 * Ids of the real, adoptable animals — the placeholder record excluded.
 *
 * Deliberately built from the id/name regex alone. This is the hot path for
 * every visitor, so it must not run the full line-splitting parse.
 */
export function adoptableIds(html) {
  return marksIn(html)
    .filter((m) => !isPlaceholder(m.name))
    .map((m) => m.id);
}

/** ShelterManager seeds every account with an "- ANY DOG -" placeholder. */
const isPlaceholder = (name) =>
  name.replace(/-/g, "").trim().toUpperCase() === "ANY DOG";

/**
 * Every `const animalId` declaration, with the byte offset it sits at.
 *
 * BCSAVE's template interleaves the two halves of a dog record, one step out
 * of phase, which is worth spelling out because it is the whole trap:
 *
 *     <card: Name: Leonidas, Sex, Age, bio…>     ← Leonidas's details
 *     <script> animalId = "294"; thumbnails=[…294…] </script>
 *     <card: Name: Rockie, …>                    ← Rockie's details
 *     <script> animalId = "293"; thumbnails=[…293…] </script>
 *
 * So for the mark at index i: the **card before it** holds that dog's fields
 * and biography, while the **script at it** holds that dog's photos. Take both
 * from one span and half the record belongs to the neighbour — and it still
 * parses cleanly, so nothing complains. The site shipped for a while with
 * every dog wearing the previous dog's photograph.
 *
 * dogFromChunk therefore takes the two spans separately, and filters photos by
 * animal id so a future slip cannot silently re-introduce this.
 */
function marksIn(html) {
  return [
    ...html.matchAll(/const animalId = "(\d+)";\s*\n\s*const animalName = "(.*?)";/g),
  ].map((m) => ({ pos: m.index, id: m[1], name: unescapeHtml(m[2]) }));
}

/**
 * Build one dog from its card span and its own script span.
 *
 * Photos stay as remote URLs in `_photos`. See marksIn for why these are two
 * different spans rather than one.
 */
function dogFromChunk(cardChunk, ownScript, id, name) {
  const lines = visibleLines(cardChunk);

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

  // Only the thumbnail array in this dog's own <script>. The span runs on into
  // the next dog's card, whose <img> tags would otherwise be picked up too.
  const close = ownScript.indexOf("</script>");
  const thumbs = close === -1 ? ownScript : ownScript.slice(0, close);

  const photos = [
    ...new Set(
      [...thumbs.matchAll(
        /"(https:\/\/service\.sheltermanager\.com\/asmservice\?account=[^"&]+&method=animal_image&animalid=(\d+)(?:&seq=\d+)?)"/g
      )]
        // Hard invariant: a dog only ever carries its own photographs.
        .filter((m) => m[2] === String(id))
        .map((m) => m[1])
    ),
  ];

  return {
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
  };
}

/** Parse a feed into dog records. Photos stay as remote URLs in `_photos`. */
export function parseFeed(html) {
  const marks = marksIn(html);
  if (!marks.length) throw new Error("No animal records found — feed format changed?");

  const dogs = [];

  for (let i = 0; i < marks.length; i++) {
    const { pos, id, name } = marks[i];
    if (isPlaceholder(name)) continue;
    dogs.push(
      dogFromChunk(
        html.slice(marks[i - 1]?.pos ?? 0, pos), // this dog's card
        html.slice(pos, marks[i + 1]?.pos ?? html.length), // this dog's script
        id,
        name
      )
    );
  }

  const seen = new Map();
  for (const d of dogs) {
    const n = (seen.get(d.slug) ?? 0) + 1;
    seen.set(d.slug, n);
    if (n > 1) d.slug = `${d.slug}-${d.id}`;
  }

  return dogs;
}

/**
 * Parse a single dog out of a feed, without touching the other 60-odd.
 *
 * `parseFeed` runs the line-splitting pass over the whole ~1.5MB document,
 * which is far more CPU than a Cloudflare Worker request is allowed. Slicing
 * to one dog's span first keeps the edge lookup within budget.
 *
 * Returns null when the id is not in this feed — which is the normal answer
 * for a dog who has just been adopted.
 */
export function parseOne(html, id) {
  const marks = marksIn(html);
  const i = marks.findIndex((m) => m.id === String(id));
  if (i === -1) return null;
  if (isPlaceholder(marks[i].name)) return null;

  const dog = dogFromChunk(
    html.slice(marks[i - 1]?.pos ?? 0, marks[i].pos),
    html.slice(marks[i].pos, marks[i + 1]?.pos ?? html.length),
    marks[i].id,
    marks[i].name
  );

  // parseFeed suffixes the id onto the *second* dog to claim a slug. Repeat
  // that count here so a live-added dog gets the same URL a rebuild will.
  const earlier = marks
    .slice(0, i)
    .filter((m) => !isPlaceholder(m.name) && slugify(m.name, m.id) === slugify(marks[i].name, id));
  if (earlier.length) dog.slug = `${dog.slug}-${dog.id}`;

  return dog;
}

/** Split a ShelterManager image URL into the bits our proxy route needs. */
export function photoRef(url) {
  const id = url.match(/animalid=(\d+)/)?.[1];
  const seq = url.match(/seq=(\d+)/)?.[1] ?? "1";
  return id ? { id, seq } : null;
}
