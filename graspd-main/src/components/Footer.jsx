import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.logo}>graspd.ai</div>
      <ul className={styles.links}>
        {['docs','github','discord','privacy'].map(l => (
          <li key={l}><a href="#">{l}</a></li>
        ))}
      </ul>
      <div className={styles.copy}>© 2026 graspd</div>
    </footer>
  )
}