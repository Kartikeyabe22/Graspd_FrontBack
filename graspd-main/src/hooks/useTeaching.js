import { useState, useRef, useCallback } from 'react'
import { toRichText } from '@tldraw/editor'
import { playSpeech } from '../services/tts'

const BACKEND_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function streamText(fullText, onUpdate, options = {}) {
  const { intervalMs = 40, byWord = false } = options
  const units = byWord ? fullText.split(' ') : fullText.split('')
  let currentValue = ''

  return new Promise((resolve) => {
    let i = 0
    const timer = setInterval(() => {
      if (i >= units.length) {
        clearInterval(timer)
        onUpdate(fullText)
        resolve()
        return
      }

      if (byWord) {
        currentValue += (i === 0 ? '' : ' ') + units[i]
      } else {
        currentValue += units[i]
      }

      onUpdate(currentValue)
      i += 1
    }, intervalMs)
  })
}

export default function useTeaching(sessionId, editor) {
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [yOffset, setYOffset] = useState(100)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const mountedRef = useRef(true)

  const createShapesForStep = useCallback(async (step) => {
    if (!editor || !step) return

    const xStart = 40
    const yStart = yOffset

    // Create white sheet background
    const sheetShape = editor.createShape({
      type: 'geo',
      x: xStart - 20,
      y: yStart - 20,
      props: {
        geo: 'rectangle',
        w: 800,
        h: 400,
        fill: 'solid',
        color: 'white',
        size: 's',
        dash: 'solid',
      },
    })

    // Title shape (bold)
    const titleText = step.canvas.title || step.topic || 'Untitled Topic'

    const titleShape = editor.createShape({
      type: 'text',
      x: xStart,
      y: yStart,
      props: {
        richText: toRichText(titleText),
        color: 'black',
        size: 'xl',
        font: 'sans',
        textAlign: 'start',
        w: 720,
        scale: 1,
        autoSize: false,
      },
    })

    const content = step.canvas.content || ''

    const contentShape = editor.createShape({
      type: 'text',
      x: xStart,
      y: yStart + 100,
      props: {
        richText: toRichText(content),
        color: 'black',
        size: 'm',
        font: 'sans',
        textAlign: 'start',
        w: 720,
        scale: 1,
        autoSize: false,
      },
    })

    setIsStreaming(true)

    try {
      if (content) {
        await streamText(content, partial => {
          editor.updateShapes([{ id: contentShape.id, props: { richText: toRichText(partial) } }])
        }, { intervalMs: 28, byWord: false })
      }

      await sleep(200)

      // render important points with heading
      const points = step.canvas.important_points || []
      if (points.length > 0) {
        // Create "Important Points" heading
        editor.createShape({
          type: 'text',
          x: xStart,
          y: yStart + 170,
          props: {
            richText: toRichText('Important Points'),
            color: 'black',
            size: 'l',
            font: 'sans',
            textAlign: 'start',
            w: 720,
            scale: 1,
            autoSize: false,
          },
        })

        // Create bullet list below the heading
        const bullets = points.map(p => `• ${p}`).join('\n')
        editor.createShape({
          type: 'text',
          x: xStart + 10,
          y: yStart + 200,
          props: {
            richText: toRichText(bullets),
            color: 'black',
            size: 's',
            font: 'sans',
            textAlign: 'start',
            w: 700,
            scale: 1,
            autoSize: false,
          },
        })
      }
    } finally {
      setIsStreaming(false)
    }
// 🔊 Auto-play voice script if available
    if (step.voice && step.voice.script) {
      try {
        setIsSpeaking(true)
        await playSpeech(step.voice.script)
      } catch (error) {
        console.error('TTS playback error:', error)
      } finally {
        setIsSpeaking(false)
      }
    }

    
    const newYOffset = yStart + 450 + (points.length ? points.length * 24 : 0)
    setYOffset(newYOffset)

    // Optional: scroll viewport to include latest shape
    try {
      if (editor && editor.zoomToFit) {
        editor.zoomToFit({ animation: { duration: 250 } })
      }
    } catch (err) {
      console.warn('Auto zoom failed', err)
    }

  }, [editor, yOffset])

  const fetchStep = useCallback(async (path) => {
    if (!sessionId) throw new Error('No session ID')
    setIsLoading(true)
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API ${path} failed: ${response.status} ${text}`)
      }

      const payload = await response.json()
      return payload
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const startLearning = useCallback(async () => {
    if (isStreaming) return
    if (!sessionId) throw new Error('No session selected')
    const payload = await fetchStep('teach/start')
    if (payload && payload.canvas) {
      setCurrentStep(payload)
      await createShapesForStep(payload)
    }
    return payload
  }, [createShapesForStep, fetchStep, isStreaming, sessionId])

  const nextStep = useCallback(async () => {
    if (isStreaming) return
    if (!sessionId) throw new Error('No session selected')
    const payload = await fetchStep('teach/next')
    if (payload.message === 'Teaching completed') {
      setCurrentStep(null)
      return payload
    }
    if (payload && payload.canvas) {
      setCurrentStep(payload)
      await createShapesForStep(payload)
    }
    return payload
  }, [createShapesForStep, fetchStep, isStreaming, sessionId])

  return {
    isLoading,
    isStreaming,
    isSpeaking,
    currentStep,
    yOffset,
    startLearning,
    nextStep,
  }
}
