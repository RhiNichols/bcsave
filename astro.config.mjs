// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // The floating dev-only toolbar sits over the bottom of the page and gets in
  // the way of checking the sticky CTA on a phone. Never shipped in a build,
  // so this only changes local testing.
  devToolbar: { enabled: false },});
