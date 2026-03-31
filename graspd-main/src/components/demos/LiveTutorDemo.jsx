import { useEffect, useState } from 'react'
import styles from './LiveTutorDemo.module.css'

const CONVOS = [
  { q: 'what is weight update?', a: 'after computing the gradient, each weight shifts slightly in the direction that reduces loss, scaled by the learning rate.', node: 'Weight Update', r1: '3blue1brown gradient descent', r2: 'cs231n optimization notes' },
  { q: 'how does backprop work?', a: 'errors flow backward from output to input, and each weight learns how much it contributed to the mistake.', node: 'Backpropagation', r1: 'andrej karpathy backprop guide', r2: 'deep learning book ch.6' },
  { q: 'what is overfitting?', a: 'the model memorises training data but fails on new inputs. dropout and regularisation both reduce this.', node: 'Regularisation', r1: 'ml crash course overfitting', r2: 'arxiv dropout paper' },
  { q: 'explain learning rate', a: 'a hyperparameter that controls how large each weight update step is. too large and it overshoots; too small and it crawls.', node: 'Learning Rate', r1: 'fast.ai practical deep learning', r2: 'coursera tuning learning rate' },
]

const NODES = ['Gradient Descent', 'Loss Function', 'Learning Rate', 'Weight Update']

const WF_HEIGHTS = [4,10,18,26,32,22,14,28,32,20,28,16,32,24,14,28,20,10,24,16,10,6,4,8]

export default function LiveTutorDemo() {
  const [ci, setCi] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => {
        setCi(prev => (prev + 1) % CONVOS.length)
        setVisible(true)
      }, 380)
    }, 4400)
    return () => clearTimeout(t)
  }, [ci])

  const d = CONVOS[ci]

  return (
    <div className="demo-box">
      <div className="dbar">
        <div className="ddot dd1" /><div className="ddot dd2" /><div className="ddot dd3" />
        <span className="dlabel">canvas / live-tutor</span>
      </div>
      <div className={styles.split}>
        {/* LEFT: mini canvas */}
        <div className={styles.left}>
          <div className={styles.grid} />
          {NODES.map(n => (
            <div
              key={n}
              className={`${styles.node} ${d.node === n ? styles.activeNode : ''}`}
            >
              {n}
            </div>
          ))}
          <svg className={styles.svg} viewBox="0 0 200 160" fill="none">
            <line x1="100" y1="32" x2="52"  y2="76" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <line x1="100" y1="32" x2="148" y2="76" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <line x1="52"  y1="96" x2="100" y2="128" stroke="rgba(74,222,128,0.3)" strokeWidth="1" strokeDasharray="3,3" className={styles.activeConn} />
            <line x1="148" y1="96" x2="100" y2="128" stroke="rgba(74,222,128,0.3)" strokeWidth="1" strokeDasharray="3,3" className={styles.activeConn} />
          </svg>
          <div className={styles.focusRing} />
        </div>

        {/* RIGHT: voice panel */}
        <div className={styles.right}>
          <div className={styles.header}>
            <div className={styles.agentDot} />
            <span className={styles.agentLabel}>live tutor</span>
            <span className={styles.agentState}>speaking</span>
          </div>

          {/* Waveform */}
          <div className={styles.waveform}>
            {WF_HEIGHTS.map((h, i) => (
              <div
                key={i}
                className={styles.wfBar}
                style={{ height: h, animationDelay: `${(i * 0.04) % 0.34}s` }}
              />
            ))}
          </div>

          {/* Transcript */}
          <div
            className={styles.convo}
            style={{ opacity: visible ? 1 : 0, transition: 'opacity .3s' }}
          >
            <div className={`${styles.bubble} ${styles.user}`}>{d.q}</div>
            <div className={`${styles.bubble} ${styles.ai}`}>{d.a}</div>
          </div>

          {/* Resources */}
          <div
            className={styles.resources}
            style={{ opacity: visible ? 1 : 0, transition: 'opacity .3s' }}
          >
            <div className={styles.resLabel}>suggested</div>
            <div className={styles.chip}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4.5" stroke="rgba(248,113,113,0.6)" strokeWidth="1"/><polygon points="4,3 4,7 7.5,5" fill="rgba(248,113,113,0.6)"/></svg>
              <span>{d.r1}</span>
            </div>
            <div className={styles.chip}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="1" width="8" height="8" rx="1" stroke="rgba(96,165,250,0.6)" strokeWidth="1"/><line x1="3" y1="4" x2="7" y2="4" stroke="rgba(96,165,250,0.6)" strokeWidth="1"/><line x1="3" y1="6" x2="6" y2="6" stroke="rgba(96,165,250,0.6)" strokeWidth="1"/></svg>
              <span>{d.r2}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}