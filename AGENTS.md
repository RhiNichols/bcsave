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
`/alumni-old-wp/`

### External links to preserve

- Facebook: https://www.facebook.com/bcsave
- Instagram: https://www.instagram.com/bcsavetx
- Partners: https://www.maxandneo.com/ · https://bordercolliecoffeecompany.com/ ·
  https://tomlinsons.com/ · https://www.kongcompany.com/

Primary CTAs sitewide: **Donate, Adopt, Foster, Volunteer**.

## Known risk: donations and shop are on-site WordPress

The sitemap shows `/payment-confirmation/`, `/payment-failed/`, and `/wooshop/`. That means donations
and merch are **not** simple third-party embeds — they're running through WordPress, almost certainly
WooCommerce and/or a donation plugin like GiveWP. A static Astro site cannot run WooCommerce checkout.

This is the hardest part of the migration and it is unresolved. Options, roughly in order of
recommendation:

1. **Move donations to a hosted platform.** Zeffy is 100% free for nonprofits (no platform fee, no
   percentage cut) — for an all-volunteer rescue that likely *increases* net donations versus what
   they pay now. Givebutter and Donorbox are alternatives with fees.
2. **Move the shop to a hosted embed** (Shopify Lite, Square Online, Ecwid) or drop it if merch
   volume is low — worth asking whether the shop actually earns anything.
3. **Keep WordPress alive purely for checkout** on a subdomain, with the new static site handling
   everything else. Ugly but lowest risk.

Do not promise a launch date until this is settled — it is the one piece that could block cutover.

The application forms (`/adopt-form/` etc.) still need checking: if they're Gravity Forms or similar
WordPress plugins, they need a replacement too (a hosted form service, or Astro + a form endpoint).

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
