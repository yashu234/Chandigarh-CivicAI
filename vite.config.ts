import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({mode}) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    // Suppress source maps in production to avoid leaking source paths
    sourcemap: mode === 'development' ? 'inline' : false,

    // Raise chunk-size warning threshold (we have a large React SPA)
    chunkSizeWarningLimit: 900,

    rollupOptions: {
      output: {
      // Manual code-splitting: vendor chunk separate from app code
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },

  // Preview server (npm run preview) — mirrors production headers
  preview: {
    port: 4173,
    headers: {
      // Content Security Policy for production preview
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://*.supabase.co",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    },
  },

  server: {
    port: 5173,
  },
}))
