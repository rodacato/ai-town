import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { llmProxy } from './server/llmProxy'

export default defineConfig(({ mode }) => ({
  plugins: [react(), llmProxy(loadEnv(mode, process.cwd(), ''))],
  server: { port: 5173 },
}))
