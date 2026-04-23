import { createShapeId, toRichText } from 'tldraw'
import { getNodeSize } from './graphLayout'

const TYPE_STYLES = {
  core:   { color: 'violet', fill: 'solid' },
  sub:    { color: 'blue',   fill: 'semi'  },
  detail: { color: 'grey',   fill: 'none'  },
}

const TYPE_TEXT_SIZE = {
  core:   'm',
  sub:    's',
  detail: 's',
}

function wrapLabel(label, maxCharsPerLine = 14) {
  const words = String(label || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''

  let line1 = ''
  let line2 = ''

  for (let i = 0; i < words.length; i++) {
    const candidate = line1 ? `${line1} ${words[i]}` : words[i]
    if (!line1 || candidate.length <= maxCharsPerLine) {
      line1 = candidate
    } else {
      line2 = words.slice(i).join(' ')
      break
    }
  }

  if (!line2) return line1

  if (line2.length > maxCharsPerLine) {
    line2 = line2.slice(0, maxCharsPerLine - 1).trimEnd() + '…'
  }

  return `${line1}\n${line2}`
}

function rectEdgePoint(node, target) {
  const { w, h } = getNodeSize(node)
  const cx = node.x + w / 2
  const cy = node.y + h / 2
  const dx = target.x - cx
  const dy = target.y - cy

  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const tx = w / 2 / Math.abs(dx || 1e-9)
  const ty = h / 2 / Math.abs(dy || 1e-9)
  const t  = Math.min(tx, ty)

  return {
    x: cx + dx * t,
    y: cy + dy * t,
  }
}

function nodeCenter(node) {
  const { w, h } = getNodeSize(node)
  return { x: node.x + w / 2, y: node.y + h / 2 }
}

export function paintGraph(editor, { positioned, edges }, options = {}) {
  const createdIds = []
  const idMap      = {}

  const nodes = Object.values(positioned || {})
  if (!nodes.length) return createdIds

  Object.keys(positioned).forEach(gid => { idMap[gid] = createShapeId() })

  editor.run(() => {
    // Draw edges first (behind nodes)
    ;(edges || []).forEach(edge => {
      const fromNode = positioned[String(edge.from)]
      const toNode   = positioned[String(edge.to)]
      if (!fromNode || !toNode) return

      const toCenter   = nodeCenter(toNode)
      const fromCenter = nodeCenter(fromNode)
      const start      = rectEdgePoint(fromNode, toCenter)
      const end        = rectEdgePoint(toNode,   fromCenter)

      const arrowId = createShapeId()
      createdIds.push(arrowId)

      editor.createShape({
        id:   arrowId,
        type: 'arrow',
        props: {
          start,
          end,
          color:          'grey',
          size:           's',
          arrowheadEnd:   'arrow',
          arrowheadStart: 'none',
          bend:           0,
        },
      })
    })

    // Draw nodes
    nodes.forEach(node => {
      const gid   = String(node.id)
      const style = TYPE_STYLES[node.type]    || TYPE_STYLES.detail
      const tSize = TYPE_TEXT_SIZE[node.type] || 's'
      const { w, h } = getNodeSize(node)

      const charPx       = tSize === 'm' ? 8 : 7
      const maxChars     = Math.max(8, Math.floor((w - 16) / charPx))
      const wrappedLabel = wrapLabel(node.label, maxChars)

      // Core nodes use ellipse, others use rectangle
      const geo    = node.type === 'core' ? 'ellipse' : 'rectangle'
      const shapeW = node.type === 'core' ? w * 1.15 : w
      const shapeH = node.type === 'core' ? h * 1.30 : h
      const shapeX = node.type === 'core' ? node.x - (shapeW - w) / 2 : node.x
      const shapeY = node.type === 'core' ? node.y - (shapeH - h) / 2 : node.y

      editor.createShape({
        id:   idMap[gid],
        type: 'geo',
        x:    shapeX,
        y:    shapeY,
        props: {
          geo,
          w:        shapeW,
          h:        shapeH,
          richText: toRichText(wrappedLabel),
          color:    style.color,
          size:     tSize,
          fill:     style.fill,
          font:     'sans',
          align:    'middle',
        },
      })

      createdIds.push(idMap[gid])
    })
  })

  if (options.autoFit !== false) {
    setTimeout(() => editor.zoomToFit({ animation: { duration: 500 } }), 80)
  }

  return createdIds
}

export { getGraphBounds } from './graphLayout'
