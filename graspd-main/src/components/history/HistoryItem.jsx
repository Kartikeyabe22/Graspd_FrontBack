import { useState } from 'react'
import styles from './HistoryItem.module.css'

export default function HistoryItem({ session, isActive, onClick, onDelete }) {
  const [hovering, setHovering] = useState(false)

  function handleDelete(e) {
    e.stopPropagation()
    onDelete(session.id)
  }

  const time = new Date(session.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className={styles.icon}>◈</div>
      <div className={styles.info}>
        <div className={styles.topic}>{session.topic}</div>
        <div className={styles.time}>{time}</div>
      </div>
      {hovering && (
        <button className={styles.delete} onClick={handleDelete}>✕</button>
      )}
    </div>
  )
}
