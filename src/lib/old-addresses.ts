/**
 * Pattern rules for old WordPress addresses — layer two of three.
 *
 *   1. Exact old paths → stub pages, from src/data/redirects.ts
 *   2. Whole families of old paths → these rules, run by src/pages/404.astro
 *   3. Everything else → a plain 404
 *
 * Layer two exists because WordPress gave every dog, product, event and tag a
 * page of its own: about 1,300 of the 1,525 old addresses the Wayback Machine
 * saw. Listing them would mean a stub per dog name forever; a rule is smaller
 * and also catches the ones the archive never saw.
 *
 * Pure functions, no DOM, so the rules can be read (and tested) on their own.
 */
import { shop, social } from "../data/links";

/** Every family the 404 page might forward. Kept in sync with plan() below. */
export const HANDLED_PREFIX =
  /^(dogs|product|rescue|product-tag|bc-tag|product-category|shop|events|locations)\//;

export type Plan =
  /** Forward straight away: a site path ("/dogs/") or an external URL. */
  | { kind: "go"; to: string }
  /** A dog's old or new address: look `slug` up (see 404.astro). */
  | { kind: "dog"; slug: string }
  | null;

/**
 * Merchandise from the old WooCommerce shop, which shared /product/<x>/ with
 * the dogs. Its slugs are product names ("15-oz-white-mug-bcsave-badge",
 * "nl6010-next-level-mens-triblend-t-shirt-3"). A single word is treated as a
 * dog — there was a dog called Polo — except "calendar", the fundraiser.
 */
const MERCH = new Set([
  "mug", "shirt", "tee", "cap", "hat", "hats", "hoodie", "hooded", "sweatshirt",
  "tote", "bag", "bottle", "sticker", "jacket", "polo", "storefront", "duffel",
  "outerwear", "bandana", "magnet", "decal", "tumbler", "blanket",
]);

export function isMerch(slug: string): boolean {
  if (slug === "calendar") return true;
  const words = slug.split("-");
  return words.length >= 2 && words.some((w) => MERCH.has(w));
}

/**
 * Decide what to do with a path that reached the 404 page.
 *
 * `rel` is the path below the site's base, lower-case, with no leading slash
 * and with a trailing one: "dogs/abigail/", "product-tag/puppy/".
 */
export function plan(rel: string): Plan {
  const seg = rel.split("/").filter(Boolean);
  const [a, b, c] = seg;

  // Dog pages, old and new. Only a single name segment counts as a dog.
  if (a === "dogs" && seg.length === 2) return { kind: "dog", slug: b };
  if (a === "product" && seg.length === 2) {
    return isMerch(b) ? { kind: "go", to: shop } : { kind: "dog", slug: b };
  }
  if (a === "rescue" && seg.length === 3 && ["available", "coming-soon", "courtesy"].includes(b)) {
    return { kind: "dog", slug: c };
  }

  // WooCommerce listing pages for dogs, tags and merchandise.
  if (a === "product-category") {
    if (b === "alumni" || (b === "dogs" && c === "alumni")) return { kind: "go", to: "/alumni/" };
    if (b === "merchandise" || b === "fundraiser") return { kind: "go", to: shop };
    return { kind: "go", to: "/dogs/" };
  }
  if (a === "product-tag" || a === "bc-tag") return { kind: "go", to: "/dogs/" };

  if (a === "shop") return { kind: "go", to: shop };
  if (a === "events" || a === "locations") return { kind: "go", to: social.facebook };

  return null;
}

/**
 * Names to try for an old dog slug, most specific first.
 *
 * WordPress suffixed repeats ("bandit-2") and copies ("dante-copy"), and the
 * shop tagged courtesy listings from another rescue ("bobby-abcr").
 */
export function nameCandidates(slug: string): string[] {
  const out = [slug];
  let s = slug;
  for (;;) {
    const t = s.replace(/-(\d+|copy|abcr|coming-soon)$/, "");
    if (t === s || !t) break;
    out.push(t);
    s = t;
  }
  return out;
}
