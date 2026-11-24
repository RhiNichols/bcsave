import { shop, social } from "./links";

/**
 * Old bcsave.org (WordPress) addresses, and where each one goes now.
 *
 * RULE: never delete a public address. When a page moves or goes away, add
 * its old path here instead. Links to it live on in emails, Facebook posts,
 * printed flyers and search results long after the page is gone.
 *
 * GitHub Pages cannot send real (HTTP 301) redirects, so each entry becomes a
 * tiny stub page at the old path (src/pages/[...redirect].astro) that forwards
 * the visitor instantly. Paths too numerous to list — the thousands of
 * old per-dog and shop pages — are matched by pattern in src/pages/404.astro
 * instead. Anything matched by neither stays a plain 404.
 *
 * The build FAILS (astro.config.mjs, "redirect-check") if:
 *   - an old path here is also a real page on this site — delete the entry,
 *     the page answers it already
 *   - an internal target does not exist in the build, or is itself a stub
 *
 * Write paths with a leading and trailing slash, exactly as WordPress did.
 * Internal targets are site paths ("/dogs/"); the base path is added at build.
 * External targets (https://…) are fine.
 *
 * The source list is the Wayback Machine's captures of bcsave.org, 2018–2026.
 */

const DONATE = "/donate/";
const DOGS = "/dogs/";
const ALUMNI = "/alumni/";
const ABOUT = "/about/";
const FAQS = "/faqs/";
const STORE = shop;
const FACEBOOK = social.facebook;

const groups: [target: string, sources: string[]][] = [
  // ---------------------------------------------------------------- money --
  [DONATE, [
    "/give/",
    "/give/donate/",
    "/donations/",
    "/donations/donate/",
    "/donations/donate-2/",
    "/donations/calendar/",
    "/donation-confirmation/",
    "/support-us/",
  ]],

  // ----------------------------------------------------------------- dogs --
  [DOGS, [
    "/available-dogs/",
    "/available-dogs/trial-adoptions/",
    "/available-dogs/trial-adotions/", // sic — a typo'd page that was live in 2025
    "/available-dogs/coming-soon/",
    "/our-dogs/",
    "/our-dogs/current/",
    "/bordercollies/",
    "/bordercollies/available/",
    "/bordercollies/coming-soon/",
    "/bordercollies/pending/",
    "/bordercollies/project/",
    "/bordercollies/xfer/",
    "/old-ourdogs/",
    "/old-coming-soon/",
    "/rescue/",
    "/rescue/available/",
    "/rescue/coming-soon/",
    "/adopt/border-collies/",
  ]],

  [ALUMNI, [
    "/available-dogs/alumni/",
    "/our-dogs/alumni/",
    "/bordercollies/adopted/",
    // Foster "failures" and forever fosters were adopted by their fosters.
    "/bordercollies/failed-fosters/",
    "/bordercollies/failed-fosters/page/2/",
    "/bordercollies/failed-fosters/page/4/",
    "/bordercollies/forever-fosters/",
    "/friends/alumni/",
    "/friends/alumni/before-after/",
    "/friends/alumni/success-stories/",
    "/friends/alumni/page/2/",
    "/friends/alumni/page/3/",
    "/friends/alumni/page/4/",
    "/friends/alumni/page/5/",
    "/friends/alumni/page/6/",
    "/friends/alumni/page/7/",
  ]],

  // ---------------------------------------------------------- applications --
  ["/adopt-form/", [
    "/apply/",
    "/adopt-apply/",
    "/apply-adopt/",
    "/adopt/apply/",
  ]],
  ["/foster/", [
    "/foster-apply/",
    "/join/foster/",
    "/join_us/foster/",
  ]],
  ["/volunteer/", [
    "/volunteer-apply/",
    "/join/",
    "/join/volunteer/",
    "/join_us/",
    "/join_us/volunteer-services/",
  ]],
  ["/os-form/", [
    "/os-apply/",
  ]],

  // -------------------------------------------------------------- content --
  [FAQS, [
    "/adopt/",
    "/adopt/adoption-process/",
    "/adopt/about-our-dogs/",
    "/about/faqs/",
    "/about/contact-information/",
    "/about/contact-information/service-area-maps/",
  ]],
  [ABOUT, [
    "/about/about-us/",
    "/about/about-us/legal/",
    "/about/corporate-information/",
    "/education/",
    "/education/about-border-collies/",
    "/education/training/",
    "/education/vocations/",
    "/friends/",
    "/friends/acknowledgements/",
    "/friends/acknowledgements/our-volunteers/",
    "/friends/other-rescues/",
  ]],

  // ------------------------------------------------------------- the shop --
  // /shop/<anything>/ is also caught by pattern in 404.astro; these are the
  // captured ones, listed so they forward even with JavaScript off.
  [STORE, [
    "/shop/",
    "/shop/accessories/",
    "/shop/hats/",
    "/shop/ladies-shirts/",
    "/shop/mens-shirts/",
    "/shop/outerwear/",
    "/bcsave-store/",
    "/retail-shop/",
    "/products/",
    "/wooshop/",
  ]],

  // --------------------------------------------------------------- events --
  // Events have lived on Facebook for years; the WordPress page was an empty
  // calendar plus a Facebook feed. /events/<anything>/ matches by pattern.
  [FACEBOOK, [
    "/events/",
    "/events-2/",
    "/events-2/categories/",
    "/events-2/locations/",
    "/events-2/my-bookings/",
    "/events-2/tags/",
    "/news/",
    "/news/calendar-of-events/",
  ]],

  // TODO(destination unconfirmed): /qr/ may be printed on flyers, banners or
  // business cards. Find out what the QR codes were meant to open and point
  // this there. Until then the homepage is the safe answer.
  ["/", [
    "/qr/",
  ]],
];

/*
 * Deliberately NOT redirected — they stay 404s.
 *
 * TODO(destination unknown), decide with the rescue:
 *   /ddi/                            what this page held is not known
 *   /dog-names/                      a names list; rebuild it or let it go
 *   /newsletter/, /news/newsletter/  is there still a newsletter? sign-up link?
 *   /privacy-policy/,
 *   /about/about-us/privacy-policy/  the new site needs its own policy first
 *
 * Dropped (dead, internal or WordPress plumbing): sandbox*, /dev/, /main/,
 * /test/, /asm/, /current-test/, /applications-copy/, /cart/, /my-account/,
 * /members/*, /donor-dashboard*, /payment-*, /donation-failed/,
 * /donation-history/, /author/*, /tag/*, /category/*, /uncategorized/*,
 * /comments/*, /raffle/, /foster-profile-form/, /alumni-old-wp/,
 * /bordercollies/in-memorium/, /bordercollies/uncategorized/.
 */

/** Old path → target. */
export const redirects: Record<string, string> = {};
for (const [target, sources] of groups) {
  for (const source of sources) {
    if (!/^\/(.*\/)?$/.test(source)) {
      throw new Error(`redirects.ts: "${source}" must start and end with "/"`);
    }
    if (source in redirects) {
      throw new Error(`redirects.ts: "${source}" is listed twice`);
    }
    redirects[source] = target;
  }
}
