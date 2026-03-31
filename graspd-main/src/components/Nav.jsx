import { useNavigate } from 'react-router-dom'
import styles from './Nav.module.css'

export default function Nav() {
  const navigate = useNavigate()

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>graspd</div>
      <ul className={styles.links}>
        <li><a href="#s1">ai canvas</a></li>
        <li><a href="#s2">collaboration</a></li>
        <li><a href="#s3">live tutor</a></li>
      </ul>
      <div className={styles.right}>
        <button className={styles.ghost}>log in</button>
        <button className={styles.solid} onClick={() => navigate('/canvas')}>
          quick try
        </button>
      </div>
    </nav>
  )
}