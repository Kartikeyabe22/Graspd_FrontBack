// storage.js
// Stores chat history per tldraw page ID
// When backend is ready, replace localStorage calls with API calls here

const CHAT_PREFIX = 'graspd_chat_'
const SESSION_KEY = 'graspd_sessions'

// Get chat history for a specific page
export function getChatHistory(pageId) {
  try {
    const raw = localStorage.getItem(`${CHAT_PREFIX}${pageId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Save chat history for a specific page
export function saveChatHistory(pageId, messages) {
  try {
    localStorage.setItem(`${CHAT_PREFIX}${pageId}`, JSON.stringify(messages))
  } catch {}
}

// Delete chat history for a specific page
export function deleteChatHistory(pageId) {
  try {
    localStorage.removeItem(`${CHAT_PREFIX}${pageId}`)
  } catch {}
}

const BACKEND_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Session management functions
export function getHistory() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveSession(session) {
  try {
    const history = getHistory()
    const existingIndex = history.findIndex(s => s.id === session.id)
    if (existingIndex >= 0) {
      history[existingIndex] = session
    } else {
      history.push(session)
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(history))
  } catch {}
}

export async function fetchRemoteSessions() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions`)
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status}`)
    }
    const sessionNames = await response.json()
    return Array.isArray(sessionNames) ? sessionNames : []
  } catch (error) {
    console.warn('fetchRemoteSessions failed', error)
    return []
  }
}

export async function createRemoteSession(sessionId) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Failed to create session: ${response.status} ${errText}`)
    }
    return await response.json()
  } catch (error) {
    console.warn('createRemoteSession failed', error)
    return null
  }
}

export async function deleteRemoteSession(sessionId) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Failed to delete session: ${response.status} ${errText}`)
    }
    return await response.json()
  } catch (error) {
    console.warn('deleteRemoteSession failed', error)
    return null
  }
}

export async function getRemoteHistory() {
  const localHistory = getHistory()
  const remoteIds = await fetchRemoteSessions()
  const merged = [...localHistory]

  remoteIds.forEach(id => {
    if (!merged.some(item => item.id === id)) {
      merged.push({
        id,
        topic: id,
        pageId: null,
        createdAt: new Date().toISOString(),
      })
    }
  })

  return merged
}

export function deleteSession(id) {
  try {
    const history = getHistory().filter(s => s.id !== id)
    localStorage.setItem(SESSION_KEY, JSON.stringify(history))
  } catch {}
}

export function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function groupHistoryByDate(sessions) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)

  const groups = {
    today: [],
    yesterday: [],
    lastWeek: [],
    earlier: []
  }

  sessions.forEach(session => {
    const date = new Date(session.createdAt)
    if (date >= today) {
      groups.today.push(session)
    } else if (date >= yesterday) {
      groups.yesterday.push(session)
    } else if (date >= lastWeek) {
      groups.lastWeek.push(session)
    } else {
      groups.earlier.push(session)
    }
  })

  return groups
}