import { useState } from 'react'
import { generateKnowledgeGraph } from '../services/gemini'
import { layoutGraph } from '../utils/graphLayout'
import { paintGraph } from '../utils/paintGraph'

import styles from './CanvasPrompt.module.css'

export default function CanvasPrompt({ editor, onOpenChat }) {
  const [topic, setTopic]   = useState('')
  const [status, setStatus] = useState('idle')

  async function handleGenerate() {
    if (!topic.trim() || !editor || status === 'loading') return
    setStatus('loading')

    try {
      const raw  = await generateKnowledgeGraph(topic)
      const laid = layoutGraph(raw)
      paintGraph(editor, laid)

      // Save to history tied to current tldraw page
      const currentPage = editor.getCurrentPage()
      const session = {
        id:        generateSessionId(),
        pageId:    currentPage.id,
        topic:     topic.trim(),
        createdAt: new Date().toISOString(),
      }
      saveSession(session)

      // Tell history panel to refresh
      window.dispatchEvent(new Event('graspd:history'))

      // Update page name in tldraw to match topic
      editor.renamePage(currentPage.id, topic.trim())

      setStatus('idle')
      setTopic('')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleGenerate()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <span className={styles.label}>topic</span>
        <input
          className={styles.input}
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. neural networks, black holes, french revolution…"
          disabled={status === 'loading'}
        />
        <button
          className={`${styles.btn} ${status === 'loading' ? styles.loading : ''}`}
          onClick={handleGenerate}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <span className={styles.dots}>
              <span /><span /><span />
            </span>
          ) : status === 'error' ? 'retry' : 'generate ✦'}
        </button>
        <div className={styles.divider} />
        <button className={styles.tutorBtn} onClick={onOpenChat}>
          <span className={styles.tutorDot} />
          ask tutor
        </button>
      </div>
    </div>
  )
}