import { useNavigate } from 'react-router-dom'
import HeroMockup from './HeroMockup'
import styles from './Hero.module.css'

export default function Hero() {
  const navigate = useNavigate()
  return (
    <section className={styles.hero}>
      <div className={`${styles.left} reveal-l`}>
        <div className={styles.eyebrow}>ai-powered learning canvas</div>
        <h1>
          stop spending hours.<br />
          <em className={styles.accent}>just understand it.</em>
        </h1>
        <p className={styles.sub}>
          type any topic. your live tutor explains it, draws the knowledge map on a shared
          canvas, and pulls every resource you need — in under 15 seconds.
        </p>
        <div className={styles.btns}>
          <button className={styles.main} onClick={() => navigate('/canvas')}>try it free</button>
          <button className={styles.outline}>watch demo</button>
        </div>
      </div>
      <div className={`${styles.right} reveal-r`}>
        <HeroMockup />
      </div>
    </section>
  )
}