import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor } from 'tldraw'
import { sendChatMessage, sendChatMessageWithFile } from '../../services/gemini'
import { layoutGraph } from '../../utils/graphLayout'
import { paintGraph } from '../../utils/paintGraph'
import { getChatHistory, saveChatHistory } from '../../services/storage'
import MessageBubble from './MessageBubble'
import styles from './ChatPanel.module.css'

const DEFAULT_GREETING = {
  role: 'ai',
  data: {
    type: 'explanation',
    message: "Hey! I'm your graspd tutor.\n\nAsk me to explain any concept, recommend resources, or generate a diagram — I can see what's on your canvas.",
    resources: [],
    graph: null,
  },
}

export default function ChatPanel({ editor, open, onClose }) {
  const [messages, setMessages]       = useState([DEFAULT_GREETING])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [currentPageId, setCurrentPageId] = useState(null)

  const bottomRef = useRef(null)
  const fileRef   = useRef(null)

  // ── Watch for page changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return

    function checkPage() {
      const pageId = editor.getCurrentPageId()
      if (pageId === currentPageId) return

      // Save current page's chat before switching
      if (currentPageId && messages.length > 1) {
        saveChatHistory(currentPageId, messages)
      }

      // Load new page's chat
      const saved = getChatHistory(pageId)
      setMessages(saved && saved.length > 0 ? saved : [DEFAULT_GREETING])
      setCurrentPageId(pageId)
      setInput('')
      setPendingFile(null)
    }

    // Check immediately
    checkPage()

    // Poll for page changes — tldraw fires store events on page switch
    const unsub = editor.store.listen(() => {
      checkPage()
    }, { scope: 'session' })

    return () => unsub()
  }, [editor, currentPageId, messages])

  // ── Auto scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Save messages to localStorage whenever they change ──────────────────
  useEffect(() => {
    if (!currentPageId || messages.length <= 1) return
    saveChatHistory(currentPageId, messages)
  }, [messages, currentPageId])

  // ── File handling ────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function processFile(file) {
    const isImage = file.type.startsWith('image/')
    const isPdf   = file.type === 'application/pdf'
    if (!isImage && !isPdf) return

    if (isImage) {
      const reader = new FileReader()
      reader.onload = ev => {
        setPendingFile({ file, preview: ev.target.result, type: 'image' })
      }
      reader.readAsDataURL(file)
    } else {
      setPendingFile({ file, preview: null, type: 'pdf' })
    }
  }

  function removePendingFile() { setPendingFile(null) }

  // ── Send message ─────────────────────────────────────────────────────────
  async function handleSend() {
    if ((!input.trim() && !pendingFile) || loading || !editor) return

    const userMessage = input.trim() || 'Explain this for me'
    const fileToSend  = pendingFile

    setInput('')
    setPendingFile(null)
    setLoading(true)

    const userMsg = {
      role:    'user',
      content: userMessage,
      file:    fileToSend
        ? { preview: fileToSend.preview, type: fileToSend.type, name: fileToSend.file.name }
        : null,
    }

    setMessages(prev => [...prev, userMsg])

    try {
      const shapes  = editor.getCurrentPageShapes()
      const history = messages.slice(1).map(m => ({
        role:    m.role,
        content: m.role === 'user' ? m.content : m.data?.message ?? '',
      }))

      const response = fileToSend
        ? await sendChatMessageWithFile(userMessage, fileToSend.file, shapes, history)
        : await sendChatMessage(userMessage, shapes, history)

      if (response.graph) {
        const laid = layoutGraph(response.graph)
        paintGraph(editor, laid)
      }

      setMessages(prev => [...prev, { role: 'ai', data: response }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'ai',
        data: {
          type:      'explanation',
          message:   'Sorry, something went wrong. Try again.',
          resources: [],
          graph:     null,
        },
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleDropToCanvas(resource) {
    if (!editor) return
    const center = editor.getViewportPageCenter()
    editor.createShape({
      type:  'embed',
      x:     center.x - 300,
      y:     center.y - 200,
      props: { url: resource.url, w: 600, h: 400 },
    })
  }

  if (!open) return null

  return (
    <div
      className={styles.panel}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerDot} />
          <span className={styles.headerTitle}>graspd tutor</span>
          <span className={styles.headerSub}>canvas-aware</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            onDropToCanvas={handleDropToCanvas}
          />
        ))}

        {loading && (
          <div className={styles.thinking}>
            <div className={styles.thinkDot} />
            <div className={styles.thinkDot} />
            <div className={styles.thinkDot} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending file preview */}
      {pendingFile && (
        <div className={styles.filePreview}>
          {pendingFile.type === 'image' ? (
            <img
              src={pendingFile.preview}
              className={styles.fileImg}
              alt="upload"
            />
          ) : (
            <div className={styles.filePdf}>
              <span className={styles.filePdfIcon}>📄</span>
              <span className={styles.filePdfName}>{pendingFile.file.name}</span>
            </div>
          )}
          <button className={styles.fileRemove} onClick={removePendingFile}>
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <button
          className={styles.uploadBtn}
          onClick={() => fileRef.current?.click()}
          title="Upload image or PDF"
        >
          ⊕
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <textarea
          className={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            pendingFile
              ? 'Add a message or just hit send…'
              : "ask anything, or say 'draw a flowchart of X'…"
          }
          rows={2}
          disabled={loading}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={loading || (!input.trim() && !pendingFile)}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
