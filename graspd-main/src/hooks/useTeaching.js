import { useState, useRef, useCallback } from 'react'
import { Box, toRichText } from '@tldraw/editor'
import { createShapeId } from 'tldraw'
import { generateSpeech, createSpeechPlayer } from '../services/tts'

const BACKEND_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function streamText(fullText, onUpdate, options = {}) {
  const { intervalMs = 40 } = options
  let currentValue = ''
  let i = 0
  let paused = false
  let stopped = false
  let resolveDone

  const done = new Promise((resolve) => {
    resolveDone = resolve
  })

  const timer = setInterval(() => {
    if (stopped || paused) return
    if (i >= fullText.length) {
      clearInterval(timer)
      onUpdate(fullText)
      resolveDone()
      return
    }
    currentValue += fullText[i]
    onUpdate(currentValue)
    i++
  }, intervalMs)

  return {
    pause: () => {
      paused = true
    },
    resume: () => {
      paused = false
    },
    stop: () => {
      stopped = true
      clearInterval(timer)
      resolveDone()
    },
    done,
  }
}

export default function useTeaching(sessionId, editor, options = {}) {
  const { voiceRate = 1.5 } = options
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isAutoTeaching, setIsAutoTeaching] = useState(false)

  const editorRef = useRef(editor)
  editorRef.current = editor
  const textStreamRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const isPausedRef = useRef(false)
  const pauseWaitersRef = useRef([])
  const isAutoTeachingRef = useRef(false)
  const ttsCacheRef = useRef(new Map())
  const slideShapeIdsRef = useRef([])

  const setPausedState = (value) => {
    isPausedRef.current = value
    setIsPaused(value)
    if (!value && pauseWaitersRef.current.length) {
      const waiters = pauseWaitersRef.current
      pauseWaitersRef.current = []
      waiters.forEach((resume) => resume())
    }
  }

  const waitForResume = () => {
    if (!isPausedRef.current) return Promise.resolve()
    return new Promise((resolve) => {
      pauseWaitersRef.current.push(resolve)
    })
  }

  const getSpeechPromise = useCallback((script) => {
    if (!script) return null
    const cache = ttsCacheRef.current
    if (cache.has(script)) return cache.get(script)

    const speechPromise = generateSpeech(script)
      .catch((err) => {
        cache.delete(script)
        throw err
      })

    cache.set(script, speechPromise)
    return speechPromise
  }, [])

  const clearSlideShapes = (ed) => {
    if (!slideShapeIdsRef.current.length) return
    ed.deleteShapes(slideShapeIdsRef.current)
    slideShapeIdsRef.current = []
  }

  const getSlideBounds = (ed) => {
    if (!slideShapeIdsRef.current.length) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    slideShapeIdsRef.current.forEach((id) => {
      const bounds = ed.getShapePageBounds(id)
      if (!bounds) return
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.w)
      maxY = Math.max(maxY, bounds.y + bounds.h)
    })

    if (!Number.isFinite(minX)) return null
    return new Box(minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY))
  }

  const createShapesForStep = async (step) => {
    const ed = editorRef.current
    if (!ed || !step) return

    clearSlideShapes(ed)

    const speechPromise = step.voice?.script
      ? getSpeechPromise(step.voice.script)
      : null

    const SLIDE_WIDTH = 1700
    const SLIDE_HEIGHT = 700

    const xStart = (window.innerWidth - SLIDE_WIDTH) / 2
    const yStart = 100

    const content = step.canvas.content || ''
    const points = step.canvas.important_points || []

    // 🟫 Subtle border (Gamma feel)
    const borderId = createShapeId()
    slideShapeIdsRef.current.push(borderId)
    ed.createShape({
      id: borderId,
      type: 'geo',
      x: xStart - 1,
      y: yStart - 1,
      props: {
        geo: 'rectangle',
        w: SLIDE_WIDTH + 2,
        h: SLIDE_HEIGHT + 2,
        fill: 'none',
        color: 'black',
        size: 's',
        dash: 'solid',
      },
    })

    // ⬛ Main slide
    const slideId = createShapeId()
    slideShapeIdsRef.current.push(slideId)
    ed.createShape({
      id: slideId,
      type: 'geo',
      x: xStart,
      y: yStart,
      props: {
        geo: 'rectangle',
        w: SLIDE_WIDTH,
        h: SLIDE_HEIGHT,
        fill: 'semi',
        color: 'black',
        size: 'm',
        dash: 'solid',
      },
    })

    // 🧠 Title
    const titleId = createShapeId()
    slideShapeIdsRef.current.push(titleId)
    ed.createShape({
      id: titleId,
      type: 'text',
      x: xStart + 40,
      y: yStart + 50,
      props: {
        richText: toRichText(step.canvas.title || step.topic || 'Untitled'),
          color: 'white',
        size: 'xl',
        font: 'serif',
        w: 720,
        autoSize: false,
      },
    })

    // ➖ Divider
    const dividerId = createShapeId()
    slideShapeIdsRef.current.push(dividerId)
    ed.createShape({
      id: dividerId,
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
    const contentId = createShapeId()
    slideShapeIdsRef.current.push(contentId)
    ed.createShape({
      id: contentId,
      type: 'text',
      x: xStart + 40,
      y: yStart + 140,
      props: {
        richText: toRichText(content),
          color: 'white',
        size: 'l',
        font: 'sans',
        w: 720,
        autoSize: false,
      },
    })

    let speechDone = Promise.resolve()

    if (speechPromise) {
      setIsSpeaking(true)
      speechDone = speechPromise
        .then((audioBlob) => {
          if (!audioBlob) return

          return new Promise((resolve) => {
            const player = createSpeechPlayer(audioBlob, { playbackRate: voiceRate })
            audioPlayerRef.current = player

            player.audio.onended = () => {
              player.cleanup()
              audioPlayerRef.current = null
              setIsSpeaking(false)
              resolve()
            }

            player.audio.onerror = (err) => {
              player.cleanup()
              audioPlayerRef.current = null
              setIsSpeaking(false)
              console.error('Play speech error:', err)
              resolve()
            }

            if (!isPausedRef.current) {
              player.play().catch((err) => {
                console.error('Play speech error:', err)
                resolve()
              })
            }
          })
        })
        .catch((err) => {
          console.error('Play speech error:', err)
          setIsSpeaking(false)
        })
    }

    setIsStreaming(true)
    Promise.resolve(speechDone).finally(() => setIsStreaming(false))

    textStreamRef.current = null

    // Voice playback already kicked off in parallel with typing.

    if (points.length > 0) {
      const keyTitleId = createShapeId()
      slideShapeIdsRef.current.push(keyTitleId)
      ed.createShape({
        id: keyTitleId,
        type: 'text',
        x: xStart + 40,
        y: yStart + 320,
        props: {
          richText: toRichText('Key Points'),
            color: 'white',
          size: 'l',
          font: 'serif',
          w: 720,
          autoSize: false,
        },
      })

      const keyPointsId = createShapeId()
      slideShapeIdsRef.current.push(keyPointsId)
      ed.createShape({
        id: keyPointsId,
        type: 'text',
        x: xStart + 50,
        y: yStart + 360,
        props: {
          richText: toRichText(points.map(p => `• ${p}`).join('\n')),
            color: 'white',
          size: 's',
          font: 'sans',
          w: 700,
          autoSize: false,
        },
      })
    }

    // 🎬 Subtle transition to a full slide view
    const slideBounds = getSlideBounds(ed)
    if (slideBounds) {
      ed.zoomToBounds(slideBounds, { animation: { duration: 300 } })
    }
    return speechDone
  }

  const fetchStep = useCallback(async (path) => {
    if (!sessionId) throw new Error('No session ID')
    setIsLoading(true)

    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/${path}`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
          },
        }
      )

      if (!res.ok) throw new Error(await res.text())
      return await res.json()
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const startLearning = useCallback(async () => {
    if (isStreaming || isAutoTeachingRef.current) return
    setPausedState(false)
    setIsAutoTeaching(true)
    isAutoTeachingRef.current = true

    try {
      const payload = await fetchStep('teach/start')

      if (payload?.canvas) {
        setCurrentStep(payload)
        const speechDone = createShapesForStep(payload)
        const nextPayloadPromise = fetchStep('teach/next').then((nextPayload) => {
          if (nextPayload?.voice?.script) {
            getSpeechPromise(nextPayload.voice.script)
          }
          return nextPayload
        })

        await speechDone
        await waitForResume()
        let nextPayload = await nextPayloadPromise

        while (true) {
          if (nextPayload.message === 'Teaching completed') {
            setCurrentStep(null)
            break
          }

          if (nextPayload?.canvas) {
            setCurrentStep(nextPayload)
            const nextSpeechDone = createShapesForStep(nextPayload)
            const upcomingPayloadPromise = fetchStep('teach/next').then((upcomingPayload) => {
              if (upcomingPayload?.voice?.script) {
                getSpeechPromise(upcomingPayload.voice.script)
              }
              return upcomingPayload
            })

            await nextSpeechDone
            await waitForResume()
            nextPayload = await upcomingPayloadPromise
            continue
          }

          break
        }

        return
      }

      while (true) {
        await waitForResume()
        const nextPayload = await fetchStep('teach/next')

        if (nextPayload.message === 'Teaching completed') {
          setCurrentStep(null)
          break
        }

        if (nextPayload?.canvas) {
          setCurrentStep(nextPayload)
          const speechDone = createShapesForStep(nextPayload)
          if (nextPayload?.voice?.script) {
            getSpeechPromise(nextPayload.voice.script)
          }
          await speechDone
          continue
        }

        break
      }
    } finally {
      setIsAutoTeaching(false)
      isAutoTeachingRef.current = false
    }
  }, [fetchStep, isStreaming])

  const nextStep = useCallback(async () => {
    if (isStreaming) return
    setPausedState(false)

    const payload = await fetchStep('teach/next')

    if (payload.message === 'Teaching completed') {
      setCurrentStep(null)
      return
    }

    if (payload?.canvas) {
      setCurrentStep(payload)
      const speechDone = createShapesForStep(payload)
      await speechDone
    }
  }, [fetchStep, isStreaming])

  return {
    isLoading,
    isStreaming,
    isSpeaking,
    isPaused,
    currentStep,
    startLearning,
    nextStep,
    togglePause: () => {
      const nextPaused = !isPausedRef.current
      setPausedState(nextPaused)
      if (nextPaused) {
        textStreamRef.current?.pause()
        audioPlayerRef.current?.pause()
        return
      }

      textStreamRef.current?.resume()
      if (audioPlayerRef.current) {
        audioPlayerRef.current.play().catch((err) => console.error('Play speech error:', err))
      }
    },
    isAutoTeaching,
  }
}