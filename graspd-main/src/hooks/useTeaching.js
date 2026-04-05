import { useState, useRef, useCallback } from 'react'
import { toRichText } from '@tldraw/editor'
import { playSpeech } from '../services/tts'

const BACKEND_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function streamText(fullText, onUpdate, options = {}) {
  const { intervalMs = 40 } = options
  let currentValue = ''

  return new Promise((resolve) => {
    let i = 0
    const timer = setInterval(() => {
      if (i >= fullText.length) {
        clearInterval(timer)
        onUpdate(fullText)
        resolve()
        return
      }
      currentValue += fullText[i]
      onUpdate(currentValue)
      i++
    }, intervalMs)
  })
}

export default function useTeaching(sessionId, editor) {
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const editorRef = useRef(editor)
  editorRef.current = editor

  const createShapesForStep = async (step) => {
    const ed = editorRef.current
    if (!ed || !step) return

    const SLIDE_WIDTH = 800
    const SLIDE_HEIGHT = 700

    const xStart = (window.innerWidth - SLIDE_WIDTH) / 2

    // ✅ REAL POSITION CALCULATION (NO OVERLAP)
    const allShapes = ed.getCurrentPageShapes()

    let yStart = 100
    if (allShapes.length > 0) {
      let maxY = 0
      allShapes.forEach((shape) => {
        const bounds = ed.getShapePageBounds(shape.id)
        if (bounds) {
          const bottom = bounds.y + bounds.h
          if (bottom > maxY) maxY = bottom
        }
      })
      yStart = maxY + 120
    }

    const content = step.canvas.content || ''
    const points = step.canvas.important_points || []

    // 🟫 Subtle border (Gamma feel)
    ed.createShape({
      type: 'geo',
      x: xStart - 1,
      y: yStart - 1,
      props: {
        geo: 'rectangle',
        w: SLIDE_WIDTH + 2,
        h: SLIDE_HEIGHT + 2,
        fill: 'solid',
        color: 'grey',
        size: 's',
        dash: 'solid',
      },
    })

    // ⬜ Main slide
    ed.createShape({
      type: 'geo',
      x: xStart,
      y: yStart,
      props: {
        geo: 'rectangle',
        w: SLIDE_WIDTH,
        h: SLIDE_HEIGHT,
        fill: 'solid',
        color: 'white',
        size: 'm',
        dash: 'solid',
      },
    })

    // 🧠 Title
    ed.createShape({
      type: 'text',
      x: xStart + 40,
      y: yStart + 50,
      props: {
        richText: toRichText(step.canvas.title || step.topic || 'Untitled'),
        color: 'black',
        size: 'xl',
        font: 'serif',
        w: 720,
      },
    })

    // ➖ Divider
    ed.createShape({
      type: 'geo',
      x: xStart + 40,
      y: yStart + 100,
      props: {
        geo: 'rectangle',
        w: 200,
        h: 2,
        fill: 'solid',
        color: 'grey',
        size: 's',
        dash: 'solid',
      },
    })

    // 📄 Content
    const contentShape = ed.createShape({
      type: 'text',
      x: xStart + 40,
      y: yStart + 140,
      props: {
        richText: toRichText(''),
        color: 'black',
        size: 'l',
        font: 'sans',
        w: 720,
      },
    })

    setIsStreaming(true)

    try {
      if (content) {
        await streamText(content, (partial) => {
          ed.updateShapes([
            {
              id: contentShape.id,
              props: { richText: toRichText(partial) },
            },
          ])
        })
      }

      await sleep(200)

      if (points.length > 0) {
        ed.createShape({
          type: 'text',
          x: xStart + 40,
          y: yStart + 320,
          props: {
            richText: toRichText('Key Points'),
            color: 'black',
            size: 'l',
            font: 'serif',
            w: 720,
          },
        })

        ed.createShape({
          type: 'text',
          x: xStart + 50,
          y: yStart + 360,
          props: {
            richText: toRichText(points.map(p => `• ${p}`).join('\n')),
            color: 'black',
            size: 's',
            font: 'sans',
            w: 700,
          },
        })
      }
    } finally {
      setIsStreaming(false)
    }

    // 🔊 Voice
    if (step.voice?.script) {
      try {
        setIsSpeaking(true)
        await playSpeech(step.voice.script)
      } finally {
        setIsSpeaking(false)
      }
    }

    // 🎯 Slide number
    ed.createShape({
      type: 'text',
      x: xStart + 700,
      y: yStart + 20,
      props: {
        richText: toRichText(`Slide ${allShapes.length + 1}`),
        color: 'grey',
        size: 's',
        font: 'sans',
      },
    })

    // 🎬 Smooth camera
    ed.setCamera(
      {
        x: 0,
        y: yStart - 200,
        z: 1,
      },
      { animation: { duration: 500 } }
    )
  }

  const fetchStep = useCallback(async (path) => {
    if (!sessionId) throw new Error('No session ID')
    setIsLoading(true)

    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/${path}`,
        { method: 'POST' }
      )

      if (!res.ok) throw new Error(await res.text())
      return await res.json()
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const startLearning = useCallback(async () => {
    if (isStreaming) return

    const payload = await fetchStep('teach/start')

    if (payload?.canvas) {
      setCurrentStep(payload)
      await createShapesForStep(payload)
    }
  }, [fetchStep, isStreaming])

  const nextStep = useCallback(async () => {
    if (isStreaming) return

    const payload = await fetchStep('teach/next')

    if (payload.message === 'Teaching completed') {
      setCurrentStep(null)
      return
    }

    if (payload?.canvas) {
      setCurrentStep(payload)
      await createShapesForStep(payload)
    }
  }, [fetchStep, isStreaming])

  return {
    isLoading,
    isStreaming,
    isSpeaking,
    currentStep,
    startLearning,
    nextStep,
  }
}