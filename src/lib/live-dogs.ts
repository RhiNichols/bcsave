/**
 * Reconcile the static dog grid against ShelterManager, in the browser.
 *
 * The page ships with whatever dogs existed at build time. Seconds later this
 * asks the Worker what is adoptable *now* and fixes the difference:
 *
 *   - a dog adopted since the build is removed, so nobody applies for a dog
 *     who is already home — the failure that actually costs the rescue time
 *   - a dog added since the build is fetched and appended
 *   - every count on the page is recomputed from what is left
 *
 * All of it is optional. If the fetch fails, is slow, or JavaScript is off,
 * the visitor keeps the static page and is none the wiser — which is why the
 * static build stays the source of truth for first paint.
 */

export interface LiveDog {
  id: string;
  slug: string;
  name: string;
  sex: string;
  age: string;
  weight: string;
  location: string;
  fee: string;
  bio: string;
  photos: string[];
}

/** Mirrors ageGroup() in src/data/dogs.ts — the filters key off these. */
function ageGroup(age: string): "puppy" | "young" | "adult" | "senior" {
  const m = age.match(/([\d.]+)\s*(week|month|year)/i);
  const n = m ? parseFloat(m[1]) : 99;
  const unit = m ? m[2].toLowerCase() : "year";
  const years = unit === "week" ? n / 52 : unit === "month" ? n / 12 : n;
  if (years < 1) return "puppy";
  if (years < 3) return "young";
  if (years < 8) return "adult";
  return "senior";
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Build a card matching DogCard.astro's markup for a dog added since the build. */
function cardFor(dog: LiveDog): HTMLLIElement | null {
  // No photo means no card. A pictureless dog reads as broken, and the build
  // scripts drop these for the same reason.
  if (!dog.photos.length) return null;

  const li = document.createElement("li");
  li.className = "dog";
  li.dataset.id = dog.id;
  li.dataset.sex = dog.sex;
  li.dataset.age = ageGroup(dog.age);
  li.dataset.location = dog.location;
  li.dataset.live = "new";

  const meta = [dog.sex, dog.age, dog.weight].filter(Boolean).join(" · ");
  const snippet = (dog.bio.split("\n\n")[0] ?? "").slice(0, 200);

  li.innerHTML = `
    <div class="dog__media">
      <img src="${esc(dog.photos[0])}" alt="${esc(dog.name)}, a Border Collie available for adoption"
           width="500" height="625" loading="lazy" decoding="async" />
      ${ageGroup(dog.age) === "puppy" ? '<span class="dog__tag dog__tag--puppy">Puppy</span>' : ""}
    </div>
    <div class="dog__body">
      <h2 class="dog__name"><a href="/dogs/${esc(dog.slug)}">${esc(dog.name)}</a></h2>
      <p class="dog__meta">${esc(meta)}</p>
      ${snippet ? `<p class="dog__snippet">${esc(snippet)}</p>` : ""}
      <div class="dog__foot">
        <span class="dog__fee">${esc(dog.fee)}</span>
        <span class="dog__cta">Meet ${esc(dog.name)} &rarr;</span>
      </div>
    </div>`;
  return li;
}

/**
 * A dog added after the build has no pre-rendered /dogs/<slug> page, so its
 * card would link to a 404. Point those at the grid until the next build
 * publishes the real page.
 */
function neutraliseLink(li: HTMLLIElement) {
  const a = li.querySelector<HTMLAnchorElement>(".dog__name a");
  if (a) a.removeAttribute("href");
  const cta = li.querySelector(".dog__cta");
  if (cta) cta.textContent = "Just arrived";
}

async function liveIds(signal: AbortSignal): Promise<Set<string> | null> {
  try {
    const res = await fetch("/api/available.json", { signal });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.ok && Array.isArray(body.ids) ? new Set<string>(body.ids) : null;
  } catch {
    return null;
  }
}

async function fetchDog(id: string, signal: AbortSignal): Promise<LiveDog | null> {
  try {
    const res = await fetch(`/api/dogs/${id}.json`, { signal });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.ok ? (body.dog as LiveDog) : null;
  } catch {
    return null;
  }
}

/**
 * Refresh a grid in place. Returns the number of dogs now shown, or null if
 * the live feed could not be reached and the page was left alone.
 */
export async function refreshGrid(grid: HTMLElement): Promise<number | null> {
  // Cap the whole exercise. A slow feed must not leave the page half-updated
  // while someone is reading it.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);

  try {
    const ids = await liveIds(ctl.signal);
    if (!ids) return null;

    const cards = Array.from(grid.querySelectorAll<HTMLLIElement>(".dog"));
    const onPage = new Set(cards.map((c) => c.dataset.id ?? ""));

    // Adopted since the build.
    for (const card of cards) {
      if (card.dataset.id && !ids.has(card.dataset.id)) card.remove();
    }

    // Added since the build. Bounded — if a build is so old that dozens are
    // missing, the answer is a rebuild, not sixty requests from every visitor.
    const fresh = [...ids].filter((id) => !onPage.has(id)).slice(0, 12);
    const added = await Promise.all(fresh.map((id) => fetchDog(id, ctl.signal)));

    for (const dog of added) {
      if (!dog) continue;
      const li = cardFor(dog);
      if (!li) continue;
      neutraliseLink(li);
      grid.prepend(li);
    }

    return grid.querySelectorAll(".dog").length;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Recompute every "N" on the page from the cards actually present. */
export function recount(grid: HTMLElement) {
  const cards = Array.from(grid.querySelectorAll<HTMLElement>(".dog"));
  const total = cards.length;

  for (const el of document.querySelectorAll<HTMLElement>("[data-dog-count]")) {
    el.textContent = String(total);
  }

  for (const chip of document.querySelectorAll<HTMLElement>(".chip[data-filter]")) {
    const label = chip.querySelector<HTMLElement>("[data-chip-count]");
    if (!label) continue;
    const [key, value] = (chip.dataset.filter ?? "all").split(":");
    label.textContent = String(
      key === "all" ? total : cards.filter((c) => c.dataset[key] === value).length
    );
  }
}
