/**
 * /dog-index.json — a small lookup the 404 page uses to forward old dog links.
 *
 * The WordPress site gave every dog a page at /dogs/<name>/ (and earlier at
 * /product/<name>/ and /rescue/available/<name>/). Those links are all over
 * Facebook. This site's dog pages are /dogs/<name>-<id>/, so when an old one
 * lands on the 404 page it fetches this file and looks the name up:
 *
 *   names: name-slug → where that dog is now, or a number when several dogs
 *          share the name (the page then cannot tell which one was meant)
 *   ids:   ShelterManager id → where that dog is now, for a /dogs/<name>-<id>/
 *          link to a dog who has since been adopted or renamed
 *
 * Targets are site paths without the base path; the 404 page adds it. Only
 * fetched when a dog-shaped address misses, so ordinary visits never load it.
 */
import { dogs } from "../data/dogs";
import alumniRaw from "../data/alumni.json";
import { nameSlug } from "../lib/asm-core.mjs";

interface Alum {
  id: string;
  slug: string;
  name: string;
  adoptedMonth: string | null;
}

export function GET() {
  const ids: Record<string, string> = {};
  const byName = new Map<string, Set<string>>();

  const add = (id: string, name: string, target: string) => {
    if (ids[id]) return; // a dog who came back is listed as current, not alumni
    ids[id] = target;
    const key = nameSlug(name);
    if (!key) return;
    const set = byName.get(key) ?? new Set<string>();
    set.add(id);
    byName.set(key, set);
  };

  for (const d of dogs) add(d.id, d.name, `/dogs/${d.slug}/`);
  // Only alumni the page actually shows (alumni.astro skips any without an
  // adoption month), or the #anchor would point at nothing.
  for (const a of alumniRaw as Alum[]) {
    if (a.adoptedMonth) add(a.id, a.name, `/alumni/#${a.slug}`);
  }

  const names: Record<string, string | number> = {};
  for (const [key, set] of byName) {
    names[key] = set.size === 1 ? ids[[...set][0]] : set.size;
  }

  return new Response(JSON.stringify({ names, ids }), {
    headers: { "Content-Type": "application/json" },
  });
}
