import styles from './ResourceCard.module.css'

const ICONS = {
  youtube: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect width="14" height="14" rx="3" fill="rgba(248,113,113,0.15)"/>
      <circle cx="7" cy="7" r="4.5" stroke="rgba(248,113,113,0.7)" strokeWidth="1"/>
      <polygon points="5.5,5 5.5,9 9.5,7" fill="rgba(248,113,113,0.7)"/>
    </svg>
  ),
  article: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect width="14" height="14" rx="3" fill="rgba(96,165,250,0.15)"/>
      <line x1="3" y1="4.5" x2="11" y2="4.5" stroke="rgba(96,165,250,0.7)" strokeWidth="1"/>
      <line x1="3" y1="7"   x2="11" y2="7"   stroke="rgba(96,165,250,0.7)" strokeWidth="1"/>
      <line x1="3" y1="9.5" x2="8"  y2="9.5" stroke="rgba(96,165,250,0.7)" strokeWidth="1"/>
    </svg>
  ),
}

export default function ResourceCard({ resource, onDropToCanvas }) {
  return (
    <div className={styles.card}>
      <div className={styles.left}>
        {ICONS[resource.kind] ?? ICONS.article}
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.title}
        >
          {resource.title}
        </a>
      </div>
      <button
        className={styles.drop}
        onClick={() => onDropToCanvas(resource)}
        title="Drop to canvas"
      >
        ↗
      </button>
    </div>
  )
}