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