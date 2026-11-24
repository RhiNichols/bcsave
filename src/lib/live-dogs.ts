/**
 * Reconcile the static dog grid against ShelterManager, in the browser.
 *
 * The page ships with whatever dogs existed at build time. Seconds later this
 * reads ShelterManager's public feed directly and fixes the difference:
 *
 *   - a dog adopted since the build is removed, so nobody applies for a dog
 *     who is already home — the failure that actually costs the rescue time
 *   - a dog added since the build is parsed out of the same feed and added,
 *     linking to their permanent /dogs/<name>-<id>/ address. That page does
 *     not exist until the next rebuild, so until then GitHub Pages answers it
 *     with 404.html, which renders the dog live (src/pages/404.astro)
 *   - every count on the page is recomputed from what is left
 *
 * All of it is optional. If the fetch fails, is slow, or JavaScript is off,
 * the visitor keeps the static page and is none the wiser — which is why the
 * static build stays the source of truth for first paint.
 *
 * Why the browser talks to ShelterManager itself: the site is plain files on
 * GitHub Pages, with no server of its own to ask. That works because
 * ShelterManager sends `Access-Control-Allow-Origin: *` on the feed (both the
 * redirect and the final answer), so any page may read it. The feed is about
 * 63 KB over the wire (1.1 MB once unzipped) and ShelterManager caches it for
 * ten minutes, so a visitor costs BCSAVE's account very little. It is fetched
 * once per page load and every lookup below reads that one copy.
 *
 * The parser is src/lib/asm-core.mjs — the same file the build scripts use, so
 * the static build and this live refresh can never disagree about a dog.
 */
import {
  ADOPTABLE_URL,
  ASM_BASE,
  ASM_IMAGE_ACCOUNT,
  adoptableIds,
  parseOne,
  photoRef,
} from "./asm-core.mjs";
import { url } from "./url";
// The same rule src/data/dogs.ts uses, so the filters agree with the build.
import { ageGroupFromAge as ageGroup } from "./dog-format";

export interface LiveDog {
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
  /** Full ShelterManager image URLs, loaded straight into <img>. */
  photos: string[];
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Build a card matching DogCard.astro's markup for a dog added since the build.
 *
 * It links to the dog's permanent address. Until the next rebuild publishes
 * that page, the 404 page renders it live from the same feed, so the link
 * works from the moment the card appears and never changes afterwards.
 */
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
      <span class="dog__tag dog__tag--new">Just arrived</span>
    </div>
    <div class="dog__body">
      <h2 class="dog__name"><a href="${esc(url(`/dogs/${dog.slug}`))}">${esc(dog.name)}</a></h2>
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
 * Read the whole adoptable feed once. Null on any failure — the caller treats
 * that as "leave the page alone".
 *
 * A plain GET with no custom headers on purpose: anything fancier would make
 * the browser send a CORS preflight, which ShelterManager is not set up for.
 */
export async function readFeed(signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(ADOPTABLE_URL, { signal });
    if (!res.ok) return null;
    const html = await res.text();
    // Same sanity floor as the build's fetchText: a near-empty body is an
    // error page, not a feed with no dogs in it.
    return html.length < 200 ? null : html;
  } catch {
    return null;
  }
}

/**
 * The ids ShelterManager lists as adoptable right now, or null if the feed
 * can't be trusted (unreachable, slow, or parsing to zero dogs). For pages
 * that only need to know who has gone — a dog's own page, the homepage —
 * without rebuilding a whole grid.
 */
export async function adoptableNow(timeoutMs = 15000): Promise<Set<string> | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const html = await readFeed(ctl.signal);
    if (!html) return null;
    const ids = new Set<string>(adoptableIds(html));
    return ids.size ? ids : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Remove cards for dogs no longer adoptable. Returns how many went. */
export function dropAdopted(root: ParentNode, ids: Set<string>): number {
  let removed = 0;
  for (const card of root.querySelectorAll<HTMLElement>(".dog[data-id]")) {
    if (!ids.has(card.dataset.id ?? "")) {
      card.remove();
      removed++;
    }
  }
  return removed;
}

/** A ShelterManager photo URL, loaded straight into an <img> (no CORS needed). */
const photoUrl = (id: string, seq: string) =>
  `${ASM_BASE}?account=${ASM_IMAGE_ACCOUNT}&method=animal_image&animalid=${id}&seq=${seq}`;

/** One dog parsed out of the feed we already have — no extra request. */
export function dogFrom(html: string, id: string): LiveDog | null {
  const dog = parseOne(html, id);
  if (!dog) return null;
  const { _photos, ...rest } = dog;
  return {
    ...rest,
    photos: (_photos as string[])
      .map(photoRef)
      .filter((p): p is { id: string; seq: string } => p !== null)
      .map((p) => photoUrl(p.id, p.seq)),
  };
}

export interface RefreshResult {
  /** Dogs on the page after reconciling. */
  total: number;
  /** When this page read ShelterManager (browser clock). */
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
  // while someone is reading it. Generous because the visitor's phone now
  // downloads the feed itself, possibly on a weak rural signal — and the page
  // is fully usable while it waits.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);

  try {
    const html = await readFeed(ctl.signal);
    if (!html) return null;

    const ids = new Set<string>(adoptableIds(html));
    // A feed that parses to zero dogs is far more likely a format change or an
    // error page than an empty rescue. Emptying the page on that evidence
    // would be worse than leaving it stale.
    if (!ids.size) return null;
    const fetchedAt = new Date().toISOString();

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

    // Added since the build. Unbounded on purpose: the cap of 12 dated from
    // when each arrival cost a request to a server function. Now every dog
    // comes out of the one feed already downloaded, and card photos lazy-load,
    // so a visitor never misses a dog just because the last build was old.
    const fresh = [...ids].filter((id) => !onPage.has(id));

    let added = 0;
    for (const id of fresh) {
      const dog = dogFrom(html, id);
      if (!dog) continue;
      const li = cardFor(dog);
      if (!li) continue;
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
