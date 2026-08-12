/**
 * Live ShelterManager layer.
 *
 * The site is a build-time snapshot: fast, works without JavaScript, and good
 * for search engines. Its one flaw is that it goes stale — a dog adopted an
 * hour after a build stays listed until the next one, and people apply for
 * dogs who are already home.
 *
 * This Worker closes that gap without giving up the static build. Static
 * assets are still served first, straight from the edge; these routes exist so
 * the page can correct itself after it loads:
 *
 *   /api/available.json     which dogs are adoptable right now
 *   /api/dogs/<id>.json     one dog's details, for dogs added since the build
 *   /api/dog-photo/<id>/<n> that dog's photos, proxied
 *
 * Everything is deliberately cheap. A Worker request has a hard CPU budget and
 * the feed is ~1.5MB, so nothing here parses the whole document — see
 * `parseOne` in src/lib/asm-core.mjs.
 */
import {
  ADOPTABLE_URL,
  ASM_BASE,
  ASM_IMAGE_ACCOUNT,
  UA,
  adoptableIds,
  parseOne,
  photoRef,
} from "./lib/asm-core.mjs";

/** How long the edge may serve a cached answer before re-reading the feed. */
const FEED_TTL = 300; // 5 minutes
const PHOTO_TTL = 86400; // a dog's photos do not change; a day is conservative

const json = (body, ttl) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${ttl}`,
      // Same-origin only in practice, but the static pages fetch these and a
      // preview may be opened from anywhere.
      "access-control-allow-origin": "*",
    },
  });

const fail = (status, message) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Never let a bad upstream answer get cached as if it were good.
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

/**
 * Read the adoptable feed.
 *
 * Cloudflare caches the subrequest itself, so many visitors within the TTL
 * cost ShelterManager one read, not one each. That matters — this is a small
 * rescue's service account, not an API built for our traffic.
 */
async function readFeed() {
  const res = await fetch(ADOPTABLE_URL, {
    headers: { "User-Agent": UA },
    cf: { cacheTtl: FEED_TTL, cacheEverything: true },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const html = await res.text();
  if (html.length < 200) throw new Error(`feed too short (${html.length}b)`);
  return html;
}

async function handleApi(url, request, ctx) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  let res;

  if (url.pathname === "/api/available.json") {
    const html = await readFeed();
    // One regex sweep over the document — the cheapest useful question we can
    // ask, and the only one every visitor triggers.
    const ids = [...new Set(adoptableIds(html))];
    res = json({ ok: true, fetchedAt: new Date().toISOString(), count: ids.length, ids }, FEED_TTL);
  } else if (url.pathname.startsWith("/api/dogs/")) {
    const id = url.pathname.slice("/api/dogs/".length).replace(/\.json$/, "");
    if (!/^\d+$/.test(id)) return fail(400, "bad id");

    const dog = parseOne(await readFeed(), id);
    // A missing id is the ordinary answer for a dog who was just adopted.
    if (!dog) return fail(404, "not adoptable");

    const { _photos, ...rest } = dog;
    res = json(
      {
        ok: true,
        dog: {
          ...rest,
          photos: _photos
            .map(photoRef)
            .filter(Boolean)
            .map((p) => `/api/dog-photo/${p.id}/${p.seq}`),
        },
      },
      FEED_TTL
    );
  } else if (url.pathname.startsWith("/api/dog-photo/")) {
    const [, , , id, seq] = url.pathname.split("/");
    if (!/^\d+$/.test(id) || !/^\d+$/.test(seq ?? "")) return fail(400, "bad photo ref");

    const upstream = await fetch(
      `${ASM_BASE}?account=${ASM_IMAGE_ACCOUNT}&method=animal_image&animalid=${id}&seq=${seq}`,
      { headers: { "User-Agent": UA }, cf: { cacheTtl: PHOTO_TTL, cacheEverything: true } }
    );
    if (!upstream.ok) return fail(502, "photo unavailable");

    const body = await upstream.arrayBuffer();
    // ShelterManager returns a tiny body rather than a 404 for a missing photo.
    if (body.byteLength < 1000) return fail(404, "no photo");

    res = new Response(body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        "cache-control": `public, max-age=${PHOTO_TTL}, s-maxage=${PHOTO_TTL}`,
      },
    });
  } else {
    return fail(404, "no such route");
  }

  ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (request.method !== "GET") return fail(405, "GET only");
      try {
        return await handleApi(url, request, ctx);
      } catch (err) {
        // The static page is already correct-ish; a failed refresh must never
        // be worse than no refresh. Answer honestly and let the client skip.
        return fail(503, String(err?.message ?? err).slice(0, 200));
      }
    }

    return env.ASSETS.fetch(request);
  },
};
