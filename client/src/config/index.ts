/**
 * Environment configuration — reads from Vite env vars.
 *
 * Vite automatically loads the correct .env file:
 *   npm run dev          → .env.development
 *   npm run build        → .env.production
 *   vite build --mode staging → .env.staging
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string || 'http://localhost:3001',
  // In development, leave this empty so requests go through the Vite proxy (avoids CORS).
  // In production, set to the absolute chat-service URL.
  chatApiBaseUrl: (import.meta.env.VITE_CHAT_API_BASE_URL as string) || '',
  env: (import.meta.env.VITE_ENV as string) || 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const
