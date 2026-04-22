import { useState, useRef, useCallback } from 'react'
import { Box, toRichText } from '@tldraw/editor'
import { createShapeId } from 'tldraw'
import { generateSpeech, createSpeechPlayer } from '../services/tts'
import { layoutGraph } from '../utils/graphLayout'
import { paintGraph, getGraphBounds } from '../utils/paintGraph'

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

  const createShapesForStep = async (step) => {
    const ed = editorRef.current
    if (!ed || !step) return

    clearSlideShapes(ed)

    const speechPromise = step.voice?.script
      ? getSpeechPromise(step.voice.script)
      : null

    const viewportBounds = typeof ed.getViewportScreenBounds === 'function'
      ? ed.getViewportScreenBounds()
      : null
    const viewportWidth = Math.round(viewportBounds?.w || window.innerWidth || 1280)
    const viewportHeight = Math.round(viewportBounds?.h || window.innerHeight || 720)

    // Keep a predictable frame so the whole slide remains visible at z=1.
    const horizontalPadding = Math.round(viewportWidth * 0.03)
    // Reserve space for the floating toolbar + teaching status strip.
    const topPadding = Math.round(viewportHeight * 0.095)
    const bottomPadding = Math.round(viewportHeight * 0.065)
    const usableWidth = Math.max(1, viewportWidth - horizontalPadding * 2)
    const usableHeight = Math.max(1, viewportHeight - topPadding - bottomPadding)

    const slideAspectRatio = 16 / 9
    const widthByHeight = usableHeight * slideAspectRatio
    const SLIDE_WIDTH = Math.round(Math.min(usableWidth, widthByHeight))
    const SLIDE_HEIGHT = Math.round((SLIDE_WIDTH / slideAspectRatio) * 0.97)
    const xStart = 0
    const yStart = 0

    const LEFT_PANEL_RATIO = 0.45
    const leftPanelWidth = Math.round(SLIDE_WIDTH * LEFT_PANEL_RATIO)
    const rightPanelWidth = SLIDE_WIDTH - leftPanelWidth
    const leftPanelX = xStart
    const rightPanelX = xStart + leftPanelWidth

    const leftPadding = 40
    const rightPadding = 28
    const topContentY = yStart + 50
    const textWidth = Math.max(260, leftPanelWidth - leftPadding - rightPadding)

    const slideFrameBounds = new Box(xStart - 1, yStart - 1, SLIDE_WIDTH + 2, SLIDE_HEIGHT + 2)

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

    // Vertical divider for split layout
    const splitDividerId = createShapeId()
    slideShapeIdsRef.current.push(splitDividerId)
    ed.createShape({
      id: splitDividerId,
      type: 'geo',
      x: rightPanelX,
      y: yStart + 26,
      props: {
        geo: 'rectangle',
        w: 2,
        h: Math.max(10, SLIDE_HEIGHT - 52),
        fill: 'solid',
        color: 'grey',
        size: 's',
        dash: 'solid',
      },
    })

    // Left panel: title
    const titleId = createShapeId()
    slideShapeIdsRef.current.push(titleId)
    ed.createShape({
      id: titleId,
      type: 'text',
      x: leftPanelX + leftPadding,
      y: topContentY,
      props: {
        richText: toRichText(step.canvas.title || step.topic || 'Untitled'),
          color: 'white',
        size: 'xl',
        font: 'serif',
        w: textWidth,
        autoSize: false,
      },
    })

    // ➖ Divider
    const dividerId = createShapeId()
    slideShapeIdsRef.current.push(dividerId)
    ed.createShape({
      id: dividerId,
      type: 'geo',
      x: leftPanelX + leftPadding,
      y: topContentY + 50,
      props: {
        geo: 'rectangle',
        w: Math.round(leftPanelWidth * 0.24),
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
      x: leftPanelX + leftPadding,
      y: topContentY + 90,
      props: {
        richText: toRichText(content),
          color: 'white',
        size: 'l',
        font: 'sans',
        w: textWidth,
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
      const keyPointsWidth = Math.max(220, textWidth - 20)

      const keyTitleId = createShapeId()
      slideShapeIdsRef.current.push(keyTitleId)
      ed.createShape({
        id: keyTitleId,
        type: 'text',
        x: leftPanelX + leftPadding,
        y: yStart + Math.round(SLIDE_HEIGHT * 0.56),
        props: {
          richText: toRichText('Key Points'),
            color: 'white',
          size: 'l',
          font: 'serif',
          w: textWidth,
          autoSize: false,
        },
      })

      const keyPointsId = createShapeId()
      slideShapeIdsRef.current.push(keyPointsId)
      ed.createShape({
        id: keyPointsId,
        type: 'text',
        x: leftPanelX + leftPadding + 10,
        y: yStart + Math.round(SLIDE_HEIGHT * 0.62),
        props: {
          richText: toRichText(points.map(p => `• ${p}`).join('\n')),
            color: 'white',
          size: 's',
          font: 'sans',
          w: keyPointsWidth,
          autoSize: false,
        },
      })
    }

    // Right panel title
    const graphTitleId = createShapeId()
    slideShapeIdsRef.current.push(graphTitleId)
    ed.createShape({
      id: graphTitleId,
      type: 'text',
      x: rightPanelX + 28,
      y: yStart + 42,
      props: {
        richText: toRichText('Concept Graph'),
        color: 'white',
        size: 'l',
        font: 'serif',
        w: Math.max(220, rightPanelWidth - 56),
        autoSize: false,
      },
    })

    // Right panel graph rendering
    if (step.visual_graph?.nodes?.length) {
      try {
        const laidOut = layoutGraph(step.visual_graph)
        const positioned = laidOut?.positioned || {}
        const positionedEntries = Object.entries(positioned)

        if (positionedEntries.length) {
          const dividerSafeInset = 10
          const panelPaddingX = 26
          const panelPaddingTop = 95
          const panelPaddingBottom = 24

          const graphAreaX = rightPanelX + panelPaddingX + dividerSafeInset
          const graphAreaY = yStart + panelPaddingTop
          const graphAreaW = Math.max(170, rightPanelWidth - (panelPaddingX * 2) - dividerSafeInset)
          const graphAreaH = Math.max(170, SLIDE_HEIGHT - panelPaddingTop - panelPaddingBottom)

          const nodeCount = positionedEntries.length
          const denseScale = nodeCount >= 8 ? 0.88 : (nodeCount >= 6 ? 0.94 : 1)
          const initialBounds = getGraphBounds(positioned, { scale: denseScale })

          const fitScale = Math.min(
            graphAreaW / Math.max(1, initialBounds.width),
            graphAreaH / Math.max(1, initialBounds.height),
            1
          )
          const renderScale = Math.min(1, fitScale * denseScale)

          const sourceCenterX = initialBounds.minX + initialBounds.width / 2
          const sourceCenterY = initialBounds.minY + initialBounds.height / 2
          const targetCenterX = graphAreaX + graphAreaW / 2
          const targetCenterY = graphAreaY + graphAreaH / 2

          const shifted = {}
          positionedEntries.forEach(([id, node]) => {
            shifted[id] = {
              ...node,
              x: (node.x - sourceCenterX) * fitScale + targetCenterX,
              y: (node.y - sourceCenterY) * fitScale + targetCenterY,
            }
          })

          const graphShapeIds = paintGraph(
            ed,
            { positioned: shifted, edges: laidOut.edges || [] },
            { autoFit: false, scale: renderScale }
          )
          if (Array.isArray(graphShapeIds) && graphShapeIds.length) {
            slideShapeIdsRef.current.push(...graphShapeIds)
          }
        }
      } catch (err) {
        console.error('Graph render error:', err)
      }
    }

    // Reframe from any previous pan/zoom and reserve top safe space for the teaching status strip.
    if (typeof ed.zoomToBounds === 'function') {
      const fitTopInset = Math.round(viewportHeight * 0.04)
      const fitBottomInset = Math.round(viewportHeight * 0.0001)
      const cameraFitBounds = new Box(
        slideFrameBounds.x,
        slideFrameBounds.y - fitTopInset,
        slideFrameBounds.w,
        slideFrameBounds.h + fitTopInset + fitBottomInset
      )

      ed.zoomToBounds(cameraFitBounds, { animation: { duration: 320 } })
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