const TYPE_BASE = {
  core:   { w: 120, h: 42 },
  sub:    { w: 100, h: 36 },
  detail: { w:  86, h: 30 },
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

// ─── Full-pass pair separation ────────────────────────────────────────────────
// Works in unlimited space — no clamping here — so nodes are never trapped.

function separateAll(posMap) {
  const ids  = Object.keys(posMap)
  const GAP  = 12
  const PASSES = 120

  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a   = posMap[ids[i]]
        const b   = posMap[ids[j]]
        const aSz = getNodeSize(a)
        const bSz = getNodeSize(b)

        const overlapX = Math.min(a.x + aSz.w, b.x + bSz.w) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + aSz.h, b.y + bSz.h) - Math.max(a.y, b.y)

        if (overlapX <= 0 || overlapY <= 0) continue

        moved = true
        const pushX = overlapX + GAP
        const pushY = overlapY + GAP

        if (pushX <= pushY) {
          const half = pushX / 2
          const dir  = a.x <= b.x ? -1 : 1
          posMap[ids[i]] = { ...a, x: a.x + dir * half }
          posMap[ids[j]] = { ...b, x: b.x - dir * half }
        } else {
          const half = pushY / 2
          const dir  = a.y <= b.y ? -1 : 1
          posMap[ids[i]] = { ...a, y: a.y + dir * half }
          posMap[ids[j]] = { ...b, y: b.y - dir * half }
        }
      }
    }

    if (!moved) break
  }
}

// ─── Scale + center the laid-out graph to fit inside the panel ───────────────

function fitToPanel(posMap, PW, PH) {
  const PADDING = 16
  const ids = Object.keys(posMap)
  if (!ids.length) return

  // Compute bounding box of all nodes (including their sizes)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  ids.forEach(id => {
    const n      = posMap[id]
    const { w, h } = getNodeSize(n)
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + w)
    maxY = Math.max(maxY, n.y + h)
  })

  const graphW = maxX - minX
  const graphH = maxY - minY

  const availW = PW - PADDING * 2
  const availH = PH - PADDING * 2

  // Keep 1:1 spacing so collision-free layout does not re-overlap after fitting.
  // We only translate the graph to panel center instead of scaling coordinates.
  const offsetX  = PADDING + (availW - graphW) / 2
  const offsetY  = PADDING + (availH - graphH) / 2

  ids.forEach(id => {
    const n = posMap[id]
    posMap[id] = {
      ...n,
      x: (n.x - minX) + offsetX,
      y: (n.y - minY) + offsetY,
    }
  })
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export function layoutGraph(data = {}, panel = { w: 360, h: 400 }) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  if (!nodes.length) return { positioned: {}, edges: [] }

  // Build node map
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

  // Sub nodes
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

  // Detail nodes per sub
  const detailMap = {}
  subIds.forEach(subId => {
    detailMap[subId] = edges
      .filter(e => String(e?.from) === subId && nodeMap[String(e?.to)])
      .map(e => String(e.to))
      .filter((id, i, arr) =>
        arr.indexOf(id) === i &&
        id !== coreId &&
        !subIds.includes(id)
      )
  })

  const { w: PW, h: PH } = panel

  // Use a large virtual canvas for initial placement so radii are generous
  const VCX = 600
  const VCY = 500

  const posMap = {}

  // Core at virtual centre
  const coreSize = getNodeSize(nodeMap[coreId])
  posMap[coreId] = {
    ...nodeMap[coreId],
    x: VCX - coreSize.w / 2,
    y: VCY - coreSize.h / 2,
  }

  // Subs on a circle around core.
  const subCount = Math.max(1, subIds.length)
  const subRadius = 118 + subCount * 14

  subIds.forEach((subId, i) => {
    const angle = (Math.PI * 2 * i / subCount) - Math.PI / 2
    const sz    = getNodeSize(nodeMap[subId])
    posMap[subId] = {
      ...nodeMap[subId],
      x: VCX + subRadius * Math.cos(angle) - sz.w / 2,
      y: VCY + subRadius * Math.sin(angle) - sz.h / 2,
    }
  })

  // Details placed outward from their parent sub
  subIds.forEach((subId, i) => {
    const details = detailMap[subId] || []
    if (!details.length) return

    const subAngle  = (Math.PI * 2 * i / subCount) - Math.PI / 2
    const parent    = posMap[subId]
    const subSz     = getNodeSize(nodeMap[subId])
    const pcx       = parent.x + subSz.w / 2
    const pcy       = parent.y + subSz.h / 2
    const dc        = details.length
    const detailRad = 88 + dc * 10
    const fanSpread = Math.min(Math.PI * 0.55, 0.4 + dc * 0.2)
    const fanStart  = subAngle - fanSpread / 2
    const fanStep   = dc > 1 ? fanSpread / (dc - 1) : 0

    details.forEach((detId, di) => {
      const angle = dc === 1 ? subAngle : fanStart + fanStep * di
      const sz    = getNodeSize(nodeMap[detId])
      posMap[detId] = {
        ...nodeMap[detId],
        x: pcx + detailRad * Math.cos(angle) - sz.w / 2,
        y: pcy + detailRad * Math.sin(angle) - sz.h / 2,
      }
    })
  })

  // Orphan fallback
  let col = 0
  Object.keys(nodeMap).forEach(id => {
    if (posMap[id]) return
    const sz = getNodeSize(nodeMap[id])
    posMap[id] = {
      ...nodeMap[id],
      x: VCX - 200 + col * (sz.w + 20),
      y: VCY + 300,
    }
    col++
  })

  // Step 1: separate all overlapping nodes (unlimited space)
  separateAll(posMap)

  // Step 2: scale + center the whole graph to fit inside the panel
  fitToPanel(posMap, PW, PH)

  // Step 3: final overlap cleanup in panel coordinates.
  separateAll(posMap)

  return { positioned: posMap, edges }
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

