import styles from './CollabDemo.module.css'

export default function CollabDemo() {
  return (
    <div className="demo-box">
      <div className="dbar">
        <div className="ddot dd1" /><div className="ddot dd2" /><div className="ddot dd3" />
        <span className="dlabel">canvas / collaboration</span>
      </div>
      <div className={styles.canvas}>
        <div className="canvas-grid" />

        {/* Shapes */}
        <div className={`${styles.shape} ${styles.r1}`} />
        <div className={`${styles.shape} ${styles.r2}`} />

        {/* Comment cards */}
        <div className={`${styles.card} ${styles.c1}`}>
          <div className={styles.cname} style={{ color: '#f87171' }}>alice</div>
          <div className={styles.cmsg}>can we expand the input layer section?</div>
          <div className={styles.ctime}>2 min ago</div>
        </div>
        <div className={`${styles.card} ${styles.c2}`}>
          <div className={styles.cname} style={{ color: '#60a5fa' }}>bob</div>
          <div className={styles.cmsg}>love this layout. makes sense now.</div>
          <div className={styles.ctime}>just now</div>
        </div>
        <div className={`${styles.card} ${styles.c3}`}>
          <div className={styles.cname} style={{ color: '#4ade80' }}>maya</div>
          <div className={styles.cmsg}>@alice resolved. updated the node.</div>
          <div className={styles.ctime}>1 min ago</div>
        </div>

        {/* Cursors */}
        <div className={`${styles.cur} ${styles.cA}`}>
          <span style={{ color: '#e74c3c' }}>▲</span>
          <span className={styles.cl} style={{ background: '#e74c3c' }}>alice</span>
        </div>
        <div className={`${styles.cur} ${styles.cB}`}>
          <span style={{ color: '#3b82f6' }}>▲</span>
          <span className={styles.cl} style={{ background: '#3b82f6' }}>bob</span>
        </div>
        <div className={`${styles.cur} ${styles.cM}`}>
          <span style={{ color: '#10b981' }}>▲</span>
          <span className={styles.cl} style={{ background: '#10b981' }}>maya</span>
        </div>

        {/* Pins */}
        <div className={`${styles.pin} ${styles.p1}`}>A</div>
        <div className={`${styles.pin} ${styles.p2}`}>B</div>
        <div className={`${styles.pin} ${styles.p3}`}>M</div>

        {/* Presence bar */}
        <div className={styles.bar}>
          <div className={styles.av} style={{ background: '#e74c3c' }}>A</div>
          <div className={styles.av} style={{ background: '#3b82f6' }}>B</div>
          <div className={styles.av} style={{ background: '#10b981' }}>M</div>
          <span className={styles.lbl}>3 people viewing</span>
        </div>
      </div>
    </div>
  )
}