// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://businesspartner.sa',
  integrations: [sitemap({ filter: (page) => !page.includes('/ai-team') })],
  output: 'server', // Enable SSR for API routes
  adapter: vercel(),
  i18n: {
    defaultLocale: 'ar',
    locales: ['ar', 'en'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  }
});
