# bcsave — Border Collie Save & Rescue website revamp

A rebuild of [bcsave.org](https://bcsave.org), the website for **Border Collie Save & Rescue**, an
all-volunteer 501(c)(3) dog rescue in Springtown, TX serving Central and North Texas. Their current
site is WordPress. The rebuild is led by a BCSAVE volunteer; the rescue owns this repository.

## Stack

- **Astro** (minimal template, relaxed TypeScript). No framework integrations yet.
- Chosen because Astro is HTML-first, ships almost no JavaScript, and hosts free — good fit for a
  content site run by a nonprofit with no budget.
- **Hosting:** GitHub Pages, built and deployed by GitHub Actions (`.github/workflows/deploy.yml`) on
  every push to `main` and hourly on a schedule. Served at `https://<owner>.github.io/bcsave/` as an
  unlisted preview for the rescue's board; every page carries `noindex` until launch (the
  `NOINDEX_PREVIEW` switch in `src/lib/indexing.ts`). No server: the live dog refresh runs in the
  browser. History (Cloudflare, then Netlify, then this) is in STATUS.md.
- **Base path:** because the preview lives in a `/bcsave/` subfolder, every internal link, image and
  fetch goes through `url()` from `src/lib/url.ts`. Never write a bare `href="/..."`.
- No custom domain needed for now. `bcsave.com` is taken (parked for sale on Namestar, registered
  2004); the org already owns `bcsave.org`.

## Scope — decided

Direction set 2026-08-03: **rebuild the whole site**, make it more attractive and faster,
**volunteers must be able to post dogs**, and **preserve all existing donation and form links**.

"Revamp" means keep what the site says, improve how it looks and performs — not reinvent their
content.

**Decided 2026-11-24: this site replaces bcsave.org entirely and WordPress is retired.** Nothing
stays on WordPress long-term. The applications turned out to be ShelterManager forms already (see
below), so only the found-dog report needed a replacement. Cutover order:

1. Confirm access: Namecheap (registrar, renews 2027-11-15), InMotion/cPanel, WP admin,
   ShelterManager admin.
2. Move DNS off InMotion (`ns1/ns2.inmotionhosting.com`) before anything is cancelled. Copy every
   record; **email is Google Workspace** (`aspmx.l.google.com`) — keep the MX and SPF/DKIM TXT records
   intact.
3. ~~Replace the forms~~ — done 2026-11-24: the four applications are embedded at their old paths;
   the found-dog report is a pre-filled email to lost@bcsave.org until it becomes a ShelterManager
   form. Remaining: change each form's post-submit redirect in ShelterManager if bcsave.org is still
   down, and retire the public TEST/SANDBOX/PROD BAK forms.
4. Rebuild `/qr/`, `/ddi/`, `/dog-names/`. (~~Add stub pages forwarding old WordPress URLs~~ — done
   2026-11-24: `src/data/redirects.ts` plus pattern rules on the 404 page; see STATUS.md, "Redirects
   and old addresses". Never delete a public address — add it to the map.) (`/events/`
   was an empty calendar plus a Facebook feed; the footer now links Facebook.)
5. Point bcsave.org at GitHub Pages; turn indexing on.
6. Archive WordPress (DB export, `wp-content/uploads`, form submissions CSV), keep it read-only for
   about a month, then cancel InMotion.

### Current site inventory (from bcsave.org/wp-sitemap-posts-page-1.xml)

Dogs: `/our-dogs/`, `/available-dogs/`, `/available-dogs/trial-adoptions/`,
`/available-dogs/coming-soon/`, `/alumni/`, `/dog-names/`
Forms: `/adopt-form/`, `/foster-form/`, `/volunteer-form/`, `/os-form/` (owner surrender), plus
`/apply/`, `/adopt-apply/`, `/foster-apply/`, `/volunteer-apply/`, `/os-apply/`
Content: `/about/`, `/faqs/`, `/events/`, `/lostdog/`, `/ddi/`, `/qr/`
Money: `/donate/`, `/give/`, `/payment-confirmation/`, `/payment-failed/`, `/thankyou/`
Commerce: `/shop/`, `/wooshop/`
Cruft to drop: `/sandbox/`, `/sandbox-copy/`, `/sandbox-alumni/`, `/sandbox-available-dogs/`,
`/alumni-old-wp/`, plus `/wooshop/`, `/payment-confirmation/`, `/payment-failed/` (all dead — see
verification section below)

### External links to preserve

- Facebook: https://www.facebook.com/bcsave
- Instagram: https://www.instagram.com/bcsavetx
- Partners: https://www.maxandneo.com/ · https://bordercolliecoffeecompany.com/ ·
  https://tomlinsons.com/ · https://www.kongcompany.com/

Primary CTAs sitewide: **Donate, Adopt, Foster, Volunteer**.

## What actually powers the current site (verified 2026-08-03)

Checked by fetching the live pages and reading their asset paths — not inferred from the sitemap.
An earlier version of this file guessed WooCommerce/GiveWP and treated checkout as the blocking risk.
**That was wrong.** There is no WooCommerce, no GiveWP, and no Stripe or PayPal SDK anywhere on the
site.

**Donations → Give Lively.** Both `/donate/` and `/give/` load one external script and nothing else:

```
https://secure.givelively.org/widgets/simple_donation/border-collie-save-and-rescue-inc.js
  ?show_suggested_amount_buttons=false&show_in_honor_of=true&address_required=false
```

Portable as-is. Paste it into Astro and it keeps working.

**Shop → FulfillEngine.** `/shop/` is an iframe to
`https://app.fulfillengine.com/campaign/bcsave-online-store` (print-on-demand fundraising store).
Also portable as-is.

**Do not migrate donations.** Give Lively is already free-to-the-nonprofit, so the earlier Zeffy pitch
in this file was based on a false premise and has been dropped. Moving payment rails is risk with no
upside. Confirm what Give Lively actually costs them before reconsidering.

**Dead pages, not evidence of commerce.** `/wooshop/` is titled "WOOCOMMERCE SHOP" but loads zero
WooCommerce assets — they already migrated off Woo. `/payment-confirmation/` and `/payment-failed/`
are empty leftovers from the same era. All three are cruft to drop.

**Presentation layer (all being replaced anyway):** theme `page-builder-framework`, plus Elementor,
Elementor Pro, Essential Addons for Elementor, and MegaMenu.

### Dog listings → ShelterManager (this settles the CMS question)

`/our-dogs/` is an iframe to **ShelterManager** (Animal Shelter Manager), account `BCSAVE`
(internal id `jb3344`). The dog data was never in WordPress:

```
https://service.sheltermanager.com/asmservice?account=BCSAVE&method=html_adoptable_animals
```

- The default `html_adoptable_animals` method is **public, no auth**, and returns full records:
  name, sex, age, weight, colour, coat, energy, spay/neuter, heartworm status, region, adoption fee,
  a prose bio, and up to 8 photos per dog. As of 2026-08-03 that's 63 adoptable dogs.
- The `json_`, `xml_` and `csv_` variants exist but require credentials. If someone can get the
  ShelterManager service username/password, switch to `json_adoptable_animals` — parsing HTML is a
  workaround, not the destination.
- `?template=animalviewadoptable` is BCSAVE's own custom template and returns images only. Don't use
  it as a data source.
- Animal photos: `asmservice?account=jb3344&method=animal_image&animalid=<id>` (add `&seq=N` for
  extra shots).

**This means volunteers already publish dogs without a developer.** They do it in ShelterManager,
which is also where medical records and adoption workflow live. Adding Decap or Sanity would create
a *second* place to type the same dog — strictly worse. The site should read ShelterManager, not
replace it.

Current implementation: dogs are fetched and parsed into `src/data/dogs.json` (committed as a
fallback snapshot), with photos converted to WebP under `public/dogs/` (not committed; carried between
builds in the Actions cache). GitHub Actions rebuilds hourly, and between rebuilds `/dogs` reads the
ShelterManager feed directly in the browser and patches itself. See STATUS.md.

Every dog's slug — page address and photo file names — is `<name>-<ShelterManager id>`
(`/dogs/abigail-14/`, `public/dogs/abigail-14-0.webp`), for current dogs and alumni alike. It comes from
`slugify` in `src/lib/asm-core.mjs`, which the build and the browser share; never build a slug any
other way. A dog added since the last build is rendered live by the 404 page at that same address.

### Applications → ShelterManager online forms (verified 2026-11-24)

An earlier version of this file said the applications ran on the `halfdata-green-forms` WordPress
plugin. **That was wrong** — the plugin's scripts load on every page, which hid what the page bodies
actually contain. Archived copies of the WordPress pages (Wayback Machine, May–July 2026) show each
application is a ShelterManager online form in an iframe:

| Old path | ShelterManager form |
|---|---|
| `/adopt-form/` | #69 BCSAVE Adoption Application |
| `/foster-form/` | #65 BCSAVE Foster Application |
| `/volunteer-form/` | #70 BCSAVE Volunteer Application |
| `/os-form/` | #56 BCSAVE Owner Surrender |

URL: `https://service.sheltermanager.com/asmservice?account=bcsave&method=online_form_html&formid=N`.
Public, no auth, frameable. The e-signature and file uploads are ShelterManager fields, and
submissions land in ShelterManager's Incoming Forms, so the screening workflow never touched WordPress.

The site embeds them at their old paths via `src/pages/[form].astro` (IDs live in
`src/data/links.ts`). The forms post their height to the parent (`postMessage({ iframeHeight })`),
which that page listens for. Things the forms hard-code, configured inside ShelterManager:

- **Post-submit redirect: `https://bcsave.org/success.html`.** `src/pages/success.html.astro` answers
  it; the `exact-files` step in `astro.config.mjs` makes it a real file rather than a folder.
- `https://bcsave.org/thankyou` (owner-surrender form) → `src/pages/thankyou.astro`.
- `https://bcsave.org/faqs/#heartworm` (foster form) → anchor on the fee/vaccination FAQ. The old site
  never wrote a heartworm FAQ ("Coming Soon"); the rescue should write one.

Also public on the account and worth retiring: #61 SANDBOX Adoption, #64 PROD BAK Adoption, #67 PROD
BAK Owner Surrender, #68 SANDBOX Owner Surrender, #71 TEST DEV.

### Working inside ShelterManager (from the ASM admin, 2026-11-24)

Operational knowledge that only exists in the ASM admin UI. Written down because it was
delivered by email and would otherwise be lost.

**Forms live at ASM → Edit Online Forms, and render through a three-layer cascade:**

1. ASM's own base code, generated from the form builder, with default formatting. Not editable.
2. **Edit Header/Footer** — one global script applied to *every* form.
3. The **edit icon beside each form name** — header and footer boxes for that form alone.

Consequences, all of them learned the hard way:

- **Back up the original before editing any global or per-form HTML.** The three layers
  step on each other and the result often isn't what you'd predict from reading it.
- **ASM's CSS is an older dialect.** Modern CSS3 syntax and formatting silently don't
  apply. Don't assume a rule works because it's valid.
- **ASM caches form output for up to four hours.** There is a no-cache development-mode
  icon beside each form for seeing changes immediately — use it, or you'll edit blind.
- There is a newer **Renderer** option (legacy vs bootstrap) that is untested here. It may
  fix layout problems. Try it on a retired form first: it changes the markup, and
  `src/pages/[form].astro` depends on the form posting its height via `postMessage`.

**Post-submit redirects are set inside ASM, per form.** They currently point at
`https://bcsave.org/success.html` and `https://bcsave.org/thankyou` — see the table above.
While bcsave.org is down, every applicant who submits lands on a dead page even though
the application itself is captured in Incoming Forms.

**Dogs:** ASM → Publishing → Edit HTML publishing templates. BCSAVE's own template is
`BCSAVELittlebox`, which the old WordPress site called in an iframe. **This site does not
need it** — it reads `html_adoptable_animals` and builds real pages, so the old
iframe-sizing and scrollbar fights don't apply here and the lost backup costs nothing.

**Still worth asking for: the ASM *service* username and password.** The `json_`, `xml_`
and `csv_` endpoints need them. With that login the HTML parser in `src/lib/asm-core.mjs`
could be replaced by `json_adoptable_animals`, and most of its subtlety — including the
off-by-one card/script trap — would simply go away.

### The web store can be embedded rather than linked

The footer links out to FulfillEngine today. It can be iframed, using the publisher's own
height-messaging script, which is what the old site did:

```html
<iframe id="fulfillengineiframe" src="https://app.fulfillengine.com/campaign/bcsave-online-store"
        width="100%" height="500px" frameborder="0" allowfullscreen></iframe>
```

It posts `["setIframeHeight", n]` and `["iframeScrollUp"]` to the parent, the same pattern
`[form].astro` already handles for ASM forms.

**The only real Green Forms form was `/lostdog/`** (14 fields, photo upload, captcha). It is now a
pre-filled `mailto:` on `/lostdog`; rebuilding it as a ShelterManager form is the clean end state.

## Settled

- **CMS for dog listings.** Resolved: **ShelterManager already is the CMS.** Volunteers publish dogs
  there today and the site reads that feed. Do not add Decap or Sanity for dogs.

## Still unknown

- **Credentials.** Whether the project has WordPress admin, the ShelterManager service login, and
  DNS. None of it has been confirmed. The ShelterManager login in particular would upgrade the dog
  feed from scraped HTML to real JSON.
- **Real impact figures.** The donate-page giving tiers in `src/pages/index.astro` are invented
  placeholders. They need real numbers from the treasurer before anyone outside sees them.

Honest caveat worth revisiting with her: replacing the site makes her the org's de facto webmaster
indefinitely. Worth naming out loud before cutover, not after.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
