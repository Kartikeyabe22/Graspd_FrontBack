import sqlite3
from datetime import datetime

# Database configuration
DB_PATH = "chat_sessions.db"

def get_db_conn():
    """Get a database connection with row factory set to Row."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database tables."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    name TEXT,
                    created_at TEXT
                    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    role TEXT,
                    content TEXT,
                    timestamp TEXT
                    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS session_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    file_name TEXT,
                    local_path TEXT,
                    uploaded_at TEXT
                    )""")
    # New table: document_chunks
    cur.execute("""CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        file_path TEXT,
        chunk_index INTEGER,
        page_number INTEGER,
        content TEXT
    )""")

    # New table: document_topics
    cur.execute("""CREATE TABLE IF NOT EXISTS document_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        file_path TEXT,
        topic_index INTEGER,
        topic_text TEXT,
        start_chunk_index INTEGER,
        end_chunk_index INTEGER
    )""")

    conn.commit()

    # Migration: Add name column if it doesn't exist
    try:
        cur.execute("ALTER TABLE sessions ADD COLUMN name TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists

    return conn

def get_sessions_from_db():
    """Get all session IDs from the database."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT session_id FROM sessions ORDER BY rowid")
    return [row[0] for row in cur.fetchall()]

def add_session_to_db(session_id: str):
    """Add a new session to the database."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO sessions (session_id, created_at) VALUES (?, ?)",
                (session_id, datetime.utcnow().isoformat()))
    conn.commit()

def delete_session_from_db(session_id: str):
    """Delete a session and all its related data from the database."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    cur.execute("DELETE FROM history WHERE session_id = ?", (session_id,))
    cur.execute("DELETE FROM session_files WHERE session_id = ?", (session_id,))
    conn.commit()

def add_history_to_db(session_id: str, role: str, content: str):
    """Add a message to the chat history."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO history (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                (session_id, role, content, datetime.utcnow().isoformat()))
    conn.commit()

def get_history_from_db(session_id: str):
    """Get chat history for a session."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT role, content, timestamp FROM history WHERE session_id = ? ORDER BY id", (session_id,))
    return cur.fetchall()

def add_file_to_db(session_id: str, file_name: str, local_path: str):
    """Add uploaded file metadata to the database."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO session_files (session_id, file_name, local_path, uploaded_at) VALUES (?, ?, ?, ?)",
                (session_id, file_name, local_path, datetime.utcnow().isoformat()))
    conn.commit()

def update_session_name(session_id: str, new_name: str):
    """Update the name of a session."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("UPDATE sessions SET name = ? WHERE session_id = ?", (new_name, session_id))
    conn.commit()

def get_session_name(session_id: str):
    """Get the name of a session."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT name FROM sessions WHERE session_id = ?", (session_id,))
    row = cur.fetchone()
    return row[0] if row and row[0] else session_id

def get_files_from_db(session_id: str):
    """Get all files for a session."""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT file_name, local_path, uploaded_at FROM session_files WHERE session_id = ? ORDER BY uploaded_at", (session_id,))
    return cur.fetchall()

# -------------------- CHUNKS & TOPICS --------------------
def add_chunk_to_db(session_id: str, file_path: str, chunk_index: int, page_number: int, content: str):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO document_chunks (session_id, file_path, chunk_index, page_number, content) VALUES (?, ?, ?, ?, ?)",
        (session_id, file_path, chunk_index, page_number, content)
    )
    conn.commit()

def get_chunks_for_file(session_id: str, file_path: str):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT chunk_index, page_number, content FROM document_chunks WHERE session_id = ? AND file_path = ? ORDER BY chunk_index ASC",
        (session_id, file_path)
    )
    return cur.fetchall()

def get_chunks_by_range(session_id: str, file_path: str, start_chunk: int, end_chunk: int):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT chunk_index, page_number, content FROM document_chunks WHERE session_id = ? AND file_path = ? AND chunk_index >= ? AND chunk_index <= ? ORDER BY chunk_index ASC",
        (session_id, file_path, start_chunk, end_chunk)
    )
    return cur.fetchall()

def add_topic_to_db(session_id: str, file_path: str, topic_index: int, topic_text: str, start_chunk_index: int, end_chunk_index: int):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO document_topics (session_id, file_path, topic_index, topic_text, start_chunk_index, end_chunk_index) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, file_path, topic_index, topic_text, start_chunk_index, end_chunk_index)
    )
    conn.commit()

def get_topics_for_file(session_id: str, file_path: str):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT topic_index, topic_text, start_chunk_index, end_chunk_index FROM document_topics WHERE session_id = ? AND file_path = ? ORDER BY topic_index ASC",
        (session_id, file_path)
    )
    return cur.fetchall()