import { useState, useEffect, useRef } from 'react'
import {
  getHistory,
  saveSession,
  deleteSession,
  getRemoteHistory,
  createRemoteSession,
  deleteRemoteSession,
  generateSessionId,
  groupHistoryByDate,
} from '../../services/storage'
import HistoryItem from './HistoryItem'
import styles from './HistoryPanel.module.css'
import { useNavigate } from 'react-router-dom';
import { logout } from '../../utils/auth';

export default function HistoryPanel({ editor, activeSessionId, onSessionChange, onCollapse }) {
  const navigate = useNavigate();
  const [history, setHistory]     = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const creatingRef               = useRef(false) // guard against double-fire

  useEffect(() => {
    let mounted = true
    getRemoteHistory().then(data => {
      console.log('HistoryPanel: getRemoteHistory returned:', data)
      if (mounted) setHistory(data)
    }).catch((err) => {
      console.error('HistoryPanel: getRemoteHistory failed:', err)
      if (mounted) setHistory(getHistory())
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    async function refreshHistory() {
      const remote = await getRemoteHistory()
      setHistory(remote)
    }

    window.addEventListener('graspd:history', refreshHistory)
    return () => window.removeEventListener('graspd:history', refreshHistory)
  }, [])

  // Tell Canvas.jsx about collapsed state so it can shift the canvas area
  useEffect(() => {
    onCollapse?.(collapsed)
  }, [collapsed])

  async function handleNewCanvas() {
    if (!editor || creatingRef.current) return
    creatingRef.current = true

    try {
      // Create tldraw page
      const newPageId = editor.createPage({ name: 'New canvas' })

      // tldraw returns the id directly in some versions, object in others
      const pageId = typeof newPageId === 'string' ? newPageId : newPageId?.id

      if (!pageId) return

      editor.setCurrentPage(pageId)

      const session = {
        id:        generateSessionId(),
        pageId,
        topic:     'New canvas',
        createdAt: new Date().toISOString(),
      }

      saveSession(session)
      createRemoteSession(session.id)
      setHistory(await getRemoteHistory())
      onSessionChange(session)
    } finally {
      // Release guard after a tick so StrictMode double-fire is ignored
      setTimeout(() => { creatingRef.current = false }, 100)
    }
  }

  function handleSelectSession(session) {
    if (!editor) return

    const pages      = editor.getPages()
    const pageExists = pages.find(p => p.id === session.pageId)

    if (pageExists) {
      editor.setCurrentPage(session.pageId)
    } else {
      const page   = editor.createPage({ name: session.topic })
      const pageId = typeof page === 'string' ? page : page?.id
      if (!pageId) return
      editor.setCurrentPage(pageId)
      saveSession({ ...session, pageId })
      setHistory(getHistory())
    }

    onSessionChange(session)
  }

  async function handleDelete(id) {
    if (!editor) return

    const session = getHistory().find(h => h.id === id)

    if (session?.pageId) {
      const pages = editor.getPages()
      const page  = pages.find(p => p.id === session.pageId)

      if (page) {
        // Can't delete the only page — tldraw requires at least one
        if (pages.length > 1) {
          editor.deletePage(session.pageId)
        } else {
          // Clear the page content instead
          editor.selectAll()
          editor.deleteShapes(editor.getSelectedShapeIds())
          editor.renamePage(session.pageId, 'Page 1')
        }
      }
    }

    deleteSession(id)
    await deleteRemoteSession(id)
    setHistory(await getRemoteHistory())
  }

  function handleUpdateSession(sessionId, newName) {
    setHistory(prevHistory => {
      const nextHistory = prevHistory.map(s =>
        s.id === sessionId ? { ...s, topic: newName } : s
      )
      const updatedSession = nextHistory.find((s) => s.id === sessionId)
      if (updatedSession) {
        saveSession(updatedSession)
      }
      return nextHistory
    })
  }

  const groups       = groupHistoryByDate(history)
  const GROUP_LABELS = {
    today:     'Today',
    yesterday: 'Yesterday',
    lastWeek:  'Last 7 days',
    earlier:   'Earlier',
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`} style={{position: 'fixed'}}>
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>canvases</span>}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {!collapsed && (
        <>
          <button className={styles.newBtn} onClick={handleNewCanvas}>
            <span className={styles.newIcon}>+</span>
            new canvas
          </button>

          <div className={styles.list} style={{marginBottom: 70}}>
            {history.length === 0 ? (
              <div className={styles.empty}>
                no canvases yet.<br />generate a topic to start.
              </div>
            ) : (
              Object.entries(groups).map(([key, sessions]) =>
                sessions.length > 0 ? (
                  <div key={key} className={styles.group}>
                    <div className={styles.groupLabel}>{GROUP_LABELS[key]}</div>
                    {sessions.map(session => (
                      <HistoryItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        onClick={() => handleSelectSession(session)}
                        onDelete={handleDelete}
                        onUpdate={handleUpdateSession}
                      />
                    ))}
                  </div>
                ) : null
              )
            )}
          </div>
          <div className={styles.logoutBtnWrapper}>
            <button
              onClick={handleLogout}
              className={styles.logoutBtn}
            >
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  )
}