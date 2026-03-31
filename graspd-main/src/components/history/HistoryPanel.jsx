import { useState, useEffect, useRef } from 'react'
import {
  getHistory,
  saveSession,
  deleteSession,
  generateSessionId,
  groupHistoryByDate,
} from '../../services/storage'
import HistoryItem from './HistoryItem'
import styles from './HistoryPanel.module.css'

export default function HistoryPanel({ editor, activeSessionId, onSessionChange, onCollapse }) {
  const [history, setHistory]     = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const creatingRef               = useRef(false) // guard against double-fire

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  useEffect(() => {
    function onStorage() { setHistory(getHistory()) }
    window.addEventListener('graspd:history', onStorage)
    return () => window.removeEventListener('graspd:history', onStorage)
  }, [])

  // Tell Canvas.jsx about collapsed state so it can shift the canvas area
  useEffect(() => {
    onCollapse?.(collapsed)
  }, [collapsed])

  function handleNewCanvas() {
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
      setHistory(getHistory())
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

  function handleDelete(id) {
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
    setHistory(getHistory())
  }

  const groups       = groupHistoryByDate(history)
  const GROUP_LABELS = {
    today:     'Today',
    yesterday: 'Yesterday',
    lastWeek:  'Last 7 days',
    earlier:   'Earlier',
  }

  return (
    <div className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}>
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

          <div className={styles.list}>
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
                      />
                    ))}
                  </div>
                ) : null
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}