# bcsave — Border Collie Save & Rescue website revamp

A rebuild of [bcsave.org](https://bcsave.org), the website for **Border Collie Save & Rescue**, an
all-volunteer 501(c)(3) dog rescue in Springtown, TX serving Central and North Texas. Their current
site is WordPress. This is Rhiannon's project; it is separate from her Roblox game business and from
her personal notes — don't route things between those repos.

## Working with Rhiannon

- She has some coding experience but is not a full-time developer. Claude leads the technical build
  directly — actually write and edit the code, don't just point her at docs.
- She has Inattentive-type ADHD and real memory issues. Distill; lead with the point; don't wall-of-text.
- Give pros/cons and a clear recommendation when she's deciding — that's her favorite input mode.
- One tiny concrete next step when she's stuck, not a menu.
- Always be honest — she wants direct, unvarnished truth, including realistic odds and timelines,
  over encouragement that sets false expectations.
- Prefer terminal workflows over walking her through GUI click-paths.

## Stack

- **Astro** (minimal template, relaxed TypeScript). No framework integrations yet.
- Chosen because Astro is HTML-first, ships almost no JavaScript, and hosts free — good fit for a
  content site run by a nonprofit with no budget.
- **Planned hosting:** Cloudflare Pages, using its auto-generated unlisted `*.pages.dev` URL as a
  private preview to show the rescue's board before anything goes live. Add `noindex` on the preview.
- No custom domain needed for now. `bcsave.com` is taken (parked for sale on Namestar, registered
  2004); the org already owns `bcsave.org`.

## Scope — decided

Rhiannon's direction (2026-08-03): **rebuild the whole site**, make it more attractive and faster,
**volunteers must be able to post dogs**, and **preserve all existing donation and form links**.

"Revamp" means keep what the site says, improve how it looks and performs — not reinvent their
content.

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
- The `json_`, `xml_` and `csv_` variants exist but require credentials. If Rhiannon can get the
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

Current implementation: dogs are fetched, parsed and committed as `src/data/dogs.json`, with photos
converted to WebP under `public/dogs/`. That's a build-time snapshot, so **the site goes stale until
it is rebuilt.** Options once it matters: a scheduled rebuild (Cloudflare Pages cron / GitHub
Action), or fetch at build time in an Astro loader.

### The one real WordPress dependency: Green Forms

All five applications (`/adopt-form/`, `/foster-form/`, `/volunteer-form/`, `/os-form/`, `/apply/`)
run on the `halfdata-green-forms` plugin — **not** Gravity Forms. Notes:

- Forms render client-side via `https://bcsave.org/wp-admin/admin-ajax.php`. The field definitions
  are **not in the page HTML**, so they can't be scraped — reproducing them needs WP admin access or
  filling each form manually to capture the fields.
- It loads `signature_pad.min.js`, so adoption applications **collect an e-signature**. Whether that
  signature is legally load-bearing for them or just a formality decides which replacement works.
- Submissions land in the WordPress database. Ask where they get read from today, and whether anyone
  needs the back catalogue.

This is the only piece that genuinely can't come along — and it's a far smaller problem than
checkout would have been. It is no longer a reason to withhold a launch estimate.

## Settled

- **CMS for dog listings.** Resolved: **ShelterManager already is the CMS.** Volunteers publish dogs
  there today and the site reads that feed. Do not add Decap or Sanity for dogs.
- **Who Rhiannon is.** She is a BCSAVE volunteer, foster and donor of 15+ years who currently screens
  adoption applicants — an insider, not an outside contractor pitching a redesign. She came to BCSAVE
  after Border Collie Rescue Texas closed.

## Still unknown

- **Credentials.** Whether she holds WordPress admin, the ShelterManager service login, and DNS.
  Screening applicants implies some access, but it hasn't been confirmed. The ShelterManager login in
  particular would upgrade the dog feed from scraped HTML to real JSON.
- **How applications are actually reviewed.** She screens applicants, so any Green Forms replacement
  has to preserve *her* workflow, not just capture fields. Ask before proposing a form tool.
- **Whether the adoption e-signature is legally load-bearing** or just a formality. Decides whether a
  simple hosted form is enough.
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
