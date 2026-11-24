// @ts-check
import { defineConfig } from 'astro/config';
import { rename, rm, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { redirects } from './src/data/redirects.ts';

/*
 * Where the site is served from.
 *
 * GitHub Pages serves a project site from a subfolder:
 * https://<owner>.github.io/bcsave/. Every internal URL has to carry that
 * "/bcsave" prefix or it points at the wrong site (see src/lib/url.ts).
 *
 * Both values come from the environment so no code has to know which host
 * the site is on:
 *
 *   SITE       full origin, e.g. https://bcsave.github.io
 *   BASE_PATH  subfolder, e.g. /bcsave
 *
 * The deploy workflow (.github/workflows/deploy.yml) fills both in from
 * actions/configure-pages, which knows the real answer — including when a
 * custom domain is attached, in which case the base path comes back empty.
 * Locally neither is set, so the site builds for "/" exactly as before. A
 * future custom domain like preview.bcsave.org therefore needs no code change.
 *
 * Trailing slash normalized so BASE_URL is always "/bcsave/" rather than
 * sometimes "/bcsave" — src/lib/url.ts copes with either, but one shape is
 * easier to reason about.
 */
const base = (process.env.BASE_PATH || '/').replace(/\/*$/, '/');
const site = process.env.SITE || undefined;

/*
 * Pages that must exist at an exact file name, not as a folder.
 *
 * Astro builds src/pages/success.html.astro as success.html/index.html. Every
 * ShelterManager form redirects applicants to https://bcsave.org/success.html
 * after they submit, and GitHub Pages will not answer that URL from a folder.
 * So after the build, each of these is moved to a real file.
 */
const EXACT_FILES = ['success.html'];

const exactFiles = {
  name: 'exact-files',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const out = fileURLToPath(dir);
      for (const name of EXACT_FILES) {
        const tmp = `${out}${name}.tmp`;
        await rename(`${out}${name}/index.html`, tmp);
        await rm(`${out}${name}`, { recursive: true });
        await rename(tmp, `${out}${name}`);
      }
    },
  },
};

/*
 * Fail the build on a broken old-address redirect (src/data/redirects.ts).
 *
 * Each entry is built as a stub page by src/pages/[...redirect].astro. Two
 * mistakes would otherwise ship silently:
 *
 *   - An old path that is also a real page. Astro builds the real page and
 *     quietly skips the stub, so the map says one thing and the site another.
 *     Caught by checking the file at that path is a stub (it carries the
 *     `bcsave-redirect` meta tag).
 *   - An internal target that does not exist, or is itself a stub. Every
 *     forward would land on the 404 page, or take two hops.
 *
 * External targets (https://…) are not checked; they are not ours.
 */
const STUB_MARK = '<meta name="bcsave-redirect"';

const redirectCheck = {
  name: 'redirect-check',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const out = fileURLToPath(dir);
      const read = async (p) => {
        try {
          return await readFile(p, 'utf8');
        } catch {
          return null;
        }
      };
      // The built file for a site path: a folder's index.html, or the file.
      const builtFile = async (sitePath) => {
        const rel = sitePath.replace(/^\//, '');
        if (rel === '' || rel.endsWith('/')) return `${out}${rel}index.html`;
        try {
          if ((await stat(`${out}${rel}`)).isDirectory()) return `${out}${rel}/index.html`;
        } catch {}
        return `${out}${rel}`;
      };

      const problems = [];
      for (const [source, target] of Object.entries(redirects)) {
        const html = await read(await builtFile(source));
        if (html === null) {
          problems.push(`${source}: no stub was built for it`);
        } else if (!html.includes(STUB_MARK)) {
          problems.push(`${source}: is a real page on this site — remove it from the redirect map`);
        }

        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // external
        const path = target.replace(/[?#].*$/, '');
        const page = await read(await builtFile(path));
        if (page === null) {
          problems.push(`${source} → ${target}: the target does not exist in the build`);
        } else if (page.includes(STUB_MARK)) {
          problems.push(`${source} → ${target}: the target is itself a redirect — point at its final destination`);
        }
      }

      if (problems.length) {
        throw new Error(
          `Redirect map (src/data/redirects.ts) has ${problems.length} problem(s):\n  ` +
            problems.join('\n  ')
        );
      }
      logger.info(`${Object.keys(redirects).length} old-address redirects checked`);
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site,
  base,
  // The floating dev-only toolbar sits over the bottom of the page and gets in
  // the way of checking the sticky CTA on a phone. Never shipped in a build,
  // so this only changes local testing.
  devToolbar: { enabled: false },
  /*
   * Every page is built as a folder (dogs/index.html), so its real address
   * ends in a slash — GitHub Pages answers "/dogs" with a 301 to "/dogs/".
   * url() in src/lib/url.ts writes the slashed form for every internal link;
   * "always" makes the dev server insist on it too, so a link that slips
   * through without the slash shows up locally instead of costing a
   * redirect hop on the live site.
   *
   * One dev-only quirk: the dev server then serves src/pages/success.html.astro
   * at "/success.html/", not "/success.html". The build is unaffected — the
   * exact-files step above writes a real success.html file.
   */
  trailingSlash: 'always',
  integrations: [exactFiles, redirectCheck],
});
