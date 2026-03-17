import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Usado apenas em dev local quando a Edge Function ainda não está deployada
      '/api-bestfy': {
        target: 'https://api.bestfy.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-bestfy/, ''),
      },
    },
  },
})
