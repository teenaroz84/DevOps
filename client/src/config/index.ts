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
  env: (import.meta.env.VITE_ENV as string) || 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const
