import { useState } from 'react'
import styles from './HistoryItem.module.css'
import { updateRemoteSessionName } from '../../services/storage'

export default function HistoryItem({ session, isActive, onClick, onDelete, onUpdate }) {
  const [hovering, setHovering] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(session.topic || session.id)

  function handleDelete(e) {
    e.stopPropagation()
    onDelete(session.id)
  }

  async function handleSaveName(e) {
    e.stopPropagation()
    const newName = editName.trim()
    
    if (!newName || newName === session.topic) {
      setIsEditing(false)
      return
    }

    try {
      await updateRemoteSessionName(session.id, newName)
      setIsEditing(false)
      if (onUpdate) {
        onUpdate(session.id, newName)
      }
    } catch (error) {
      console.error('Failed to update session name:', error)
      alert('Failed to update session name')
    }
  }

  function handleEditClick(e) {
    e.stopPropagation()
    setIsEditing(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSaveName(e)
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditName(session.topic || session.id)
    }
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
        {isEditing ? (
          <input
            type="text"
            className={styles.editInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <>
            <div className={styles.topic}>{session.topic || session.id}</div>
            <div className={styles.time}>{time}</div>
          </>
        )}
      </div>
      {hovering && !isEditing && (
        <div className={styles.actions}>
          <button className={styles.edit} onClick={handleEditClick} title="Edit name">✎</button>
          <button className={styles.delete} onClick={handleDelete} title="Delete">✕</button>
        </div>
      )}
      {isEditing && (
        <div className={styles.actions}>
          <button className={styles.save} onClick={handleSaveName} title="Save">✓</button>
          <button className={styles.cancel} onClick={() => { setIsEditing(false); setEditName(session.topic || session.id) }} title="Cancel">✕</button>
        </div>
      )}
    </div>
  )
}
