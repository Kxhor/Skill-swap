import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:5005', changeOrigin: true },
      '/api': { target: 'http://localhost:5005', changeOrigin: true },
      '/socket.io': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
