import { createShapeId, toRichText } from 'tldraw'

const NODE_WIDTH  = 160
const NODE_HEIGHT = 48

const TYPE_STYLES = {
  core:   { color: 'green',  size: 'l', fill: 'solid' },
  sub:    { color: 'blue',   size: 'm', fill: 'semi'  },
  detail: { color: 'orange', size: 's', fill: 'none'  },
}

// Estimate width needed based on label length
function nodeWidth(label, type) {
  if (type === 'core')   return Math.max(200, label.length * 11)
  if (type === 'sub')    return Math.max(160, label.length * 9)
  return Math.max(140, label.length * 8)
}

function nodeHeight(type) {
  if (type === 'core') return 60
  if (type === 'sub')  return 52
  return 48
}

export function paintGraph(editor, { positioned, edges }) {
  const idMap = {}

  Object.keys(positioned).forEach(gId => {
    idMap[gId] = createShapeId()
  })

  editor.run(() => {
    // 1. Draw edges first
    edges.forEach(edge => {
      const fromNode = positioned[edge.from]
      const toNode   = positioned[edge.to]
      if (!fromNode || !toNode) return

      const fw = nodeWidth(fromNode.label, fromNode.type)
      const fh = nodeHeight(fromNode.type)
      const tw = nodeWidth(toNode.label, toNode.type)
      const th = nodeHeight(toNode.type)

      editor.createShape({
        type: 'arrow',
        props: {
          start: {
            x: fromNode.x + fw / 2,
            y: fromNode.y + fh / 2,
          },
          end: {
            x: toNode.x + tw / 2,
            y: toNode.y + th / 2,
          },
          color:          'grey',
          arrowheadEnd:   'arrow',
          arrowheadStart: 'none',
        },
      })
    })

    // 2. Draw nodes
    Object.entries(positioned).forEach(([gId, node]) => {
      const style = TYPE_STYLES[node.type] || TYPE_STYLES.detail
      const w     = nodeWidth(node.label, node.type)
      const h     = nodeHeight(node.type)

      editor.createShape({
        id:   idMap[gId],
        type: 'geo',
        x:    node.x,
        y:    node.y,
        props: {
          geo:      'rectangle',
          w,
          h,
          richText: toRichText(node.label),
          color:    style.color,
          size:     style.size,
          fill:     style.fill,
        },
      })
    })
  })

  // Zoom to fit with padding
  setTimeout(() => {
    editor.zoomToFit({ animation: { duration: 600 } })
  }, 100)
}