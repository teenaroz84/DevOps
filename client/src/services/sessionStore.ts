/**
 * sessionStore — typed localStorage wrapper.
 *
 * Organises all persisted data under three namespaces:
 *   user        → preferences (theme, timezone, name...)
 *   chat        → chat-panel preferences (agent, history, font size...)
 *   dashboard   → layout state (active tab, widget order, filters...)
 *
 * Data survives page refreshes and browser restarts.
 * Call sessionStore.clear() or sessionStore.clearNamespace('chat') to reset.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  displayName?: string
  theme?: 'light' | 'dark'
  timezone?: string
  language?: string
}

export interface ChatPreferences {
  /** Last agent the user interacted with */
  lastAgentId?: string
  /** Stored chat history — array of serialised Message objects */
  history?: Array<{ role: 'user' | 'agent'; content: string; agentLabel?: string }>
  /** Max messages to keep in history */
  historyLimit?: number
  /** Font size preference for the chat panel */
  fontSize?: 'small' | 'medium' | 'large'
}

export interface DashboardLayout {
  /** Which dashboard tab is active */
  activeTab?: string
  /** Collapsed/expanded state per widget id */
  widgetCollapsed?: Record<string, boolean>
  /** Saved filter values per dashboard */
  filters?: Record<string, Record<string, unknown>>
  /** Column widths or widget order per dashboard */
  widgetOrder?: Record<string, string[]>
}

type Namespace = 'user' | 'chat' | 'dashboard'

import { SESSION_ID } from './session'

const PREFIX = `dataops:${SESSION_ID}:`

// ── Core helpers ─────────────────────────────────────────────────────────────

function key(ns: Namespace): string {
  return `${PREFIX}${ns}`
}

function read<T>(ns: Namespace): T | null {
  try {
    const raw = localStorage.getItem(key(ns))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write<T>(ns: Namespace, value: T): void {
  try {
    localStorage.setItem(key(ns), JSON.stringify(value))
  } catch (e) {
    console.warn('[sessionStore] write failed:', e)
  }
}

function merge<T extends object>(ns: Namespace, patch: Partial<T>): T {
  const current = read<T>(ns) ?? ({} as T)
  const updated = { ...current, ...patch }
  write(ns, updated)
  return updated
}

// ── Public API ────────────────────────────────────────────────────────────────

export const sessionStore = {
  // ── User preferences ────────────────────────────────────────────────────
  getUser(): UserPreferences {
    return read<UserPreferences>('user') ?? {}
  },
  setUser(prefs: Partial<UserPreferences>): UserPreferences {
    return merge<UserPreferences>('user', prefs)
  },

  // ── Chat preferences ─────────────────────────────────────────────────────
  getChat(): ChatPreferences {
    return read<ChatPreferences>('chat') ?? {}
  },
  setChat(prefs: Partial<ChatPreferences>): ChatPreferences {
    return merge<ChatPreferences>('chat', prefs)
  },

  /** Append a message to chat history, trimming to historyLimit (default 50). */
  appendChatHistory(msg: ChatPreferences['history'] extends Array<infer M> ? M : never): void {
    const current = read<ChatPreferences>('chat') ?? {}
    const limit = current.historyLimit ?? 50
    const history = [...(current.history ?? []), msg].slice(-limit)
    write('chat', { ...current, history })
  },

  clearChatHistory(): void {
    const current = read<ChatPreferences>('chat') ?? {}
    write('chat', { ...current, history: [] })
  },

  // ── Dashboard layout ─────────────────────────────────────────────────────
  getDashboard(): DashboardLayout {
    return read<DashboardLayout>('dashboard') ?? {}
  },
  setDashboard(layout: Partial<DashboardLayout>): DashboardLayout {
    return merge<DashboardLayout>('dashboard', layout)
  },

  /** Merge filter values for one specific dashboard. */
  setFilters(dashboardId: string, filters: Record<string, unknown>): void {
    const current = read<DashboardLayout>('dashboard') ?? {}
    write('dashboard', {
      ...current,
      filters: { ...(current.filters ?? {}), [dashboardId]: filters },
    })
  },

  getFilters(dashboardId: string): Record<string, unknown> {
    return read<DashboardLayout>('dashboard')?.filters?.[dashboardId] ?? {}
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  /** Clear one namespace only. */
  clearNamespace(ns: Namespace): void {
    localStorage.removeItem(key(ns))
  },

  /** Wipe all dataops: keys from localStorage. */
  clear(): void {
    (['user', 'chat', 'dashboard'] as Namespace[]).forEach(ns =>
      localStorage.removeItem(key(ns)),
    )
  },

  /** How much of the ~5 MB localStorage budget is used (approximate). */
  usageKB(): number {
    let total = 0
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) total += (localStorage.getItem(k) ?? '').length
    }
    return Math.round(total / 1024)
  },
}
