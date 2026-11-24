# Where this project is

Living status doc. If a machine reboots, a session ends, or someone new picks
this up — start here. Last updated 2026-11-24.

## Where the site lives

**GitHub Pages**, built and deployed by GitHub Actions
(`.github/workflows/deploy.yml`). The address is
`https://<owner>.github.io/bcsave/`. There are no deploy tokens or secrets to
keep alive — the workflow uses GitHub's own Pages permissions.

Repo: `git@github.com:RhiNichols/bcsave.git` (branch `main`).

The workflow runs:

- on every push to `main`
- hourly on a schedule (minute 17), to pick up new and adopted dogs
- by hand, from the Actions tab → "Deploy to GitHub Pages" → "Run workflow"

Two things to know about the schedule. GitHub starts scheduled runs late,
sometimes by hours when it is busy, so "hourly" means "roughly hourly". And in a
public repo GitHub **turns the schedule off after 60 days without a commit** —
the site keeps serving but stops refreshing. GitHub emails a warning first; any
commit, or re-enabling the workflow on the Actions tab, restarts it.

Unlisted and `noindex` — anyone with the link can open it, but every page
carries `<meta name="robots" content="noindex, nofollow">`. GitHub Pages cannot
send headers, so it is a meta tag rather than the `X-Robots-Tag` header Netlify
used. **At launch**, set `NOINDEX_PREVIEW` to `false` in
`src/lib/indexing.ts` (or add the repository variable
`PUBLIC_ALLOW_INDEXING=yes`).

### The `/bcsave/` prefix

A GitHub Pages project site lives in a subfolder, so a plain `href="/dogs"`
would point at `<owner>.github.io/dogs` — the wrong site. Every internal link,
image and fetch goes through `url()` in `src/lib/url.ts`, which adds the
prefix. The prefix itself comes from `BASE_PATH` (and the origin from `SITE`)
in `astro.config.mjs`; the workflow fills both in from
`actions/configure-pages`. Locally neither is set and the site builds for `/`,
exactly as before — and a custom domain later needs no code change either.

Image paths in `src/data/dogs.json` and `alumni.json` stay as `/dogs/...` and
`/alumni/...`; they are prefixed when the page renders, not in the data.

`url()` also adds a **trailing slash** to page paths (`/bcsave/dogs/`), but not
to files (`.webp`, `.html`, …). Every page is built as a folder, and GitHub
Pages answers a slashless folder address with a 301, so linking to the slashed
form saves each click a redirect hop. `trailingSlash: "always"` in the Astro
config makes `npm run dev` behave the same way. Because of that, pass whole
file names to `url()` — `url(stem + ".webp")`, never `url(stem) + ".webp"`.

### Photos are not in git

`public/dogs/` and `public/alumni/` are gitignored. The workflow restores them
from the GitHub Actions cache, the fetch scripts add new photos and **delete
photos of dogs no longer in the feed**, and the result is cached again for the
next run. On a laptop, `npm run fetch:dogs` and `npm run fetch:alumni` fill
them in. File names come from the dog's slug, which includes the ShelterManager
id (`abigail-14-0.webp`), so a new dog can never pick up an adopted namesake's
cached photo. `src/data/*.json` stay committed as the fallback snapshot if
ShelterManager is down. The homepage hero is a separate committed copy,
`public/hero.webp`, so it cannot vanish when Pennie is adopted.

### Why not Netlify

The site ran on Netlify from 2026-08-14 to 2026-11. Netlify's free plan gives
300 credits a month and a production deploy costs 15, so about 20 deploys a
month — far too few for scheduled rebuilds. GitHub Pages and Actions are free
for this. The Netlify function (`netlify/functions/api.mjs`), `netlify.toml`
and the volunteer "publish now" button that triggered Netlify builds were
removed with the move.

### It used to be on Cloudflare. Do not go looking for it there.

Until 2026-08-14 this ran as a Cloudflare Worker at
`bcsave-preview.ink-lip.workers.dev`, on an account called "Ink Lip": a
personal account tied to a domain being shut down, not owned by the rescue.
That account was deleted and the URL is dead.

The short version of why, so nobody tries to resurrect it: that domain is
being shut down, and every route to making the account survivable was blocked.
Member invites failed silently six times across two browsers, leaving no trace
in the audit log at all. Changing the login email needed a password the account
never had, because it was created with Google sign-in. Password resets and
invitations were never delivered, to two different mail providers. Signing up
fresh was refused because the addresses already existed as Cloudflare users
that could not be signed into.

Nothing was lost when it went — the whole site rebuilds from this repo — but it
is the reason hosting moved. The lesson: hosting accounts must be owned by the
rescue, with more than one admin.

The tooling it left behind was removed on 2026-09-22: `wrangler.jsonc`,
`deno.lock`, `src/worker.js` (the Worker that served the `/api` routes), the
`deploy` script that called `wrangler deploy`, and the wrangler dependency.
None of it was reachable — Netlify deployed on push and never looked at any of
it — but `npm run deploy` still pointed at a Cloudflare account that no longer
exists, which is a trap rather than a leftover. The last trace, a tracked
`.wrangler/` folder of local state, went with the move to GitHub Pages.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Homepage — hero, live dog count, featured dogs, adoption steps, ways to help, donate band, partners |
| `/dogs` | All available dogs, filterable by age, sex and region |
| `/dogs/<name>-<id>/` | One page per dog — gallery, fact table, full bio. The id is the ShelterManager animal id (`/dogs/abigail-14/`), so the address is permanent and never reused |
| `/alumni` | Dogs already placed, grouped by adoption month |
| `/about` | Mission, where the dogs come from, Five Freedoms, position statements, logo story |
| `/faqs` | Adoption fees, process, out-of-state, found dogs |
| `/lostdog` | Found a dog — BCSAVE tag vs stray; reports go by pre-filled email to lost@bcsave.org |
| `/guide` | **Internal.** How volunteers post a dog via ShelterManager |
| `/donate` | The org's existing Give Lively widget |
| `/adopt-form`, `/foster-form`, `/volunteer-form`, `/os-form` | ShelterManager application forms (#69, #65, #70, #56), embedded at their old WordPress paths |
| `/success.html`, `/thankyou` | Where ShelterManager sends applicants after they submit |
| `/404` | Styled not-found, leads back to available dogs. Also renders new arrivals live and forwards old WordPress addresses by pattern — see "Redirects and old addresses" |

## How to run it

```sh
npm install
npm run dev            # local dev server
npm run dev -- --host  # also reachable from a phone on the same wifi
npm run build          # re-fetch dogs from ShelterManager, then build
npm run build:offline  # build without touching the network
```

A fresh clone has no dog photos (they are not in git), so run
`npm run fetch:dogs` and `npm run fetch:alumni` once before `build:offline`,
or images will be missing.

**Deploying is just `git push`.** GitHub Actions builds from `main` — it
re-fetches ShelterManager first, so every deploy publishes current listings.
There is no deploy command to run by hand and no credential on any laptop that
matters. Watch a deploy with `gh run watch`, or start one with
`gh workflow run deploy.yml`.

To check the `/bcsave/` prefix locally, build the way the workflow does:

```sh
BASE_PATH=/bcsave npm run build:offline
```

then serve `dist` so it appears under `/bcsave/` (e.g. copy it to
`<tmp>/bcsave/` and run `npx serve <tmp>`).

## Where the data comes from

Nothing about dogs is hand-edited. Everything is pulled from **ShelterManager**,
account `BCSAVE` (internal id `jb3344`):

- `src/lib/asm-core.mjs` — the parser. No Node built-ins, so the build scripts
  and the visitor's browser (`src/lib/live-dogs.ts`) run the *identical* code.
  Do not copy it; import it.
- `scripts/lib/asm.mjs` — the build-only half: image conversion, worker pool
- `scripts/fetch-dogs.mjs` → `src/data/dogs.json` + photos in `public/dogs/`
- `scripts/fetch-alumni.mjs` → `src/data/alumni.json` + photos in `public/alumni/`

**Read the comment on `marksIn` in `asm-core.mjs` before touching the parser.**
The feed interleaves each dog's card and its script one step out of phase: a
dog's fields and bio come from the card *before* its mark, its photographs from
the script *at* it. Reading both from one span pairs every dog with the
previous dog's pictures, and — this is the trap — nothing looks broken. Every
record still parses, every field is populated, and the site passes a clean
audit. It shipped that way. Photos are now filtered by animal id so it cannot
recur silently.

The public feed is HTML-only; the `json_`/`xml_`/`csv_` variants need
ShelterManager service credentials the rescue has not provided. If those ever
turn up, switch to `json_adoptable_animals` and most of the parsing can go.

Alumni have no adoption-date field. Their adoption **month** is derived by
requesting the feed at each month boundary via `&days=N` and diffing the
resulting sets. The feed hard-caps at 180 records however far back you ask, so
alumni is recent history, not all time.

### The site corrects itself between builds

The pages are still a build-time snapshot — that is what makes them fast and
what lets them work without JavaScript. To close the gap between rebuilds,
`/dogs` reads ShelterManager **directly from the visitor's browser**
(`src/lib/live-dogs.ts`). There is no server in between: ShelterManager sends
`Access-Control-Allow-Origin: *` on the feed, so any page may read it.

After the page loads, it fetches the adoptable feed once and fixes the
difference: adopted dogs are removed, new arrivals are parsed out of the same
feed and added with photos loaded straight from ShelterManager, tagged "Just
arrived", and all the counts are recomputed.

A new arrival's card links to their permanent address, `/dogs/<name>-<id>/`,
from the start. That page is only written by the next rebuild, so until then
GitHub Pages answers it with `404.html` — and the 404 page recognises the
address, reads the same feed, and renders a simplified dog page (photos
straight from ShelterManager, facts, bio, Adopt/Foster buttons, a "just
arrived" line). If the id has been adopted it forwards to their alumni entry;
if the feed is unreachable it shows the plain 404. If the feed is slow or down the visitor just keeps
the static page.

It is cheap enough to do per visitor: the feed is about 63 KB over the wire
(1.1 MB unzipped) and ShelterManager caches it for ten minutes.

The hourly rebuild is still what publishes new dogs *properly*, with real pages
and optimized images.

**The connection is stated on the page.** `/dogs` shows a line reading "66 dogs,
live from ShelterManager. Volunteers post dogs there and this page follows,
checked at 7:01 PM", naming what changed since the build when anything has.
That exists because the board will not approve an integration they cannot see —
a list of dogs looks identical whether it came from the rescue's own system or
was typed by hand. It renders only after the browser has actually reached
ShelterManager, so its presence is evidence rather than a claim; if the feed is
unreachable it stays hidden.

## Redirects and old addresses

bcsave.org ran WordPress for years, and its addresses are in emails, Facebook
posts, printed flyers and search results. The Wayback Machine has 1,525 of
them. GitHub Pages cannot send real redirects, so there are three layers:

1. **Exact redirects — stub pages.** The map is `src/data/redirects.ts`
   (old path → new path or external URL; about 90 entries).
   `src/pages/[...redirect].astro` builds a tiny page at each old path that
   forwards instantly (meta refresh, plus `location.replace` keeping `#hash`
   and `?query`), with `rel="canonical"`, a visible link, and the same
   `noindex` switch as every other page.
2. **Patterns — in `src/pages/404.astro`** (rules in
   `src/lib/old-addresses.ts`), for the ~1,300 old per-dog, product, event and
   tag pages. Old dog pages (`/dogs/<name>/`, `/product/<name>/`,
   `/rescue/available/<name>/`) are looked up by name in `/dog-index.json`
   (built from `dogs.json` + `alumni.json`): exactly one match goes to that
   dog's page or alumni entry; none or several go to `/dogs/` with a note that
   the dog may have found a home. Old shop merchandise and `/shop/*` go to the
   FulfillEngine store; `/events/*` and `/locations/*` go to Facebook;
   `/product-tag/*`, `/bc-tag/*` and `/product-category/*` go to `/dogs/`
   (alumni categories to `/alumni/`).
3. **Everything else is a plain 404**, WordPress internals included.

**The build fails** (`redirect-check` in `astro.config.mjs`) if an old path in
the map is also a real page, or if an internal target does not exist or is
itself a redirect.

**Rule: never delete a public address — add it to the map.** That includes
renaming a page here.

Open TODOs (marked in `redirects.ts`):

- `/qr/` currently goes to the homepage. It may be printed on materials — find
  out what the QR codes were meant to open.
- `/ddi/`, `/dog-names/`, `/newsletter/` and `/news/newsletter/`,
  `/privacy-policy/` (and `/about/about-us/privacy-policy/`) are left as 404s
  until someone decides where they go.

## Outstanding

1. **Rhiannon needs to read `/about` and `/faqs`.** Copy was written by Claude
   and compressed hard from the old site. She already vetoed one line ("Border
   Collies are not easy dogs") — some are easy and many BCSAVE dogs are mixes.
   Expect more like it. This is the biggest remaining quality gap.
2. **Real impact figures.** An early draft had invented dollar amounts on the
   donate band. They were replaced with facts from BCSAVE's own FAQ. Do not
   reintroduce numbers without the treasurer.
3. **The euthanasia policy on `/about` is unconfirmed.** Restored 2026-09-22
   from BCSAVE's published policy, condensed with the hedges intact. Rhiannon
   does not know whether it still reflects current practice and decided to
   ship it and confirm later — it is a `noindex` preview, so the exposure is
   low. Someone on the board needs to read it before this goes near a real
   domain. The same applies to the AKC "Worst is Show" statement next to it,
   though that one is lower stakes.
4. **ShelterManager form settings.** Every application redirects to
   `https://bcsave.org/success.html` after submitting. While bcsave.org is
   down, applicants land on a dead page — someone with ShelterManager admin
   should point the redirect at the live site until cutover. Also retire the
   public TEST/SANDBOX/PROD BAK forms (#61, #64, #67, #68, #71).
5. **Custom domain.** `preview.bcsave.org` would give the board a real address
   instead of a generated one, and would make the host swappable — moving
   between providers would stop breaking links. Needs DNS access to
   `bcsave.org`, currently at InMotion Hosting alongside the WordPress site.
   On GitHub Pages it is a CNAME record plus the custom-domain box in the
   repo's Pages settings; `actions/configure-pages` then reports an empty base
   path and the `/bcsave/` prefix disappears with no code change.

## Deliberate decisions

- **No second CMS.** Volunteers publish dogs in ShelterManager, which also
  holds medical and adoption data. A website-side editor would create a second
  version of the truth for the same dog. `/guide` makes ShelterManager
  unambiguous instead.
- **Donations stay on Give Lively.** It is already free to the nonprofit; an
  earlier plan to move to Zeffy was based on a false premise.
- **Applications stay in ShelterManager.** They always were ShelterManager
  online forms; the site embeds them at their old WordPress paths (see
  AGENTS.md). Do not move them to a third-party form tool — submissions
  belong next to the dog records where screening already happens.
- **Build for photos and pages; the browser handles freshness.** Rendering
  everything client-side from ShelterManager was considered and rejected
  (2026-11-24) on measurements: ShelterManager serves photos only as a 1024px
  ~274 KB JPEG or a 200px thumbnail, against the build's ~37 KB 500px WebP, so
  /dogs would cost ~18 MB instead of ~2.5 MB on rural cell data. Facebook and
  iMessage link previews don't run JavaScript, and GitHub Pages can't route
  /dogs/<name>/ without a build, so shared dog links would have no photo and
  Google would index no dogs. Correctness between builds comes from the
  browser instead: /dogs reconciles fully, dog pages say "has found a home"
  and drop the Apply buttons, the homepage corrects its counts and featured
  cards, and new arrivals render live on the 404 page. The hourly rebuild is
  for polish (real pages, optimized photos, alumni), so a missed run costs
  nothing important.
- **Hosting is disposable.** The site rebuilds completely from this repo, which
  is what made losing the Cloudflare account survivable rather than fatal. Keep
  it that way: no state that lives only at the host.
- **No webfonts.** System fonts only, so text paints without a network
  round-trip on poor rural cell coverage.
- **Mobile-first.** Every breakpoint is `min-width`. Most visitors are on
  phones.

## Bug sweeps

```sh
npm run dev -- --host    # the sweep needs a server to walk
npm run audit            # key pages + a six-dog sample
npm run audit -- --all   # every dog page too — real bugs hide in the tail
```

`scripts/audit.mjs` walks every page at 320/390/768/1440 and reports
horizontal overflow, missing alt text, sub-24px tap targets, heading-level
skips, console errors, failed requests, and broken links and anchors. It lives
in the repo on purpose — an earlier copy sat in a temp directory and was lost
on the first reboot.
