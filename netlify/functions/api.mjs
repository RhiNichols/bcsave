/**
 * Live ShelterManager layer — Netlify port of src/worker.js.
 *
 * Same three routes, same contract, same parser (src/lib/asm-core.mjs), so the
 * pages do not care which host they are served from:
 *
 *   /api/available.json      which dogs are adoptable right now
 *   /api/dogs/<id>.json      one dog, for arrivals since the build
 *   /api/dog-photo/<id>/<n>  that dog's photos, proxied
 *
 * The Cloudflare original leaned on `caches.default` and per-request `cf:`
 * cache options. Netlify has neither, so freshness is expressed purely through
 * Cache-Control and left to the CDN — the effect visitors see is the same, and
 * ShelterManager still gets one read per TTL rather than one per visitor.
 */
import {
  ADOPTABLE_URL,
  ASM_BASE,
  ASM_IMAGE_ACCOUNT,
  UA,
  adoptableIds,
  parseOne,
  photoRef,
} from "../../src/lib/asm-core.mjs";

const FEED_TTL = 300; // seconds the CDN may serve a cached answer
const PHOTO_TTL = 86400; // a dog's photos do not change

const json = (body, ttl) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${ttl}`,
      "access-control-allow-origin": "*",
    },
  });

const fail = (status, message) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Never let a bad upstream answer be cached as if it were good.
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

async function readFeed() {
  const res = await fetch(ADOPTABLE_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const html = await res.text();
  if (html.length < 200) throw new Error(`feed too short (${html.length}b)`);
  return html;
}

/** How recently a build must have run for another to be pointless. */
const PUBLISH_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Ask the site when it was last built.
 *
 * Returns null if the stamp cannot be read — in which case we allow the
 * publish. Refusing to publish because a check failed would be the wrong way
 * round: the cost of one extra build is trivial, the cost of a volunteer being
 * told "no" for no visible reason is not.
 */
async function lastBuiltAt(origin) {
  try {
    const res = await fetch(`${origin}/build-stamp.txt`, {
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const when = new Date((await res.text()).trim());
    return Number.isNaN(when.valueOf()) ? null : when;
  } catch {
    return null;
  }
}

/**
 * Let a volunteer publish their newly added dogs without waiting for the
 * twice-daily rebuild.
 *
 * Guarded by a shared passphrase rather than left open: the build hook is
 * effectively a "spend Netlify build minutes" button, and the free tier has
 * 300 of them a month.
 */
async function publish(request, origin) {
  const hook = process.env.NETLIFY_BUILD_HOOK;
  const code = process.env.PUBLISH_CODE;

  if (!hook || !code) {
    return fail(503, "Publishing is not configured yet — NETLIFY_BUILD_HOOK and PUBLISH_CODE need setting.");
  }

  let given = "";
  try {
    given = ((await request.json())?.code ?? "").toString();
  } catch {
    return fail(400, "Could not read that request.");
  }

  if (given.trim().toLowerCase() !== code.trim().toLowerCase()) {
    return fail(401, "That code is not right. Check the card, or ask whoever set this up.");
  }

  const built = await lastBuiltAt(origin);
  if (built) {
    const age = Date.now() - built.valueOf();
    if (age < PUBLISH_COOLDOWN_MS) {
      const wait = Math.ceil((PUBLISH_COOLDOWN_MS - age) / 60000);
      return new Response(
        JSON.stringify({
          ok: true,
          alreadyRunning: true,
          message: `The website was updated ${Math.max(1, Math.round(age / 60000))} minutes ago, so your dogs are probably already on it. Have a look — if they are missing, try again in ${wait} minutes.`,
        }),
        { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }
  }

  // Everything a volunteer might see from here is written for a volunteer.
  // Nobody adding a dog should be shown "fetch failed", and the reassurance
  // matters: their work is saved in ShelterManager either way, and the site
  // will pick it up on its own even if this button never works.
  let res;
  try {
    res = await fetch(hook, { method: "POST", body: "{}", signal: AbortSignal.timeout(10000) });
  } catch {
    return fail(
      502,
      "Could not reach the website to start the update. Your dogs are saved in ShelterManager and will appear on their own shortly."
    );
  }
  if (!res.ok) {
    return fail(
      502,
      "The website would not start the update just now. Your dogs are saved in ShelterManager and will appear on their own shortly."
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      alreadyRunning: false,
      message: "Updating the website now. Your dogs will be live in about two minutes — you can close this page.",
    }),
    { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
  );
}

export default async function handler(request) {
  const url = new URL(request.url);

  if (url.pathname === "/api/publish") {
    if (request.method !== "POST") return fail(405, "POST only");
    try {
      return await publish(request, url.origin);
    } catch (err) {
      return fail(500, String(err?.message ?? err).slice(0, 200));
    }
  }

  if (request.method !== "GET") return fail(405, "GET only");

  try {
    if (url.pathname === "/api/available.json") {
      const ids = [...new Set(adoptableIds(await readFeed()))];
      return json(
        { ok: true, fetchedAt: new Date().toISOString(), count: ids.length, ids },
        FEED_TTL
      );
    }

    if (url.pathname.startsWith("/api/dogs/")) {
      const id = url.pathname.slice("/api/dogs/".length).replace(/\.json$/, "");
      if (!/^\d+$/.test(id)) return fail(400, "bad id");

      const dog = parseOne(await readFeed(), id);
      // A missing id is the ordinary answer for a dog who was just adopted.
      if (!dog) return fail(404, "not adoptable");

      const { _photos, ...rest } = dog;
      return json(
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
    }

    if (url.pathname.startsWith("/api/dog-photo/")) {
      const [, , , id, seq] = url.pathname.split("/");
      if (!/^\d+$/.test(id) || !/^\d+$/.test(seq ?? "")) return fail(400, "bad photo ref");

      const upstream = await fetch(
        `${ASM_BASE}?account=${ASM_IMAGE_ACCOUNT}&method=animal_image&animalid=${id}&seq=${seq}`,
        { headers: { "User-Agent": UA } }
      );
      if (!upstream.ok) return fail(502, "photo unavailable");

      const body = await upstream.arrayBuffer();
      // ShelterManager returns a tiny body rather than a 404 for a missing photo.
      if (body.byteLength < 1000) return fail(404, "no photo");

      return new Response(body, {
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
          "cache-control": `public, max-age=${PHOTO_TTL}, s-maxage=${PHOTO_TTL}`,
        },
      });
    }

    return fail(404, "no such route");
  } catch (err) {
    // A failed refresh must never be worse than no refresh — the client is
    // built to leave the static page alone when this answers badly.
    return fail(503, String(err?.message ?? err).slice(0, 200));
  }
}

export const config = { path: "/api/*" };
