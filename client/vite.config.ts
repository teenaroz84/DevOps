import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Pass '' as prefix to load ALL env vars (not just VITE_*), so CHAT_API_URL is available
  const env = loadEnv(mode, process.cwd(), '')
  // CHAT_API_URL (no VITE_ prefix) is never injected into the browser bundle;
  // it is only read here to set the proxy target.
  const chatTarget = env.CHAT_API_URL || 'http://localhost:3001'
  const talendChatTarget = env.TALEND_CHAT_API_URL || 'http://localhost:8004'
  const talendIntegratedChatTarget = env.TALEND_INTEGRATED_CHAT_API_URL || 'http://localhost:8010'
  console.log('[vite proxy] chat target →', chatTarget)
  console.log('[vite proxy] talend chat target →', talendChatTarget)
  console.log('[vite proxy] talend integrated chat target →', talendIntegratedChatTarget)

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api/talend-integrated': {
          target: talendIntegratedChatTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/talend-integrated/, '/api/talend'),
        },
        '/api/talend': {
          target: talendChatTarget,
          changeOrigin: true,
        },
        // More-specific path must come BEFORE the generic /api entry
        '/api/v1': {
          target: chatTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1/, ''), // strips /api/v1 → server sees /chat
        },
        '/api/health_check/chat': {
          target: chatTarget,
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        crypto: 'node:crypto',
      }
    }
  }

})
