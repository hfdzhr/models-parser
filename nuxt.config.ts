// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // CSS global
  css: ['~/assets/style.css'],

  // Runtime config — tambahkan env vars di sini jika butuh server-side secrets
  runtimeConfig: {
    // Keys di sini hanya tersedia di server
    // public: keys di sini tersedia di client juga
    public: {}
  }
})
