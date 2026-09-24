import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this repo at:
  //   https://<user>.github.io/DeepSeaLink-3D-Simulation/
  // so the Pages build must use base '/DeepSeaLink-3D-Simulation/'.
  // Electron (file:// protocol) and local dev/preview need relative './'.
  // The deploy workflow sets GITHUB_PAGES=true, so only that build
  // uses the repository sub-path. Everything else is untouched.
  base: process.env.GITHUB_PAGES
    ? '/DeepSeaLink-3D-Simulation/'
    : './',
})
