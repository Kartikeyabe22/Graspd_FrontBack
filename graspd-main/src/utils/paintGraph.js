import { createShapeId, toRichText } from 'tldraw'
import { getNodeSize } from './graphLayout'

const TYPE_STYLES = {
  core: { color: 'violet', fill: 'solid' },
  sub:  { color: 'blue',   fill: 'semi'  },
}

const TYPE_TEXT_SIZE = {
  core: 'm',
  sub:  's',
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

    // --- Draw edges first (behind everything) ---
    ;(edges || []).forEach(edge => {
      const fromNode = positioned[String(edge.from)]
      const toNode   = positioned[String(edge.to)]
      if (!fromNode || !toNode) return

      const fromCenter = nodeCenter(fromNode)
      const toCenter   = nodeCenter(toNode)

      const arrowId = createShapeId()
      createdIds.push(arrowId)

      editor.createShape({
        id:   arrowId,
        type: 'arrow',
        x:    0,
        y:    0,
        props: {
          kind:           'arc',
          start:          { x: fromCenter.x, y: fromCenter.y },
          end:            { x: toCenter.x,   y: toCenter.y   },
          bend:           0,
          color:          'grey',
          size:           's',
          fill:           'none',
          dash:           'solid',
          arrowheadStart: 'none',
          arrowheadEnd:   'arrow',
          font:           'sans',
          richText:       toRichText(''),
          labelPosition:  0.5,
          scale:          1,
          labelColor:     'black',
          elbowMidPoint:  0.5,
        },
      })
    })

    // --- Draw nodes ---
    nodes.forEach(node => {
      const gid = String(node.id)

      // Detail nodes: plain text only, no box
      if (node.type === 'detail') {
        const label = String(node.label || '').trim()
        editor.createShape({
          id:   idMap[gid],
          type: 'text',
          x:    node.x,
          y:    node.y,
          props: {
            richText: toRichText(label),
            color:    'red',
            size:     's',
            font:     'sans',
            textAlign: 'middle',
            autoSize: true,
            scale:    1,
          },
        })
        createdIds.push(idMap[gid])
        return
      }

      // Core and sub nodes: draw as geo shapes
      const style = TYPE_STYLES[node.type] || TYPE_STYLES.sub
      const tSize = TYPE_TEXT_SIZE[node.type] || 's'
      const { w, h } = getNodeSize(node)

      const charPx       = tSize === 'm' ? 8 : 7
      const maxChars     = Math.max(8, Math.floor((w - 16) / charPx))
      const wrappedLabel = wrapLabel(node.label, maxChars)

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
          w:             shapeW,
          h:             shapeH,
          richText:      toRichText(wrappedLabel),
          color:         style.color,
          size:          tSize,
          fill:          style.fill,
          font:          'sans',
          align:         'middle',
          verticalAlign: 'middle',
          dash:          'solid',
          labelColor:    'black',
          url:           '',
          scale:         1,
          growY:         0,
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
