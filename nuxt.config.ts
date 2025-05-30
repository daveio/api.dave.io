import { defineNuxtConfig } from "nuxt/config"

// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

  // Vite configuration to disable sourcemaps in production
  vite: {
    build: {
      sourcemap: false // Disable sourcemaps in production to avoid warnings
    }
  },
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    },
    experimental: {
      wasm: true
    },
    routeRules: {
      "/api/**": {
        cors: true,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-XSS-Protection": "0" // Updated per best practices
        }
      },
      "/go/**": {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate"
        }
      },
      // Static redirects from original Worker
      "/301": { redirect: { to: "https://www.youtube.com/watch?v=fEM21kmPPik", statusCode: 301 } },
      "/302": { redirect: { to: "https://www.youtube.com/watch?v=BDERfRP2GI0", statusCode: 302 } },
      "/cv": { redirect: { to: "https://cv.dave.io", statusCode: 302 } },
      "/nerd-fonts": { redirect: { to: "https://dave.io/go/nerd-fonts", statusCode: 302 } },
      "/contact": { redirect: { to: "https://dave.io/dave-williams.vcf", statusCode: 302 } },
      "/public-key": { redirect: { to: "https://dave.io/dave-williams.asc", statusCode: 302 } },
      "/todo": { redirect: { to: "https://dave.io/go/todo", statusCode: 302 } },
      // CORS headers for nostr.json
      "/.well-known/nostr.json": {
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    }
  },
  runtimeConfig: {
    // Server-side environment variables
    apiJwtSecret: process.env.API_JWT_SECRET || "dev-secret-change-in-production",
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || "",
    public: {
      // Client-side environment variables
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || "/api"
    }
  },
  modules: [
    "@nuxt/ui",
    "@nuxt/fonts",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "@nuxtjs/tailwindcss",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "nitro-cloudflare-dev"
  ],
  css: [
    '~/assets/css/main.css'
  ]
})
