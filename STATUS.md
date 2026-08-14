# Where this project is

Living status doc. If a machine reboots, a session ends, or someone new picks
this up — start here. Last updated 2026-08-14.

## Where the site lives

**Netlify**, deployed from `main` by GitHub login. Every push publishes; there
are no deploy tokens or secrets to keep alive.

Repo: `git@github.com:RhiNichols/bcsave.git` (branch `main`).

Unlisted and `noindex` (set in `netlify.toml`) — anyone with the link can open
it, but search engines are told not to index it. Remove that header block at
launch.

### It used to be on Cloudflare. Do not go looking for it there.

Until 2026-08-14 this ran as a Cloudflare Worker at
`bcsave-preview.ink-lip.workers.dev`, on an account called "Ink Lip" reachable
only as `rhiannon@osmi.ai`. That account was deleted and the URL is dead.

The short version of why, so nobody tries to resurrect it: the osmi domain is
being shut down, and every route to making the account survivable was blocked.
Member invites failed silently six times across two browsers, leaving no trace
in the audit log at all. Changing the login email needed a password the account
never had, because it was created with Google sign-in. Password resets and
invitations were never delivered, to two different mail providers. Signing up
fresh was refused because the addresses already existed as Cloudflare users
that could not be signed into.

Nothing was lost when it went — the whole site rebuilds from this repo — but it
is the reason hosting moved.

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
```

**Deploying is just `git push`.** Netlify builds from `main` — it runs
`npm run build`, which re-fetches ShelterManager first, so every deploy
publishes current listings. There is no deploy command to run by hand and no
credential on any laptop that matters.

The `/api` routes are `netlify/functions/api.mjs`. To exercise them locally,
`npx netlify dev` serves the site and the function together.

## Where the data comes from

Nothing about dogs is hand-edited. Everything is pulled from **ShelterManager**,
account `BCSAVE` (internal id `jb3344`):

- `src/lib/asm-core.mjs` — the parser. No Node built-ins, so the build scripts
  and the Netlify function run the *identical* code. Do not copy it; import it.
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
what lets them work without JavaScript. A small Netlify function
(`netlify/functions/api.mjs`) sits in front of the static files and closes the staleness gap:

| Route | Answers |
| --- | --- |
| `/api/available.json` | which dogs are adoptable right now |
| `/api/dogs/<id>.json` | one dog, for arrivals since the build |
| `/api/dog-photo/<id>/<n>` | that dog's photos, proxied |

`/dogs` calls these after it loads and fixes the difference: adopted dogs are
removed, new arrivals appended and labelled "Just arrived" (they have no
pre-rendered page yet, so they carry no link), and all the counts recomputed.
If the feed is slow or down the visitor just keeps the static page.

Everything is kept cheap on purpose. The function has a limited execution budget and
the feed is ~1.5MB, so the route every visitor hits runs a single regex over the
document instead of parsing all 66 dogs, and per-dog lookups slice to a single
record first. Responses carry an s-maxage, so a burst of traffic costs BCSAVE's
service account one read per TTL rather than one per visitor.

A rebuild is still what publishes new dogs *properly*, with real pages and
optimised images.

**The connection is stated on the page.** `/dogs` shows a line reading "66 dogs,
live from ShelterManager. Volunteers post dogs there and this page follows,
checked at 7:01 PM", naming what changed since the build when anything has.
That exists because the board will not approve an integration they cannot see —
a list of dogs looks identical whether it came from the rescue's own system or
was typed by hand. It renders only after the browser has actually reached
ShelterManager, so its presence is evidence rather than a claim; if the feed is
unreachable it stays hidden.

## Outstanding

1. **Rhiannon needs to read `/about` and `/faqs`.** Copy was written by Claude
   and compressed hard from the old site. She already vetoed one line ("Border
   Collies are not easy dogs") — some are easy and many BCSAVE dogs are mixes.
   Expect more like it. This is the biggest remaining quality gap.
2. **Real impact figures.** An early draft had invented dollar amounts on the
   donate band. They were replaced with facts from BCSAVE's own FAQ. Do not
   reintroduce numbers without the treasurer.
3. **`/events` still points at WordPress.** The only remaining outbound link
   besides the application forms, which stay on WordPress deliberately.
4. **Custom domain.** `preview.bcsave.org` would give the board a real address
   instead of a generated one, and would make the host swappable — moving
   between providers would stop breaking links. Needs DNS access to
   `bcsave.org`, currently at InMotion Hosting alongside the WordPress site.

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
