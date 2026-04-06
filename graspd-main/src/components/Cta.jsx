import styles from './Cta.module.css'

export default function Cta() {
  return (
    <section className={styles.section}>
      <div className={`${styles.inner} reveal`}>
        <h2>ready to learn differently?</h2>
        <p>
          private beta. built for students, educators, and teams who think visually.<br />
          join the waitlist. onboarding in batches.
        </p>
        <div className={styles.row}>
          <input className={styles.input} type="email" placeholder="your@email.com" />
          <button className={styles.btn}>join waitlist</button>
        </div>
      </div>
    </section>
  )
}