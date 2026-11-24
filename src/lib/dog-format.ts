/**
 * How a dog's record is presented, with no dog data attached.
 *
 * Kept apart from src/data/dogs.ts because that module imports dogs.json, and
 * the browser scripts that render a dog live (src/lib/live-dogs.ts and the
 * 404 page) must not drag the whole snapshot into their bundle. The built
 * /dogs/<slug>/ page and the live one share these helpers so they read the
 * same.
 */

/** The fields both a built and a live dog page have. */
export interface DogFacts {
  sex: string;
  age: string;
  weight: string;
  color?: string;
  coat?: string;
  energy?: string;
  fixed?: string;
  heartworm?: string;
  location: string;
  fee: string;
}

/**
 * Escape a bio paragraph, then turn bare URLs into real links.
 *
 * Volunteers type plain text into ShelterManager, so links arrive unclickable.
 * Escaping happens first and the only markup added afterwards is our own
 * anchor, so the result is safe to render with set:html / innerHTML.
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
export function yearsFromAge(age: string): number {
  const m = age.match(/([\d.]+)\s*(week|month|year)/i);
  if (!m) return 99;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "week") return n / 52;
  if (unit === "month") return n / 12;
  return n;
}

export function ageGroupFromAge(age: string): "puppy" | "young" | "adult" | "senior" {
  const y = yearsFromAge(age);
  if (y < 1) return "puppy";
  if (y < 3) return "young";
  if (y < 8) return "adult";
  return "senior";
}

/** The label/value rows on a dog's page, with empty and placeholder values dropped. */
export function factRows(dog: DogFacts): [string, string][] {
  const rows: [string, string | undefined][] = [
    ["Sex", dog.sex],
    ["Age", dog.age],
    ["Weight", dog.weight],
    ["Color", dog.color],
    ["Coat", dog.coat],
    ["Energy", dog.energy],
    ["Spayed/Neutered", dog.fixed],
    ["Heartworm", dog.heartworm],
    ["Location", dog.location],
    ["Adoption fee", dog.fee],
  ];
  return rows.filter(
    (r): r is [string, string] => !!r[1] && r[1] !== "TBD" && r[1] !== "Unassigned"
  );
}
