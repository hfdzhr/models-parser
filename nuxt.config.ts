import { resolve } from 'node:path'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // CSS global
  css: ['~/assets/style.css'],

  // Alias agar server/api bisa import src/ dengan path yang stabil
  nitro: {
    alias: {
      '#src': resolve('./src')
    }
  },

  // Runtime config — tambahkan env vars di sini jika butuh server-side secrets
  runtimeConfig: {
    public: {}
  }
})
