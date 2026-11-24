# bcsave

The website for [Border Collie Save & Rescue](https://bcsave.org), an all-volunteer 501(c)(3) dog
rescue serving Central and North Texas. A static [Astro](https://astro.build) site, deployed to GitHub
Pages by GitHub Actions. It replaces the rescue's old WordPress site.

**New here? Read [STATUS.md](STATUS.md)** — where the site lives, how it is deployed, where the data
comes from, and what is still outstanding. [AGENTS.md](AGENTS.md) records the background and the
decisions behind it.

## How it fits together

| Piece | Lives in | The site's job |
|---|---|---|
| Adoptable dogs and alumni | **ShelterManager** (account `BCSAVE`) | Read the public feed; never edit dogs here |
| Applications (adopt, foster, volunteer, surrender) | ShelterManager online forms | Embed them at their old addresses |
| Donations | Give Lively | Embed the widget on `/donate` |
| Shop | FulfillEngine | Link to the store |

Dogs are pulled from ShelterManager **at build time**, so pages are fast, work without JavaScript and
share well on Facebook. GitHub Actions rebuilds the site **hourly**. Between builds, the browser checks
the live feed and corrects what has changed — adopted dogs disappear, new arrivals appear. Volunteers
publish a dog in ShelterManager and the website follows on its own.

## Running it locally

Needs Node 22.12 or later.

```sh
npm install
npm run fetch:dogs        # current dogs + photos (photos are not in git)
npm run fetch:alumni      # adopted dogs + photos; slow, several MB per request
npm run dev               # http://localhost:4321
```

| Command | Does |
|---|---|
| `npm run build` | Fetch dogs from ShelterManager, then build to `dist/` |
| `npm run build:offline` | Build from the data already on disk |
| `BASE_PATH=/bcsave npm run build:offline` | Build as GitHub Pages serves it, under `/bcsave/` |
| `npm run check:dist` | Fail if any built page points at a missing file (CI runs this before every deploy) |
| `npm run audit` | Walk the running site at four widths for layout, link and accessibility bugs (set `CHROME_PATH` outside macOS) |

## Deploying

Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) fetches fresh data,
builds and publishes to GitHub Pages, and does the same every hour on a schedule. There is no deploy
command and no credential to keep alive.

## Rules that keep it working

- **Every internal link goes through `url()`** from [`src/lib/url.ts`](src/lib/url.ts). The preview is
  served from a subfolder, so a bare `href="/dogs"` points at the wrong site.
- **Never delete a public address.** Old addresses go in the redirect map,
  [`src/data/redirects.ts`](src/data/redirects.ts); the build fails if an entry is broken.
- **No second place to edit dogs.** ShelterManager is the source of truth; nothing about a dog is
  typed into this repo.
- **Hosting stays disposable.** Everything rebuilds from this repo. Keep no state that only exists at
  the host.

## Where to change things

| To change | Edit |
|---|---|
| Form, donation, shop or social links, and ShelterManager form IDs | [`src/data/links.ts`](src/data/links.ts) |
| Colors, type and spacing | [`src/styles/global.css`](src/styles/global.css) (the `:root` block) |
| Old-address redirects | [`src/data/redirects.ts`](src/data/redirects.ts) |
| Search-engine indexing (off during the preview) | `NOINDEX_PREVIEW` in [`src/layouts/Base.astro`](src/layouts/Base.astro) |
| How the ShelterManager feed is parsed | [`src/lib/asm-core.mjs`](src/lib/asm-core.mjs) — read the comment on `marksIn` first |
