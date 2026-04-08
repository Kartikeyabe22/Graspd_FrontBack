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

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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

export async function fetchRemoteSessions() {
  try {
    const url = `${BACKEND_BASE_URL}/sessions`
    console.log('Fetching sessions from:', url)
    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.status}`)
    }
    const sessions = await response.json()
    console.log('Remote sessions fetched:', sessions)
    if (!Array.isArray(sessions)) return []
    // Support both new format and old fallback format
    return sessions.map(item => {
      if (typeof item === 'string') {
        return { session_id: item, name: item, created_at: null }
      }
      return {
        session_id: item.session_id || item.id || '',
        name: item.name || item.topic || item.session_id || '',
        created_at: item.created_at || item.createdAt || null,
      }
    }).filter(item => item.session_id)
  } catch (error) {
    console.error('fetchRemoteSessions failed:', error)
    return []
  }
}

export async function createRemoteSession(name) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name: String(name || '').trim() }),
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

export async function updateRemoteSessionName(sessionId, newName) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name: newName }),
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Failed to update session: ${response.status} ${errText}`)
    }
    return await response.json()
  } catch (error) {
    console.warn('updateRemoteSessionName failed', error)
    throw error
  }
}

export async function deleteRemoteSession(sessionId) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
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
  const remoteSessions = await fetchRemoteSessions()
  
  return remoteSessions.map(({ session_id, name, created_at }) => ({
    id: session_id,
    topic: name || session_id,
    pageId: null,
    createdAt: created_at || new Date().toISOString(),
  }))
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

// -------------------- UPLOAD API --------------------
export async function uploadDocuments(sessionId, files) {
  try {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Failed to upload documents: ${response.status} ${errText}`)
    }
    return await response.json()
  } catch (error) {
    console.warn('uploadDocuments failed', error)
    throw error
  }
}

// -------------------- CHAT API --------------------
export async function sendChatToBackend(sessionId, query) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ query: query.trim() }),
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Failed to send chat: ${response.status} ${errText}`)
    }
    return await response.json()
  } catch (error) {
    console.warn('sendChatToBackend failed', error)
    throw error
  }
}

// -------------------- HISTORY API --------------------
export async function getChatHistoryFromBackend(sessionId) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/history`, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
      },
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Failed to fetch chat history: ${response.status} ${errText}`)
    }
    const rows = await response.json()
    return Array.isArray(rows) ? rows : []
  } catch (error) {
    console.warn('getChatHistoryFromBackend failed', error)
    return []
  }
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