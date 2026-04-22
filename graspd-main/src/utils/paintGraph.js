import { createShapeId, toRichText } from 'tldraw'

const TYPE_STYLES = {
  core:   { color: 'green',  size: 'l', fill: 'solid' },
  sub:    { color: 'blue',   size: 'm', fill: 'semi'  },
  detail: { color: 'orange', size: 's', fill: 'none'  },
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function nodeSizeFromType(type) {
  if (type === 'core') return { w: 210, h: 68 }
  if (type === 'sub') return { w: 175, h: 56 }
  return { w: 150, h: 50 }
}

function getDensityScale(nodeCount) {
  if (nodeCount >= 8) return 0.84
  if (nodeCount >= 6) return 0.9
  return 1
}

function getFontSizeToken(labelLength, type, effectiveScale) {
  const compact = effectiveScale < 0.88
  if (labelLength > 20 || compact) return 's'
  if (type === 'core' && labelLength <= 12 && effectiveScale >= 0.98) return 'l'
  return 'm'
}

export function getNodeRenderMetrics(node, options = {}) {
  const nodeCount = options.nodeCount || 1
  const scale = Number.isFinite(options.scale) ? options.scale : 1
  const densityScale = getDensityScale(nodeCount)
  const effectiveScale = clamp(scale * densityScale, 0.68, 1)

  const base = nodeSizeFromType(node.type)
  const labelLength = String(node.label || '').trim().length
  const widthBoost = labelLength > 22 ? 1.08 : (labelLength > 16 ? 1.03 : 1)

  return {
    w: Math.round(base.w * effectiveScale * widthBoost),
    h: Math.round(base.h * effectiveScale),
    textSize: getFontSizeToken(labelLength, node.type, effectiveScale),
    effectiveScale,
  }
}

export function getGraphBounds(positioned, options = {}) {
  const entries = Object.values(positioned || {})
  if (!entries.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const nodeCount = entries.length
  entries.forEach((node) => {
    const metrics = getNodeRenderMetrics(node, { ...options, nodeCount })
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + metrics.w)
    maxY = Math.max(maxY, node.y + metrics.h)
  })

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function getArrowAnchor(fromNode, toNode, fromMetrics, toMetrics) {
  const fromCenter = {
    x: fromNode.x + fromMetrics.w / 2,
    y: fromNode.y + fromMetrics.h / 2,
  }
  const toCenter = {
    x: toNode.x + toMetrics.w / 2,
    y: toNode.y + toMetrics.h / 2,
  }

  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y
  const length = Math.hypot(dx, dy) || 1

  const ux = dx / length
  const uy = dy / length

  const fromInset = Math.min(fromMetrics.w, fromMetrics.h) * 0.38
  const toInset = Math.min(toMetrics.w, toMetrics.h) * 0.42

  return {
    start: {
      x: fromCenter.x + ux * fromInset,
      y: fromCenter.y + uy * fromInset,
    },
    end: {
      x: toCenter.x - ux * toInset,
      y: toCenter.y - uy * toInset,
    },
  }
}

export function paintGraph(editor, { positioned, edges }, options = {}) {
  const createdShapeIds = []
  const idMap = {}
  const nodeEntries = Object.values(positioned || {})
  const nodeCount = nodeEntries.length
  const scale = Number.isFinite(options.scale) ? options.scale : 1

  Object.keys(positioned).forEach(gId => {
    idMap[gId] = createShapeId()
  })

  editor.run(() => {
    // 1. Draw edges first
    edges.forEach(edge => {
      const fromNode = positioned[edge.from]
      const toNode   = positioned[edge.to]
      if (!fromNode || !toNode) return

      const arrowId = createShapeId()
      createdShapeIds.push(arrowId)

      const fromMetrics = getNodeRenderMetrics(fromNode, { nodeCount, scale })
      const toMetrics = getNodeRenderMetrics(toNode, { nodeCount, scale })
      const anchors = getArrowAnchor(fromNode, toNode, fromMetrics, toMetrics)

      editor.createShape({
        id: arrowId,
        type: 'arrow',
        props: {
          start: anchors.start,
          end: anchors.end,
          color:          'grey',
          arrowheadEnd:   'arrow',
          arrowheadStart: 'none',
        },
      })
    })

    // 2. Draw nodes
    Object.entries(positioned).forEach(([gId, node]) => {
      const style = TYPE_STYLES[node.type] || TYPE_STYLES.detail
      const metrics = getNodeRenderMetrics(node, { nodeCount, scale })

      editor.createShape({
        id:   idMap[gId],
        type: 'geo',
        x:    node.x,
        y:    node.y,
        props: {
          geo:      'rectangle',
          w: metrics.w,
          h: metrics.h,
          richText: toRichText(node.label),
          color:    style.color,
          size:     metrics.textSize,
          fill:     style.fill,
        },
      })

      createdShapeIds.push(idMap[gId])
    })
  })

  // Zoom to fit with padding
  if (options.autoFit !== false) {
    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 600 } })
    }, 100)
  }

  return createdShapeIds
}