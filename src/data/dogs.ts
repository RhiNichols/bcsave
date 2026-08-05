import raw from "./dogs.json";

export interface Dog {
  id: string;
  slug: string;
  name: string;
  sex: string;
  age: string;
  weight: string;
  color: string;
  coat: string;
  energy: string;
  fixed: string;
  heartworm: string;
  location: string;
  fee: string;
  bio: string;
  /** Path stems under /public/dogs — append `.webp` or `-t.webp`. */
  images: string[];
}

export const dogs = raw as Dog[];

/**
 * Escape a bio paragraph, then turn bare URLs into real links.
 *
 * Volunteers type plain text into ShelterManager, so links arrive unclickable.
 * Escaping happens first and the only markup added afterwards is our own
 * anchor, so the result is safe to render with set:html.
 */
export function bioParagraphHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, (url) => {
    const label = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    return `<a href="${url}" rel="noopener nofollow" target="_blank">${label}</a>`;
  });
}

/** ShelterManager writes ages as "10 weeks", "1 year", "3 years". */
export function ageInYears(dog: Dog): number {
  const m = dog.age.match(/([\d.]+)\s*(week|month|year)/i);
  if (!m) return 99;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "week") return n / 52;
  if (unit === "month") return n / 12;
  return n;
}

export function isPuppy(dog: Dog): boolean {
  return ageInYears(dog) < 1;
}

export function ageGroup(dog: Dog): "puppy" | "young" | "adult" | "senior" {
  const y = ageInYears(dog);
  if (y < 1) return "puppy";
  if (y < 3) return "young";
  if (y < 8) return "adult";
  return "senior";
}

/** Regions, most-populated first, for the filter bar. */
export function locations(list: Dog[] = dogs): string[] {
  const counts = new Map<string, number>();
  for (const d of list) {
    if (!d.location || d.location === "Unassigned") continue;
    counts.set(d.location, (counts.get(d.location) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * Homepage picks: puppies and the best-photographed dogs read strongest, but
 * lead with variety so the grid doesn't look like eight of the same litter.
 */
export function featured(count = 8): Dog[] {
  const scored = [...dogs]
    .filter((d) => d.bio && d.images.length)
    .sort((a, b) => b.images.length - a.images.length);

  const picked: Dog[] = [];
  const seenLocations = new Set<string>();

  // First pass: one dog per region for geographic spread.
  for (const d of scored) {
    if (picked.length >= count) break;
    if (!seenLocations.has(d.location)) {
      seenLocations.add(d.location);
      picked.push(d);
    }
  }
  // Fill the rest by photo count.
  for (const d of scored) {
    if (picked.length >= count) break;
    if (!picked.includes(d)) picked.push(d);
  }
  return picked.slice(0, count);
}
