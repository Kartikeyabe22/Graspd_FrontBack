import ResourceCard from './ResourceCard'
import styles from './MessageBubble.module.css'

export default function MessageBubble({ message, onDropToCanvas }) {
  const isUser = message.role === 'user'

  if (isUser) {
  return (
    <div className={styles.userWrap}>
      {message.file && (
        <div className={styles.userFile}>
          {message.file.type === 'image' ? (
            <img src={message.file.preview} className={styles.userFileImg} alt="upload" />
          ) : (
            <div className={styles.userFilePdf}>📄 {message.file.name}</div>
          )}
        </div>
      )}
      <div className={styles.userBubble}>{message.content}</div>
    </div>
  )
}

  // AI message
  const data = message.data

  return (
    <div className={styles.aiWrap}>
      {/* Type badge */}
      {data?.type && (
        <div className={`${styles.badge} ${styles[data.type]}`}>
          {data.type === 'explanation'    && '✦ explanation'}
          {data.type === 'recommendation' && '⬡ resources'}
          {data.type === 'generation'     && '◈ generated on canvas'}
        </div>
      )}

      {/* Message text */}
      <div className={styles.aiBubble}>
        {data?.message?.split('\n').map((line, i) => (
          <p key={i} className={styles.line}>{line}</p>
        ))}
      </div>

      {/* Resource cards */}
      {data?.resources?.length > 0 && (
        <div className={styles.resources}>
          {data.resources.map((r, i) => (
            <ResourceCard
              key={i}
              resource={r}
              onDropToCanvas={onDropToCanvas}
            />
          ))}
        </div>
      )}
    </div>
  )
}