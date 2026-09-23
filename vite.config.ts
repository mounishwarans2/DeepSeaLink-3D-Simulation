import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: base must be './' for Electron to correctly load assets
  // from the file:// protocol when running the packaged app.
  // This is safe for the Vite dev server too — it serves from './'.
  base: './',
})
