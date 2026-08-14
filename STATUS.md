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

**The connection is stated on the page.** `/dogs` shows a line reading "64 dogs,
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
2. **Automatic deploys are off, deliberately, until a token is replaced.**
   Cloudflare rejects `CLOUDFLARE_API_TOKEN` with `Invalid access token
   [code: 9109]` — the secret was set on 2026-08-06 and has never once worked.
   Not a permissions gap; the token itself is invalid or expired.

   CI now **passes** and warns instead of failing, because a rejected
   credential is a configuration state and eight identical failure emails a day
   just teaches you to ignore the inbox. The build is still fully verified on
   every run; only the deploy step is skipped.

   To re-enable: create a token on the **Ink Lip** account
   (`https://dash.cloudflare.com/00804eb9ff865dd924e8e8cd6fb23f93/api-tokens`),
   "Edit Cloudflare Workers" template, **no TTL**, then
   `gh secret set CLOUDFLARE_API_TOKEN -R RhiNichols/bcsave`. Prefer an
   **account**-owned token over a user one — it survives removing a member.

   This is low urgency now: `/dogs` reconciles itself against ShelterManager in
   the browser, so listings stay accurate between builds, and `npm run deploy`
   publishes properly whenever needed.

3. **Cloudflare account access — unresolved, and the invite flow does not
   work.** `rhiannon@osmi.ai` is the *only* administrator of Ink Lip, 2FA is
   off, sign-in is via Google, and the osmi domain is being shut down. When it
   goes, the Google account goes with it, and with it every route into the
   account serving a URL that has already been shared and cannot be moved.

   Tried on 2026-08-14 and failed:
   - **Member invites never register.** Five attempts, `rhiannon@bcsave.org`
     and `rhiannonbray@yahoo.com`. The final one was verified by screenshot as
     correct — right account (`00804eb9…`), right address, Super Administrator,
     entire account — and still produced no member and no email. The API shows
     no pending invite on any of the four accounts. Not a delivery problem;
     nothing is being created.
   - **Changing the login email is blocked twice over.** The form demands a
     password, and the account has none because it was created through Google
     sign-in. Setting one needs a reset mailed to the dying osmi address. And
     `rhiannon@bcsave.org` is already its own Cloudflare user (from an earlier
     invite), so that address cannot be adopted as a new login anyway.
   - `rhiannon@bcsave.org` may not be a real mailbox — no invite has ever
     arrived there. `bcsave.org` has Google MX, but that proves only the domain
     accepts mail.

   Next thing to try is **Cloudflare support**, with proof of account
   ownership, while the osmi mailbox can still corroborate it. Do not remove or
   change the osmi user before a second way in is confirmed working.

   **Scope of the risk, honestly:** if osmi dies first, the site does *not* go
   down — Cloudflare keeps serving it with no action from anyone. What is lost
   is the ability to administer the account, recoverable only through support.
   Bad, not fatal.

   The four accounts are easy to confuse; only the id in the URL distinguishes
   them, and the one *named* BCSAVE is not the one hosting the site:

   | Account | Id | What is on it |
   | --- | --- | --- |
   | **Ink Lip** | `00804eb9…` | **the rescue's site** |
   | BCSAVE | `b24276b6…` | empty |
   | Rhiannon@osmi.ai's Account | `13176882…` | the three admins that landed here by mistake |
   | Rhiannon Personal | `95e616b6…` | empty |
4. **Real impact figures.** An early draft had invented dollar amounts on the
   donate band. They were replaced with facts from BCSAVE's own FAQ. Do not
   reintroduce numbers without the treasurer.
5. **`/events` still points at WordPress.** The only remaining outbound link
   besides the application forms, which stay on WordPress deliberately.
6. **Custom domain.** Would make the underlying Cloudflare account irrelevant
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
