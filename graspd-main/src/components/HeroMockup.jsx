import styles from './HeroMockup.module.css'

export default function HeroMockup() {
  return (
    <div className={styles.mockup}>
      {/* Title bar */}
      <div className={styles.bar}>
        <div className={`${styles.dot} ${styles.d1}`} />
        <div className={`${styles.dot} ${styles.d2}`} />
        <div className={`${styles.dot} ${styles.d3}`} />
        <div className={styles.tools}>
          <div className={`${styles.tool} ${styles.active}`}>⬖</div>
          <div className={styles.tool}>▭</div>
          <div className={styles.tool}>○</div>
          <div className={styles.tool}>∿</div>
          <div className={styles.tool}>✎</div>
        </div>
      </div>

      {/* Canvas */}
      <div className={styles.canvas}>
        <div className="canvas-grid" />

        {/* Shapes */}
        <div className={styles.rect} />
        <div className={styles.circle} />
        <div className={styles.txt}>neural networks</div>

        {/* Connectors */}
        <div className={`${styles.conn} ${styles.v1}`} />
        <div className={`${styles.conn} ${styles.v2}`} />
        <div className={`${styles.conn} ${styles.v3}`} />
        <div className={`${styles.conn} ${styles.v4}`} />

        {/* Nodes */}
        <div className={`${styles.node} ${styles.green} ${styles.n1}`}>Input Layer</div>
        <div className={`${styles.node} ${styles.blue}  ${styles.n2}`}>Hidden Layer 1</div>
        <div className={`${styles.node} ${styles.blue}  ${styles.n3}`}>Hidden Layer 2</div>
        <div className={`${styles.node} ${styles.orange} ${styles.n4}`}>Activation: ReLU</div>
        <div className={`${styles.node} ${styles.green} ${styles.n5}`}>Output → Prediction</div>

        {/* Typing indicator */}
        <div className={styles.typing}>
          <div className={styles.tdot} />
          <div className={styles.tdot} />
          <div className={styles.tdot} />
        </div>

        {/* Comment */}
        <div className={styles.comment}>
          <div className={`${styles.cname} ${styles.red}`}>alice</div>
          <div className={styles.cmsg}>add backprop here?</div>
          <div className={styles.ctime}>just now</div>
        </div>

        {/* Cursors */}
        <div className={`${styles.cur} ${styles.curA}`}>
          <span className={styles.arrow} style={{ color: '#e74c3c' }}>▲</span>
          <span className={styles.label} style={{ background: '#e74c3c' }}>alice</span>
        </div>
        <div className={`${styles.cur} ${styles.curB}`}>
          <span className={styles.arrow} style={{ color: '#3b82f6' }}>▲</span>
          <span className={styles.label} style={{ background: '#3b82f6' }}>bob</span>
        </div>

        {/* Presence bar */}
        <div className={styles.presBar}>
          <div className={styles.av} style={{ background: '#e74c3c' }}>A</div>
          <div className={styles.av} style={{ background: '#3b82f6' }}>B</div>
          <div className={styles.av} style={{ background: '#10b981' }}>M</div>
          <span className={styles.avlbl}>3 people on this canvas</span>
        </div>
      </div>
    </div>
  )
}