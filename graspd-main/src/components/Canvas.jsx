import { useState } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import CanvasPrompt from './CanvasPrompt'
import ChatPanel from './chat/ChatPanel'
import HistoryPanel from './history/HistoryPanel'
import styles from './Canvas.module.css'

export default function Canvas(){
  const [editor, setEditor]   = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const handleSessionChange = (session) => {
    setActiveSessionId(session.id)
  }

  const handleHistoryCollapse = (collapsed) => {
    setHistoryCollapsed(collapsed)
  }

  return (
    <div className={styles.root}>
      <HistoryPanel
        editor={editor}
        activeSessionId={activeSessionId}
        onSessionChange={handleSessionChange}
        onCollapse={handleHistoryCollapse}
      />
      <div
        className={`${styles.canvasContainer} ${historyCollapsed ? styles.expanded : ''} ${paletteOpen ? styles.paletteOpen : styles.paletteHidden}`}
      >
        <button
          className={styles.paletteToggle}
          onClick={() => setPaletteOpen(prev => !prev)}
          title={paletteOpen ? 'Hide palette' : 'Show palette'}
          aria-label={paletteOpen ? 'Hide color palette' : 'Show color palette'}
        >
          {paletteOpen ? '›' : '‹'}
        </button>
        <Tldraw
          inferDarkMode
          persistenceKey="graspd-canvas"
          onMount={ed => setEditor(ed)}
        />
        {editor && (
          <CanvasPrompt
            editor={editor}
            onOpenChat={() => setChatOpen(true)}
            activeSessionId={activeSessionId}
          />
        )}
        {editor && (
          <ChatPanel
            editor={editor}
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            activeSessionId={activeSessionId}
          />
        )}
      </div>
    </div>
  )
}