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

export default async function handler(request) {
  const url = new URL(request.url);
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
