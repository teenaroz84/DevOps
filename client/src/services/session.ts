/**
 * session — generates a stable session ID for the current browser tab.
 *
 * Uses sessionStorage so the ID:
 *   • persists across page refreshes within the same tab
 *   • resets when the tab is closed or a new tab is opened
 *
 * All dashboard preference storage is scoped to this ID so different
 * sessions never overwrite each other.
 */

const SESSION_STORAGE_KEY = 'dataops-session-id'

function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    // sessionStorage unavailable (e.g. private browsing, iframe) — use in-memory ID
    return crypto.randomUUID()
  }
}

export const SESSION_ID = getOrCreateSessionId()
