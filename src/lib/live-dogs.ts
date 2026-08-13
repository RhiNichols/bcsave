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

async function liveIds(
  signal: AbortSignal
): Promise<{ ids: Set<string>; fetchedAt: string } | null> {
  try {
    const res = await fetch("/api/available.json", { signal });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.ok || !Array.isArray(body.ids)) return null;
    return { ids: new Set<string>(body.ids), fetchedAt: body.fetchedAt };
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

export interface RefreshResult {
  /** Dogs on the page after reconciling. */
  total: number;
  /** When the Worker last read ShelterManager. */
  fetchedAt: string;
  /** Listings that were removed because they had been adopted. */
  removed: number;
  /** Listings added that the build did not know about. */
  added: number;
}

/**
 * Refresh a grid in place. Returns what changed, or null if the live feed
 * could not be reached and the page was left exactly as built.
 */
export async function refreshGrid(grid: HTMLElement): Promise<RefreshResult | null> {
  // Cap the whole exercise. A slow feed must not leave the page half-updated
  // while someone is reading it.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);

  try {
    const live = await liveIds(ctl.signal);
    if (!live) return null;
    const { ids, fetchedAt } = live;

    const cards = Array.from(grid.querySelectorAll<HTMLLIElement>(".dog"));
    const onPage = new Set(cards.map((c) => c.dataset.id ?? ""));

    // Adopted since the build.
    let removed = 0;
    for (const card of cards) {
      if (card.dataset.id && !ids.has(card.dataset.id)) {
        card.remove();
        removed++;
      }
    }

    // Added since the build. Bounded — if a build is so old that dozens are
    // missing, the answer is a rebuild, not sixty requests from every visitor.
    const fresh = [...ids].filter((id) => !onPage.has(id)).slice(0, 12);
    const fetched = await Promise.all(fresh.map((id) => fetchDog(id, ctl.signal)));

    let added = 0;
    for (const dog of fetched) {
      if (!dog) continue;
      const li = cardFor(dog);
      if (!li) continue;
      neutraliseLink(li);
      grid.prepend(li);
      added++;
    }

    return { total: grid.querySelectorAll(".dog").length, fetchedAt, removed, added };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Say, on the page, that these listings came from ShelterManager.
 *
 * The integration is otherwise invisible — a list of dogs looks identical
 * whether it was pulled from the rescue's own system or typed out by hand.
 * Anyone being asked to approve this site needs to be able to see which it is,
 * so this states it in plain language and prints the time the feed was last
 * read as evidence.
 *
 * Only ever called after a successful live read, so it cannot claim a
 * connection that is not there.
 */
export function showLiveStatus(el: HTMLElement, r: RefreshResult) {
  const when = new Date(r.fetchedAt);
  const time = Number.isNaN(when.valueOf())
    ? null
    : when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const changes: string[] = [];
  if (r.removed) changes.push(`${r.removed} adopted since the last build`);
  if (r.added) changes.push(`${r.added} just added`);

  el.innerHTML =
    `<span class="live-dot" aria-hidden="true"></span>` +
    `<span><strong>${r.total} dogs, live from ShelterManager.</strong> ` +
    `Volunteers post dogs there and this page follows` +
    (time ? `, checked at ${time}` : "") +
    `.${changes.length ? ` ${changes.join(", ")}.` : ""}</span>`;
  el.hidden = false;
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
