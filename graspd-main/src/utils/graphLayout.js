export function layoutGraph(data) {
  const { nodes, edges } = data

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = { ...n } })

  const core = nodes.find(n => n.type === 'core')

  const subIds = edges
    .filter(e => e.from === core.id)
    .map(e => e.to)

  const detailMap = {}
  subIds.forEach(subId => {
    detailMap[subId] = edges
      .filter(e => e.from === subId)
      .map(e => e.to)
  })

  // Also handle any orphan detail nodes not connected via sub
  const allDetailIds = nodes
    .filter(n => n.type === 'detail')
    .map(n => n.id)

  const CANVAS_CENTER_X = 600
  const CANVAS_CENTER_Y = 600

  // Scale radius based on how many sub nodes there are
  const SUB_RADIUS    = Math.max(280, subIds.length * 52)
  const DETAIL_RADIUS = Math.max(180, 200)

  const positioned = {}

  // Place core at center
  positioned[core.id] = {
    ...nodeMap[core.id],
    x: CANVAS_CENTER_X,
    y: CANVAS_CENTER_Y,
  }

  // Place sub nodes evenly around core
  subIds.forEach((subId, i) => {
    const angle = (2 * Math.PI * i) / subIds.length - Math.PI / 2

    positioned[subId] = {
      ...nodeMap[subId],
      x: CANVAS_CENTER_X + SUB_RADIUS * Math.cos(angle),
      y: CANVAS_CENTER_Y + SUB_RADIUS * Math.sin(angle),
    }

    // Place detail nodes around each sub
    const details = detailMap[subId] || []
    const totalDetails = details.length

    details.forEach((detailId, j) => {
      // Fan out detail nodes around the sub node
      // Spread angle grows with number of details to avoid overlap
      const maxSpread  = Math.min(Math.PI * 0.9, totalDetails * 0.28)
      const startAngle = angle - maxSpread / 2
      const step       = totalDetails > 1 ? maxSpread / (totalDetails - 1) : 0
      const detailAngle = startAngle + step * j

      // Push further out if many details
      const radius = DETAIL_RADIUS + Math.floor(j / 4) * 80

      positioned[detailId] = {
        ...nodeMap[detailId],
        x: positioned[subId].x + radius * Math.cos(detailAngle),
        y: positioned[subId].y + radius * Math.sin(detailAngle),
      }
    })
  })

  // Handle any nodes that didn't get positioned (edge cases)
  nodes.forEach((n, i) => {
    if (!positioned[n.id]) {
      positioned[n.id] = {
        ...n,
        x: CANVAS_CENTER_X + (i * 160),
        y: CANVAS_CENTER_Y + 600,
      }
    }
  })

  return { positioned, edges }
}