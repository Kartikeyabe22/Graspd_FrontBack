import { useState, useRef } from 'react'
import useTeaching from '../hooks/useTeaching'
import { saveSession, createRemoteSession, uploadDocuments, generateSessionId } from '../services/storage'

import styles from './CanvasPrompt.module.css'

export default function CanvasPrompt({ editor, onOpenChat, activeSessionId }) {
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [voiceRate, setVoiceRate] = useState(1.5)
  const fileInputRef = useRef(null)

  const {
    isLoading: teachingLoading,
    isStreaming,
    isSpeaking,
    isPaused,
    currentStep,
    startLearning,
    togglePause,
    isAutoTeaching,
  } = useTeaching(activeSessionId, editor, { voiceRate })

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
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <button
          className={`${styles.btn} ${teachingLoading ? styles.loading : ''}`}
          onClick={() => startLearning().catch(err => console.error(err))}
          disabled={!activeSessionId || teachingLoading || isStreaming || isAutoTeaching}
          title="Start teaching from PDFs"
        >
          {(teachingLoading && !currentStep) ? (
            <span className={styles.dots}><span /><span /><span /></span>
          ) : 'Start Learning'}
        </button>

        <button
          className={`${styles.btn} ${isPaused ? styles.loading : ''}`}
          onClick={() => togglePause()}
          disabled={!isStreaming && !isSpeaking}
          title={isPaused ? 'Resume learning' : 'Pause learning'}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

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

        <div className={styles.rateWrap}>
          <span className={styles.rateLabel}>rate</span>
          <input
            className={styles.rateSlider}
            type="range"
            min="1"
            max="2"
            step="0.1"
            value={voiceRate}
            onChange={(e) => setVoiceRate(Number(e.target.value))}
            aria-label="Speech rate"
          />
          <span className={styles.rateValue}>{voiceRate.toFixed(1)}x</span>
        </div>

        <div className={styles.divider} />
        <button
          className={styles.tutorBtn}
          onClick={(e) => {
            e.stopPropagation()
            onOpenChat()
          }}
        >
          <span className={styles.tutorDot} />
          ask tutor
        </button>
      </div>
      {currentStep && (
        <div className={styles.statusText}>
          Teaching: {currentStep.topic} (PDF {currentStep.pdf_index + 1}, step {currentStep.step})
          {isStreaming ? ' — typing...' : ''}
          {isSpeaking ? ' 🔊 speaking...' : ''}
          {isPaused ? ' — paused' : ''}
        </div>
      )}
    </div>
  )
}