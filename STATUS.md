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
account `BCSAVE` (internal id `jb3344`), by two scripts:

- `scripts/fetch-dogs.mjs` → `src/data/dogs.json` + photos in `public/dogs/`
- `scripts/fetch-alumni.mjs` → `src/data/alumni.json` + photos in `public/alumni/`
- `scripts/lib/asm.mjs` — shared parser, retry logic, image conversion

The public feed is HTML-only; the `json_`/`xml_`/`csv_` variants need
ShelterManager service credentials the rescue has not provided. If those ever
turn up, switch to `json_adoptable_animals` and most of the parsing can go.

Alumni have no adoption-date field. Their adoption **month** is derived by
requesting the feed at each month boundary via `&days=N` and diffing the
resulting sets. The feed hard-caps at 180 records however far back you ask, so
alumni is recent history, not all time.

**The site is a build-time snapshot.** Dogs adopted since the last build stay
listed until it is rebuilt.

## Outstanding

1. **Rhiannon needs to read `/about` and `/faqs`.** Copy was written by Claude
   and compressed hard from the old site. She already vetoed one line ("Border
   Collies are not easy dogs") — some are easy and many BCSAVE dogs are mixes.
   Expect more like it. This is the biggest remaining quality gap.
2. **GitHub Actions secrets not yet set.** `.github/workflows/deploy.yml` is
   ready and deploys on push, every 3 hours, and on demand — but it skips the
   deploy step (with a notice, not a failure) until `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` exist under repo Settings → Secrets → Actions.
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
