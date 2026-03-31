import { useEffect, useRef, useState } from 'react'
import styles from './AiCanvasDemo.module.css'

const TOPICS = [
  {
    label: 'photosynthesis',
    nodes: [
      { t: 'Sunlight Absorbed', c: 'g', x: 42,  y: 68  },
      { t: 'Light Reactions',   c: 'b', x: 16,  y: 124 },
      { t: 'Calvin Cycle',      c: 'b', x: 174, y: 124 },
      { t: 'ATP + NADPH',       c: 'o', x: 50,  y: 180 },
      { t: 'Glucose Output',    c: 'g', x: 36,  y: 236 },
    ],
  },
  {
    label: 'sorting algorithms',
    nodes: [
      { t: 'Input Array',    c: 'b', x: 56,  y: 68  },
      { t: 'Divide',         c: 'o', x: 16,  y: 124 },
      { t: 'Compare',        c: 'o', x: 176, y: 124 },
      { t: 'Merge / Swap',   c: 'g', x: 44,  y: 180 },
      { t: 'Sorted Output',  c: 'g', x: 38,  y: 236 },
    ],
  },
  {
    label: 'black holes',
    nodes: [
      { t: 'Stellar Collapse',    c: 'b', x: 38, y: 68  },
      { t: 'Event Horizon',       c: 'o', x: 10, y: 124 },
      { t: 'Singularity',         c: 'o', x: 176,y: 124 },
      { t: 'Hawking Radiation',   c: 'b', x: 28, y: 180 },
      { t: 'Info Paradox',        c: 'g', x: 50, y: 236 },
    ],
  },
  {
    label: 'quantum entanglement',
    nodes: [
      { t: 'Particle Pair',     c: 'g', x: 48, y: 68  },
      { t: 'Superposition',     c: 'b', x: 10, y: 124 },
      { t: 'Measurement',       c: 'b', x: 172,y: 124 },
      { t: 'Wave Collapse',     c: 'o', x: 44, y: 180 },
      { t: 'Correlated Result', c: 'g', x: 24, y: 236 },
    ],
  },
  {
    label: 'the french revolution',
    nodes: [
      { t: 'Financial Crisis',   c: 'o', x: 44, y: 68  },
      { t: 'Estates General',    c: 'b', x: 14, y: 124 },
      { t: 'Bastille Stormed',   c: 'g', x: 168,y: 124 },
      { t: 'Reign of Terror',    c: 'o', x: 48, y: 180 },
      { t: 'Napoleon Rises',     c: 'b', x: 46, y: 236 },
    ],
  },
]

const COLOR_MAP = {
  g: styles.nodeG,
  b: styles.nodeB,
  o: styles.nodeO,
}

export default function AiCanvasDemo() {
  const [topicIndex, setTopicIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState('typing') // typing | generating | done
  const [visibleNodes, setVisibleNodes] = useState([])
  const tiRef = useRef(null)

  useEffect(() => {
    runCycle(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runCycle(idx) {
    const topic = TOPICS[idx % TOPICS.length]
    setTopicIndex(idx)
    setTyped('')
    setPhase('typing')
    setVisibleNodes([])

    // Type the label
    let i = 0
    const typer = setInterval(() => {
      setTyped(topic.label.slice(0, ++i))
      if (i >= topic.label.length) {
        clearInterval(typer)
        setPhase('generating')

        // Show nodes one by one
        topic.nodes.forEach((_, ni) => {
          tiRef.current = setTimeout(() => {
            setVisibleNodes((prev) => [...prev, ni])
            if (ni === 0) setPhase('done')
          }, 680 + ni * 340)
        })

        // Next cycle
        tiRef.current = setTimeout(() => runCycle(idx + 1), 5400)
      }
    }, 48)
    return () => clearInterval(typer)
  }

  const topic = TOPICS[topicIndex % TOPICS.length]

  return (
    <div className="demo-box">
      <div className="dbar">
        <div className="ddot dd1" /><div className="ddot dd2" /><div className="ddot dd3" />
        <span className="dlabel">canvas / ai-generation</span>
      </div>
      <div className={styles.canvas}>
        <div className="canvas-grid" />

        {/* Prompt bar */}
        <div className={styles.prompt}>
          <span className={styles.plabel}>prompt</span>
          <span className={styles.ptext}>{typed}</span>
          <span className={styles.pcursor} />
        </div>

        {/* Status */}
        {phase === 'done' && <div className={styles.badge}>✦ ai generated</div>}
        {phase === 'generating' && (
          <div className={styles.gen}>
            <div className={styles.gd} /><div className={styles.gd} /><div className={styles.gd} />
            <span>generating…</span>
          </div>
        )}

        {/* Nodes */}
        {topic.nodes.map((n, i) => (
          visibleNodes.includes(i) && (
            <div
              key={`${topicIndex}-${i}`}
              className={`${styles.node} ${COLOR_MAP[n.c]} ${styles.nodeVisible}`}
              style={{ left: n.x, top: n.y }}
            >
              {n.t}
            </div>
          )
        ))}
      </div>
    </div>
  )
}