import { url } from "../lib/url";

/**
 * Every outbound link the site depends on, plus the application forms.
 *
 * The four applications are ShelterManager online forms. They always were:
 * the old WordPress pages only wrapped them in an iframe (verified from
 * archived copies, 2026-11-24). Submissions land in ShelterManager's Incoming
 * Forms, where the screening already happens, so nothing about the review
 * workflow depends on this site.
 *
 * Each form gets a page on this site at its OLD WordPress path, so links in
 * emails, Facebook posts and printouts keep working after cutover. Those pages
 * are generated from this list by src/pages/[form].astro.
 *
 * Every form redirects to https://bcsave.org/success.html after a submission
 * (a setting inside ShelterManager, not here) — src/pages/success.html.astro
 * exists to answer that.
 */
export const ASM_FORM_BASE =
  "https://service.sheltermanager.com/asmservice?account=bcsave&method=online_form_html&formid=";

export const asmForms = [
  { key: "adopt", path: "/adopt-form/", formid: 69, title: "Adoption application" },
  { key: "foster", path: "/foster-form/", formid: 65, title: "Foster application" },
  { key: "volunteer", path: "/volunteer-form/", formid: 70, title: "Volunteer application" },
  { key: "surrender", path: "/os-form/", formid: 56, title: "Owner surrender" },
] as const;

export const forms = {
  adopt: url("/adopt-form/"),
  foster: url("/foster-form/"),
  volunteer: url("/volunteer-form/"),
  surrender: url("/os-form/"),
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
