import { getSessionId } from './session'

export type AuthUserId = 'admin' | 'developer'

export interface AuthSession {
  userId: AuthUserId
  sessionId: string
  loggedInAt: string
}

const AUTH_STORAGE_KEY = 'dataops-auth-session'
const VALID_CREDENTIALS: Record<AuthUserId, string> = {
  admin: 'dataops',
  developer: 'developer',
}

function normalizeUserId(userId: string): AuthUserId | null {
  const normalized = userId.trim().toLowerCase()
  if (normalized === 'admin' || normalized === 'developer') return normalized
  return null
}

function readStoredAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (!parsed || typeof parsed.userId !== 'string' || typeof parsed.sessionId !== 'string') return null

    const userId = normalizeUserId(parsed.userId)
    if (!userId) return null

    return {
      userId,
      sessionId: parsed.sessionId,
      loggedInAt: typeof parsed.loggedInAt === 'string' ? parsed.loggedInAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function persistAuth(session: AuthSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore storage failures so login UI can still operate in degraded mode
  }
}

export const authService = {
  getSession(): AuthSession | null {
    return readStoredAuth()
  },

  getAuthenticatedUserId(): AuthUserId | null {
    return readStoredAuth()?.userId ?? null
  },

  login(userId: string, password: string): { ok: true; session: AuthSession } | { ok: false; error: string } {
    const normalizedUserId = normalizeUserId(userId)
    if (!normalizedUserId) {
      return { ok: false, error: 'Use admin or developer to sign in.' }
    }

    if (VALID_CREDENTIALS[normalizedUserId] !== password) {
      return { ok: false, error: 'Invalid credentials.' }
    }

    const session: AuthSession = {
      userId: normalizedUserId,
      sessionId: getSessionId(),
      loggedInAt: new Date().toISOString(),
    }
    persistAuth(session)
    return { ok: true, session }
  },

  logout(): void {
    persistAuth(null)
  },
}

export const getAuthenticatedUserId = (): AuthUserId | null => authService.getAuthenticatedUserId()