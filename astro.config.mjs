// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://businesspartner.sa',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'ar',
    locales: ['ar', 'en'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});
