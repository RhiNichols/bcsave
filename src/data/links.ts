/**
 * Every outbound link the current site depends on.
 *
 * The application forms still live on WordPress (Green Forms plugin) and the
 * shop is a FulfillEngine campaign, so these point at the live systems on
 * purpose — nothing about this rebuild breaks an existing link. Swap the
 * `forms` URLs when/if the applications move off WordPress.
 */

export const forms = {
  adopt: "https://bcsave.org/adopt-form/",
  foster: "https://bcsave.org/foster-form/",
  volunteer: "https://bcsave.org/volunteer-form/",
  surrender: "https://bcsave.org/os-form/",
  // Found-dog report. Takes photo uploads and a captcha, so it stays on
  // WordPress — a static site cannot host it.
  lostDog: "https://bcsave.org/lostdog/",
};

/** Monitored inbox for found-dog reports, from the lost dog form's own page. */
export const lostDogEmail = "lost@bcsave.org";

export const social = {
  facebook: "https://www.facebook.com/bcsave",
  instagram: "https://www.instagram.com/bcsavetx",
};

export const shop = "https://app.fulfillengine.com/campaign/bcsave-online-store";

/** Give Lively widget — the org's existing donation processor. */
export const giveLively = {
  account: "border-collie-save-and-rescue-inc",
  src:
    "https://secure.givelively.org/widgets/simple_donation/" +
    "border-collie-save-and-rescue-inc.js" +
    "?show_suggested_amount_buttons=false&show_in_honor_of=true" +
    "&address_required=false",
};

export const partners = [
  { name: "Max & Neo", url: "https://www.maxandneo.com/", img: "/partners/max-and-neo.png" },
  { name: "Border Collie Coffee Company", url: "https://bordercolliecoffeecompany.com/", img: "/partners/bc-coffee.webp" },
  { name: "Tomlinson's", url: "https://tomlinsons.com/", img: "/partners/tomlinsons.png" },
  { name: "KONG", url: "https://www.kongcompany.com/", img: "/partners/kong.webp" },
];
