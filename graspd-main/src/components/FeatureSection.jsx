import styles from './FeatureSection.module.css'

export default function FeatureSection({ id, eyebrowColor, eyebrowText, title, titleAccent, accentColor, description, bullets, demo, flip = false }) {
  return (
    <>
      <section className={`${styles.fsec} ${flip ? styles.flip : ''}`} id={id}>
        <div className={`${styles.copy} ${flip ? 'reveal-r' : 'reveal-l'}`}>
          <div className={styles.eyebrow}>
            <span className={styles.dot} style={{ background: eyebrowColor }} />
            {eyebrowText}
          </div>
          <h2>
            {title}<br />
            <em style={{ color: accentColor }}>{titleAccent}</em>
          </h2>
          <p className={styles.desc}>{description}</p>
          
          <div className={styles.bullets}>
            {bullets.map((b, i) => (
              <div key={i} className={styles.bullet}>
                <div className={styles.ico}>{b.icon}</div>
                <div>
                  <div className={styles.btitle}>{b.title}</div>
                  <div className={styles.bdesc}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.demo} ${flip ? 'reveal-l' : 'reveal-r'}`}>
          {demo}
        </div>
      </section>
      <div className="div" />
    </>
  )
}