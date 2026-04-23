const TYPE_BASE = {
  core:   { w: 110, h: 38 },
  sub:    { w:  90, h: 32 },
  detail: { w:  76, h: 28 },
}

export function getNodeSize(node) {
  const label = String(node?.label || '').trim()
  const type  = node?.type || 'detail'
  const base  = TYPE_BASE[type] || TYPE_BASE.detail
  const extra = Math.max(0, label.length - 10) * 4
  return {
    w: Math.min(base.w + extra, 160),
    h: base.h,
  }
}

function nodeRect(node) {
  const { w, h } = getNodeSize(node)
  return { x: node.x, y: node.y, w, h }
}

function rectsOverlap(a, b, pad = 14) {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  )
}

function resolveCollision(candidate, positioned, cx, cy) {
  const placed = Object.values(positioned)
  for (let iter = 0; iter < 40; iter++) {
    const r   = nodeRect(candidate)
    const hit = placed.find(p => p !== candidate && rectsOverlap(r, nodeRect(p), 14))
    if (!hit) break
    const angle = Math.atan2(candidate.y - cy, candidate.x - cx)
    const step  = 18 + iter * 3
    candidate = {
      ...candidate,
      x: candidate.x + Math.cos(angle) * step,
      y: candidate.y + Math.sin(angle) * step,
    }
  }
  return candidate
}

export function layoutGraph(data = {}, panel = { w: 360, h: 400 }) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  if (!nodes.length) return { positioned: {}, edges: [] }

  const nodeMap = {}
  nodes.forEach((n, i) => {
    const id = String(n?.id ?? i + 1)
    nodeMap[id] = {
      ...n,
      id,
      label: String(n?.label || `Node ${id}`).trim(),
      type:  n?.type || 'detail',
    }
  })

  const coreNode = nodes.find(n => n?.type === 'core') || nodes[0]
  const coreId   = String(coreNode?.id ?? '1')

  const subIds = edges
    .filter(e => String(e?.from) === coreId && nodeMap[String(e?.to)])
    .map(e => String(e.to))
    .filter((id, i, arr) => arr.indexOf(id) === i)

  if (!subIds.length) {
    Object.keys(nodeMap)
      .filter(id => id !== coreId)
      .slice(0, 5)
      .forEach(id => subIds.push(id))
  }

  const detailMap = {}
  subIds.forEach(subId => {
    detailMap[subId] = edges
      .filter(e => String(e?.from) === subId && nodeMap[String(e?.to)])
      .map(e => String(e.to))
      .filter((id, i, arr) => arr.indexOf(id) === i && id !== coreId && !subIds.includes(id))
  })

  const { w: PW, h: PH } = panel
  const cx = PW / 2
  const cy = PH / 2

  const positioned = {}

  const coreSize = getNodeSize(nodeMap[coreId])
  positioned[coreId] = {
    ...nodeMap[coreId],
    x: cx - coreSize.w / 2,
    y: cy - coreSize.h / 2,
  }

  const maxSubRadius = Math.min(PW, PH) * 0.36
  const subCount     = Math.max(1, subIds.length)
  const subRadius    = Math.min(maxSubRadius, 90 + subCount * 20)

  subIds.forEach((subId, i) => {
    const angle   = (Math.PI * 2 * i / subCount) - Math.PI / 2
    const size    = getNodeSize(nodeMap[subId])
    const rawNode = {
      ...nodeMap[subId],
      x: cx + subRadius * Math.cos(angle) - size.w / 2,
      y: cy + subRadius * Math.sin(angle) - size.h / 2,
    }
    positioned[subId] = resolveCollision(rawNode, positioned, cx, cy)

    const details   = detailMap[subId] || []
    const dc        = details.length
    if (!dc) return

    const fanSpread = Math.min(Math.PI * 0.7, 0.3 + dc * 0.25)
    const fanStart  = angle - fanSpread / 2
    const fanStep   = dc > 1 ? fanSpread / (dc - 1) : 0
    const detailRad = subRadius * 0.52 + dc * 10

    details.forEach((detId, di) => {
      const da     = fanStart + fanStep * di
      const dSize  = getNodeSize(nodeMap[detId])
      const parent = positioned[subId]
      const pcx    = parent.x + getNodeSize(nodeMap[subId]).w / 2
      const pcy    = parent.y + getNodeSize(nodeMap[subId]).h / 2
      const rawDet = {
        ...nodeMap[detId],
        x: pcx + detailRad * Math.cos(da) - dSize.w / 2,
        y: pcy + detailRad * Math.sin(da) - dSize.h / 2,
      }
      positioned[detId] = resolveCollision(rawDet, positioned, cx, cy)
    })
  })

  let fallbackCol = 0
  Object.keys(nodeMap).forEach(id => {
    if (positioned[id]) return
    const size = getNodeSize(nodeMap[id])
    const raw  = {
      ...nodeMap[id],
      x: 20 + fallbackCol * (size.w + 16),
      y: PH - size.h - 20,
    }
    positioned[id] = resolveCollision(raw, positioned, cx, cy)
    fallbackCol++
  })

  const MARGIN = 12
  Object.values(positioned).forEach(node => {
    const { w, h } = getNodeSize(node)
    node.x = Math.max(MARGIN, Math.min(node.x, PW - w - MARGIN))
    node.y = Math.max(MARGIN, Math.min(node.y, PH - h - MARGIN))
  })

  return { positioned, edges }
}

export function getGraphBounds(positioned) {
  const nodes = Object.values(positioned)
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach(n => {
    const { w, h } = getNodeSize(n)
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + w)
    maxY = Math.max(maxY, n.y + h)
  })
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
