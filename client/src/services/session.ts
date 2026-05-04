/**
 * session — generates a stable browser session ID stored in localStorage.
 *
 * The ID survives page refreshes and browser restarts so authenticated users
 * can reload the app and continue loading their full-screen chat sessions.
 */

const SESSION_STORAGE_KEY = 'dataops-browser-session-id'

function generateUUID(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = generateUUID()
      localStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return generateUUID()
  }
}

export const SESSION_ID = getSessionId()
