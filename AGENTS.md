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

## Still unknown

- **Real replacement vs. pitch mockup.** Whether Rhiannon has official access to the org's WordPress
  admin, content export, and DNS, or is building this on spec to show them. The build is identical
  until launch, but migration planning depends on it.
- **Which CMS for dog listings.** Requirement is settled — multiple volunteers must be able to
  publish a dog without a developer in the loop. Listings turn over constantly and a single-publisher
  bottleneck means dogs get posted to Facebook instead and the site goes stale. The tool isn't
  settled: Decap (git-based, free) or Sanity (hosted, free tier) are the likely candidates. Addable
  later without restructuring — build with Astro content collections so the swap is cheap.

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
