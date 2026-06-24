/**
 * Environment configuration — reads from Vite env vars.
 *
 * Vite automatically loads the correct .env file:
 *   npm run dev          → .env.development
 *   npm run build        → .env.production
 *   vite build --mode staging → .env.staging
 */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001',
  // In development, local dashboard APIs talk directly to the Node server on :3001.
  // In production, set this to the deployed API origin.
  chatApiBaseUrl: (import.meta.env.VITE_CHAT_API_BASE_URL as string) || '',
  talendChatApiBaseUrl: (import.meta.env.VITE_TALEND_CHAT_API_BASE_URL as string) || 'http://localhost:8004',
  talendIntegratedChatApiBaseUrl: (import.meta.env.VITE_TALEND_INTEGRATED_CHAT_API_BASE_URL as string) || 'http://localhost:8010',
  env: (import.meta.env.VITE_ENV as string) || 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const
