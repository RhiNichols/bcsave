# Where this project is

Living status doc. If a machine reboots, a session ends, or someone new picks
this up — start here. Last updated 2026-08-12.

## The site is live

**https://bcsave-preview.ink-lip.workers.dev**

Unlisted and `noindex`, but anyone with the link can open it. It does **not**
expire and does not depend on any local machine — it is served from
Cloudflare's edge.

Hosted as a static-asset Cloudflare Worker named `bcsave-preview` on the
Cloudflare account **"Ink Lip"** (`00804eb9ff865dd924e8e8cd6fb23f93`), which is
only visible when signed into Cloudflare as **rhiannon@osmi.ai**. Signing in
with any other address will not show it.

Repo: `git@github.com:RhiNichols/bcsave.git` (branch `main`).

## Pages

| Path | What it is |
| --- | --- |
| `/` | Homepage — hero, live dog count, featured dogs, adoption steps, ways to help, donate band, partners |
| `/dogs` | All available dogs, filterable by age, sex and region |
| `/dogs/<slug>` | One page per dog — gallery, fact table, full bio |
| `/alumni` | Dogs already placed, grouped by adoption month |
| `/about` | Mission, where the dogs come from, Five Freedoms, position statements, logo story |
| `/faqs` | Adoption fees, process, out-of-state, found dogs |
| `/lostdog` | Found a dog — BCSAVE tag vs stray, what to send a shelter |
| `/guide` | **Internal.** How volunteers post a dog via ShelterManager |
| `/donate` | The org's existing Give Lively widget |
| `/404` | Styled not-found, leads back to available dogs |

## How to run it

```sh
npm install
npm run dev            # local dev server
npm run dev -- --host  # also reachable from a phone on the same wifi
npm run build          # re-fetch dogs from ShelterManager, then build
npm run build:offline  # build without touching the network
npm run deploy         # build + deploy to Cloudflare
```

Deploying needs Cloudflare auth: `npx wrangler login` (sign in as
rhiannon@osmi.ai). Once GitHub Actions is wired up, pushes deploy on their own
and this is no longer needed.

## Where the data comes from

Nothing about dogs is hand-edited. Everything is pulled from **ShelterManager**,
account `BCSAVE` (internal id `jb3344`):

- `src/lib/asm-core.mjs` — the parser. No Node built-ins, so the build scripts
  and the Cloudflare Worker run the *identical* code. Do not copy it; import it.
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
what lets them work without JavaScript. A small Worker (`src/worker.js`) sits
in front of the static files and closes the staleness gap:

| Route | Answers |
| --- | --- |
| `/api/available.json` | which dogs are adoptable right now |
| `/api/dogs/<id>.json` | one dog, for arrivals since the build |
| `/api/dog-photo/<id>/<n>` | that dog's photos, proxied |

`/dogs` calls these after it loads and fixes the difference: adopted dogs are
removed, new arrivals appended and labelled "Just arrived" (they have no
pre-rendered page yet, so they carry no link), and all the counts recomputed.
If the feed is slow or down the visitor just keeps the static page.

Everything is kept cheap on purpose. A Worker request has a hard CPU budget and
the feed is ~1.5MB, so the route every visitor hits runs a single regex over the
document instead of parsing all 64 dogs. Cloudflare caches the upstream read, so
a burst of traffic costs BCSAVE's service account one fetch rather than one per
visitor.

A rebuild is still what publishes new dogs *properly*, with real pages and
optimised images.

## Outstanding

1. **Rhiannon needs to read `/about` and `/faqs`.** Copy was written by Claude
   and compressed hard from the old site. She already vetoed one line ("Border
   Collies are not easy dogs") — some are easy and many BCSAVE dogs are mixes.
   Expect more like it. This is the biggest remaining quality gap.
2. **Automatic deploys have never worked.** Every scheduled run fails, roughly
   eight failure emails a day. The Cloudflare secrets *are* set — the skip-guard
   is being skipped and the real `Deploy to Cloudflare` step is what fails, so
   `npm ci`, the ShelterManager fetch and the build are all fine. Ruled out
   locally: the config validates (`npx wrangler deploy --dry-run`) and the local
   login is healthy and pinned to the right account. That leaves the API token —
   most likely missing **Workers Scripts: Edit**, or minted on the personal
   account rather than "Ink Lip". Read the real error with
   `gh run view --log-failed` (gh is installed; run `gh auth login` once).
   **Until this is fixed the live site only updates when someone runs
   `npm run deploy` by hand.**
3. **Real impact figures.** An early draft had invented dollar amounts on the
   donate band. They were replaced with facts from BCSAVE's own FAQ. Do not
   reintroduce numbers without the treasurer.
4. **`/events` still points at WordPress.** The only remaining outbound link
   besides the application forms, which stay on WordPress deliberately.
5. **Custom domain.** Would make the underlying Cloudflare account irrelevant
   and give a shareable address. Worth doing before any real launch.

## Deliberate decisions

- **No second CMS.** Volunteers publish dogs in ShelterManager, which also
  holds medical and adoption data. A website-side editor would create a second
  version of the truth for the same dog. `/guide` makes ShelterManager
  unambiguous instead.
- **Donations stay on Give Lively.** It is already free to the nonprofit; an
  earlier plan to move to Zeffy was based on a false premise.
- **Application forms stay on WordPress.** They run on the Green Forms plugin,
  render client-side, and collect an e-signature. A static site cannot host
  them and they work today.
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
