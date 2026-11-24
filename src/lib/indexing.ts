/*
 * LAUNCH SWITCH. While this is true, every page — and every redirect stub for
 * an old WordPress address — tells search engines not to index it or follow
 * its links. Right for a preview the board is reviewing, wrong for the real
 * site.
 *
 * It is a <meta> tag rather than an X-Robots-Tag header because GitHub Pages
 * cannot set response headers. On launch day, replace this line with
 * `export const NOINDEX_PREVIEW = false;` (or build with
 * PUBLIC_ALLOW_INDEXING=yes) and push. Nothing else needs to change.
 *
 * Used by src/layouts/Base.astro and src/pages/[...redirect].astro.
 */
export const NOINDEX_PREVIEW = import.meta.env.PUBLIC_ALLOW_INDEXING !== "yes";
