/**
 * Turn a site path like "/dogs/bear-312" into a link that works wherever the site
 * is hosted.
 *
 * Why this exists: on GitHub Pages a project site lives in a subfolder —
 * `https://<owner>.github.io/bcsave/` — not at the root of a domain. A plain
 * `href="/dogs"` there points at `https://<owner>.github.io/dogs`, which is
 * somebody else's site (or nothing). Every internal link, image and fetch has
 * to carry the `/bcsave` prefix.
 *
 * The prefix comes from `base` in astro.config.mjs, which the deploy workflow
 * sets. On a custom domain (or locally) it is just "/", and this returns the
 * path unchanged — so moving to bcsave.org later needs no code changes.
 *
 * Write paths exactly as you always would ("/dogs", "/faqs#adopting",
 * "/logo.png") and pass them through here; page paths come back with a
 * trailing slash ("/bcsave/dogs/", "/bcsave/faqs/#adopting"). Pass a whole
 * file name, never a bare image stem from dogs.json — "/dogs/bear-312-0" has
 * no extension, so it would be treated as a page and get a slash. Append
 * ".webp" first. External URLs, "#anchors",
 * "mailto:" and the like are returned untouched, so it is safe to pass
 * anything — a page can hand StickyCta either a WordPress form URL or "/dogs".
 *
 * Works in both .astro frontmatter and browser scripts: Vite replaces
 * import.meta.env.BASE_URL with the real value in both.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/*$/, "/");

export function url(path: string): string {
  // Anything with a scheme (https:, mailto:, tel:), protocol-relative, or a
  // same-page anchor is not ours to rewrite.
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;

  // Already prefixed — e.g. the form links in data/links.ts, which are built
  // with url() and then handed to components that call url() again. Without
  // this, they came out as /bcsave/bcsave/adopt-form/.
  if (BASE !== "/" && path.startsWith(BASE)) return path;

  // Keep "?query" and "#hash" aside while the path is adjusted.
  const cut = path.search(/[?#]/);
  const head = cut === -1 ? path : path.slice(0, cut);
  const tail = cut === -1 ? "" : path.slice(cut);

  let rel = head.replace(/^\/+/, "");
  // Pages get a trailing slash; files ("/hero.webp", "/success.html") do not.
  //
  // Why: every page is built as a folder (dogs/index.html), and GitHub Pages
  // answers "/bcsave/dogs" with a 301 to "/bcsave/dogs/". Linking to the
  // slashed form directly saves every click that redirect hop.
  const last = rel.slice(rel.lastIndexOf("/") + 1);
  if (rel && !rel.endsWith("/") && !/\.[a-z0-9]+$/i.test(last)) rel += "/";
  return BASE + rel + tail;
}
