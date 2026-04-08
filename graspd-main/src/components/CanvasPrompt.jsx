import { useState, useRef } from 'react'
import useTeaching from '../hooks/useTeaching'
import { generateKnowledgeGraph } from '../services/gemini'
import { layoutGraph } from '../utils/graphLayout'
import { paintGraph } from '../utils/paintGraph'
import { saveSession, createRemoteSession, uploadDocuments, generateSessionId } from '../services/storage'

import styles from './CanvasPrompt.module.css'

export default function CanvasPrompt({ editor, onOpenChat, activeSessionId }) {
  const [status, setStatus] = useState('idle')
  const [uploadStatus, setUploadStatus] = useState('idle')
  const fileInputRef = useRef(null)

  const {
    isLoading: teachingLoading,
    isStreaming,
    isSpeaking,
    currentStep,
    startLearning,
    nextStep,
  } = useTeaching(activeSessionId, editor)

  async function handleGenerate() {
    if (!editor || status === 'loading') return
    setStatus('loading')

    try {
      // Generate a random topic if none specified
      const topics = ['quantum mechanics', 'photosynthesis', 'artificial intelligence', 'climate change', 'neural networks']
      const randomTopic = topics[Math.floor(Math.random() * topics.length)]
      
      const raw  = await generateKnowledgeGraph(randomTopic)
      const laid = layoutGraph(raw)
      paintGraph(editor, laid)

      // Save to history tied to current tldraw page
      const currentPage = editor.getCurrentPage()
      const remote = await createRemoteSession(randomTopic)
      const session = {
        id:        remote?.session_id || generateSessionId(),
        pageId:    currentPage.id,
        topic:     remote?.name || randomTopic,
        createdAt: remote?.created_at || new Date().toISOString(),
      }
      saveSession(session)

      // Tell history panel to refresh
      window.dispatchEvent(new Event('graspd:history'))

      // Update page name in tldraw to match topic
      editor.renamePage(currentPage.id, randomTopic)

      setStatus('idle')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelect(e) {
    const files = e.target.files
    if (!files || !files.length || !editor) return

    setUploadStatus('loading')
    try {
      // Use current session if available, otherwise create a new one
      let sessionId = activeSessionId
      
      if (!sessionId) {
        // Create a new session only if no session is active
        const currentPage = editor.getCurrentPage()
        const currentPageId = currentPage.id
        const topic = 'Uploaded Document'
        const remote = await createRemoteSession(topic)
        const session = {
          id:        remote?.session_id || generateSessionId(),
          pageId:    currentPageId,
          topic:     remote?.name || topic,
          createdAt: remote?.created_at || new Date().toISOString(),
        }
        saveSession(session)
        sessionId = session.id
      }
      
      // Upload files to the current session
      const uploadResult = await uploadDocuments(sessionId, Array.from(files))
      console.log('Upload result:', uploadResult)

      setUploadStatus('idle')
      // Tell history panel to refresh
      window.dispatchEvent(new Event('graspd:history'))
    } catch (err) {
      console.error(err)
      setUploadStatus('error')
      setTimeout(() => setUploadStatus('idle'), 3000)
    }

    // Reset file input
    e.target.value = ''
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <button
          className={`${styles.btn} ${status === 'loading' ? styles.loading : ''}`}
          onClick={handleGenerate}
          disabled={status === 'loading'}
          title="Generate random knowledge graph"
        >
          {status === 'loading' ? (
            <span className={styles.dots}>
              <span /><span /><span />
            </span>
          ) : status === 'error' ? 'retry' : 'generate ✦'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <button
          className={`${styles.btn} ${uploadStatus === 'loading' ? styles.loading : ''}`}
          onClick={handleUploadClick}
          disabled={uploadStatus === 'loading'}
          title="Upload PDF or DOCX files for Q&A"
        >
          {uploadStatus === 'loading' ? (
            <span className={styles.dots}>
              <span /><span /><span />
            </span>
          ) : uploadStatus === 'error' ? 'retry' : 'upload'}
        </button>

        <div className={styles.divider} />

        <button
          className={`${styles.btn} ${teachingLoading ? styles.loading : ''}`}
          onClick={() => startLearning().catch(err => console.error(err))}
          disabled={!activeSessionId || teachingLoading || isStreaming}
          title="Start teaching from PDFs"
        >
          {(teachingLoading && !currentStep) ? (
            <span className={styles.dots}><span /><span /><span /></span>
          ) : 'start learning'}
        </button>

        <button
          className={`${styles.btn} ${teachingLoading ? styles.loading : ''}`}
          onClick={() => nextStep().catch(err => console.error(err))}
          disabled={!activeSessionId || teachingLoading || isStreaming}
          title="Next topic step"
        >
          {teachingLoading ? (
            <span className={styles.dots}><span /><span /><span /></span>
          ) : 'next'}
        </button>

        <div className={styles.divider} />
        <button className={styles.tutorBtn} onClick={onOpenChat}>
          <span className={styles.tutorDot} />
          ask tutor
        </button>
      </div>
      {currentStep && (
        <div className={styles.statusText}>
          Teaching: {currentStep.topic} (PDF {currentStep.pdf_index + 1}, step {currentStep.step})
          {isStreaming ? ' — typing...' : ''}
          {isSpeaking ? ' 🔊 speaking...' : ''}
        </div>
      )}
    </div>
  )
}