import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { llmProxy } from './server/llmProxy'

// No scripts from elsewhere and no eval, so an injected or compromised script cannot run or read the keys; https: stays open for custom model hosts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'ai-town-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

export default defineConfig(({ mode, command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), llmProxy(loadEnv(mode, process.cwd(), '')), contentSecurityPolicy()],
  // A preview host may assign PORT when 5173 is taken.
  server: { port: Number(process.env.PORT) || 5173 },
}))
