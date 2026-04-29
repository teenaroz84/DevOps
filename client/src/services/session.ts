/**
 * session — generates a stable browser session ID stored in localStorage.
 *
 * The ID survives page refreshes and browser restarts so authenticated users
 * can reload the app and continue loading their full-screen chat sessions.
 */

const SESSION_STORAGE_KEY = 'dataops-browser-session-id'

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export const SESSION_ID = getSessionId()
