const LAYOUT_CENTER_X = 560
const LAYOUT_CENTER_Y = 420
const MIN_NODE_SPACING = 140

export function distance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function resolveCollision(node, positioned, options = {}) {
  const {
    minSpacing = MIN_NODE_SPACING,
    centerX = LAYOUT_CENTER_X,
    centerY = LAYOUT_CENTER_Y,
    maxIterations = 18,
  } = options

  let candidate = { ...node }
  const allPlaced = Object.values(positioned)

  for (let i = 0; i < maxIterations; i++) {
    let collided = false

    for (const placed of allPlaced) {
      const d = distance(candidate, placed)
      if (d >= minSpacing) continue

      collided = true
      const push = (minSpacing - d) + 8
      const angleFromCenter = Math.atan2(candidate.y - centerY, candidate.x - centerX)
      const rotateJitter = (i % 2 === 0 ? 1 : -1) * (0.12 + i * 0.01)
      const angle = angleFromCenter + rotateJitter

      candidate = {
        ...candidate,
        x: candidate.x + Math.cos(angle) * push,
        y: candidate.y + Math.sin(angle) * push,
      }
    }

    if (!collided) break
  }

  return candidate
}

export function clampGraphBounds(positioned, options = {}) {
  const {
    minX = 120,
    minY = 90,
    maxX = 980,
    maxY = 760,
    padding = 20,
  } = options

  const entries = Object.entries(positioned)
  if (!entries.length) return positioned

  let graphMinX = Number.POSITIVE_INFINITY
  let graphMinY = Number.POSITIVE_INFINITY
  let graphMaxX = Number.NEGATIVE_INFINITY
  let graphMaxY = Number.NEGATIVE_INFINITY

  entries.forEach(([, node]) => {
    graphMinX = Math.min(graphMinX, node.x)
    graphMinY = Math.min(graphMinY, node.y)
    graphMaxX = Math.max(graphMaxX, node.x)
    graphMaxY = Math.max(graphMaxY, node.y)
  })

  const allowedMinX = minX + padding
  const allowedMinY = minY + padding
  const allowedMaxX = maxX - padding
  const allowedMaxY = maxY - padding

  const dx =
    graphMinX < allowedMinX
      ? (allowedMinX - graphMinX)
      : (graphMaxX > allowedMaxX ? allowedMaxX - graphMaxX : 0)
  const dy =
    graphMinY < allowedMinY
      ? (allowedMinY - graphMinY)
      : (graphMaxY > allowedMaxY ? allowedMaxY - graphMaxY : 0)

  if (!dx && !dy) return positioned

  const shifted = {}
  entries.forEach(([id, node]) => {
    shifted[id] = {
      ...node,
      x: node.x + dx,
      y: node.y + dy,
    }
  })

  return shifted
}

export function layoutGraph(data = {}) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []
  if (!nodes.length) return { positioned: {}, edges: [] }

  const nodeMap = {}
  nodes.forEach((node, index) => {
    const fallbackId = String(index + 1)
    const safeId = String(node?.id || fallbackId)
    nodeMap[safeId] = {
      ...node,
      id: safeId,
      label: String(node?.label || `Node ${safeId}`),
      type: node?.type || 'detail',
    }
  })

  const core = nodes.find((n) => n?.type === 'core') || nodes[0]
  const coreId = String(core?.id || '1')

  const subIds = edges
    .filter((edge) => String(edge?.from) === coreId)
    .map((edge) => String(edge?.to))
    .filter((id, index, arr) => nodeMap[id] && arr.indexOf(id) === index)

  if (!subIds.length) {
    nodes
      .filter((n) => String(n?.id) !== coreId)
      .slice(0, 5)
      .forEach((n) => {
        const id = String(n.id)
        if (!subIds.includes(id)) subIds.push(id)
      })
  }

  const detailMap = {}
  subIds.forEach((subId) => {
    detailMap[subId] = edges
      .filter((edge) => String(edge?.from) === subId)
      .map((edge) => String(edge?.to))
      .filter((id, index, arr) => nodeMap[id] && arr.indexOf(id) === index)
  })

  const totalNodes = Object.keys(nodeMap).length
  const denseFactor = totalNodes >= 8 ? 0.9 : (totalNodes >= 6 ? 0.96 : 1)

  const subRadiusBase = 190 + (subIds.length * 36)
  const subRadius = Math.max(180, subRadiusBase * denseFactor)
  const detailRadiusBase = 148 + Math.min(36, subIds.length * 5)
  const detailRadius = Math.max(120, detailRadiusBase * denseFactor)

  const positioned = {}
  positioned[coreId] = {
    ...nodeMap[coreId],
    x: LAYOUT_CENTER_X,
    y: LAYOUT_CENTER_Y,
  }

  const subCount = Math.max(1, subIds.length)
  subIds.forEach((subId, index) => {
    const angle = ((Math.PI * 2 * index) / subCount) - Math.PI / 2
    const baseSub = {
      ...nodeMap[subId],
      x: LAYOUT_CENTER_X + subRadius * Math.cos(angle),
      y: LAYOUT_CENTER_Y + subRadius * Math.sin(angle),
    }

    positioned[subId] = resolveCollision(baseSub, positioned, {
      minSpacing: MIN_NODE_SPACING,
      centerX: LAYOUT_CENTER_X,
      centerY: LAYOUT_CENTER_Y,
    })

    const details = detailMap[subId] || []
    const detailCount = details.length
    if (!detailCount) return

    const fanSpread = Math.min(Math.PI * 0.85, Math.PI * (0.25 + detailCount * 0.18))
    const fanStart = angle - fanSpread / 2
    const fanStep = detailCount > 1 ? fanSpread / (detailCount - 1) : 0

    details.forEach((detailId, detailIndex) => {
      const detailAngle = fanStart + (fanStep * detailIndex)
      const ring = Math.floor(detailIndex / 4)
      const radius = detailRadius + (ring * 54 * denseFactor)

      const baseDetail = {
        ...nodeMap[detailId],
        x: positioned[subId].x + radius * Math.cos(detailAngle),
        y: positioned[subId].y + radius * Math.sin(detailAngle),
      }

      positioned[detailId] = resolveCollision(baseDetail, positioned, {
        minSpacing: MIN_NODE_SPACING,
        centerX: LAYOUT_CENTER_X,
        centerY: LAYOUT_CENTER_Y,
      })
    })
  })

  let fallbackRow = 0
  Object.keys(nodeMap).forEach((id) => {
    if (positioned[id]) return
    const fallbackNode = {
      ...nodeMap[id],
      x: LAYOUT_CENTER_X - 260 + (fallbackRow * 150),
      y: LAYOUT_CENTER_Y + 280,
    }
    positioned[id] = resolveCollision(fallbackNode, positioned, {
      minSpacing: MIN_NODE_SPACING,
      centerX: LAYOUT_CENTER_X,
      centerY: LAYOUT_CENTER_Y,
    })
    fallbackRow += 1
  })

  return {
    positioned: clampGraphBounds(positioned),
    edges,
  }
}