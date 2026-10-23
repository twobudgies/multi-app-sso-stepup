import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'

// Repo root holds .env, idp/profiles and packages/ (monorepo). Ports come from .env.
const root = path.resolve(__dirname, '../..')
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '')
  return {
    plugins: [react()],
    envDir: root,
    envPrefix: ['VITE_', 'IDP_', 'API_', 'STEPUP_'],
    server: { port: Number(env.REACT_PORT || 5300), strictPort: true, fs: { allow: [root] } },
    preview: { port: Number(env.REACT_PORT || 5300), strictPort: true },
  }
})
