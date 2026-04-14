import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "database": "graspd",
    "user": "postgres",
    "password": "sus@1234",
    "port": 5432,
}

def get_db_conn():
    """Get a PostgreSQL database connection."""
    return psycopg2.connect(**DB_CONFIG)

def init_db():
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        # New table: document_slides (for slide/page-based teaching)
        cur.execute("""CREATE TABLE IF NOT EXISTS document_slides (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            session_id TEXT,
            file_path TEXT,
            slide_index INTEGER,
            title TEXT,
            content TEXT
        )""")
        # Users table for authentication
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TEXT
        )
        """)
        cur.execute("""CREATE TABLE IF NOT EXISTS sessions (
                            session_id TEXT PRIMARY KEY,
                            user_id INTEGER,
                            name TEXT,
                            created_at TEXT
                            )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS history (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER,
                            session_id TEXT,
                            role TEXT,
                            content TEXT,
                            timestamp TEXT
                            )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS session_files (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER,
                            session_id TEXT,
                            file_name TEXT,
                            local_path TEXT,
                            uploaded_at TEXT
                            )""")
        # New table: document_chunks
        cur.execute("""CREATE TABLE IF NOT EXISTS document_chunks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            session_id TEXT,
            file_path TEXT,
            chunk_index INTEGER,
            page_number INTEGER,
            content TEXT
        )""")
        # New table: document_topics
        cur.execute("""CREATE TABLE IF NOT EXISTS document_topics (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            session_id TEXT,
            file_path TEXT,
            topic_index INTEGER,
            topic_text TEXT,
            start_chunk_index INTEGER,
            end_chunk_index INTEGER
        )""")
        # Migration: Add user_id columns if they don't exist
        cur.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id INTEGER")
        cur.execute("ALTER TABLE history ADD COLUMN IF NOT EXISTS user_id INTEGER")
        cur.execute("ALTER TABLE session_files ADD COLUMN IF NOT EXISTS user_id INTEGER")
        cur.execute("ALTER TABLE document_slides ADD COLUMN IF NOT EXISTS user_id INTEGER")
        cur.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS user_id INTEGER")
        cur.execute("ALTER TABLE document_topics ADD COLUMN IF NOT EXISTS user_id INTEGER")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

# -------------------- SLIDES (PAGE-BASED) --------------------
def add_slide_to_db(session_id: str, file_path: str, slide_index: int, content: str, title: str = "", user_id: int = None):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO document_slides (session_id, user_id, file_path, slide_index, title, content) VALUES (%s, %s, %s, %s, %s, %s)",
            (session_id, user_id, file_path, slide_index, title, content)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def get_slides_for_file(session_id: str, file_path: str, user_id: int):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT slide_index, title, content FROM document_slides WHERE session_id = %s AND file_path = %s AND user_id = %s ORDER BY slide_index ASC",
            (session_id, file_path, user_id)
        )
        rows = cur.fetchall()
        # Return as list of dicts for easier use
        return [
            {"slide_index": row[0], "title": row[1], "content": row[2]} for row in rows
        ]
    finally:
        cur.close()
        conn.close()

def get_sessions_from_db(user_id: int = None):
    """Get all session IDs for a user from the database."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        if user_id is None:
            cur.execute("SELECT session_id FROM sessions ORDER BY created_at DESC")
        else:
            cur.execute(
                "SELECT session_id FROM sessions WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
        return [row[0] for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()

def get_sessions_with_created_at(user_id: int):
    """Get all session IDs and created_at values for a user, newest first."""
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT session_id, created_at FROM sessions WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def add_session_to_db(session_id: str, user_id: int = None, name: str = "", created_at: str = None):
    """Add a new session to the database for a user, with a name."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        timestamp = created_at or datetime.utcnow().isoformat()
        cur.execute(
            "INSERT INTO sessions (session_id, user_id, name, created_at) VALUES (%s, %s, %s, %s) ON CONFLICT (session_id) DO NOTHING",
            (session_id, user_id, name, timestamp)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def delete_session_from_db(session_id: str, user_id: int):
    """Delete a session and all its related data from the database for a user."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM sessions WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        cur.execute("DELETE FROM history WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        cur.execute("DELETE FROM session_files WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        cur.execute("DELETE FROM document_slides WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        cur.execute("DELETE FROM document_chunks WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        cur.execute("DELETE FROM document_topics WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def add_history_to_db(session_id: str, role: str, content: str, user_id: int = None):
    """Add a message to the chat history for a user."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO history (session_id, user_id, role, content, timestamp) VALUES (%s, %s, %s, %s, %s)",
                    (session_id, user_id, role, content, datetime.utcnow().isoformat()))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def get_history_from_db(session_id: str, user_id: int):
    """Get chat history for a session for a user."""
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT role, content, timestamp FROM history WHERE session_id = %s AND user_id = %s ORDER BY id", (session_id, user_id))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def add_file_to_db(session_id: str, file_name: str, local_path: str, user_id: int):
    """Add uploaded file metadata to the database for a user."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO session_files (session_id, user_id, file_name, local_path, uploaded_at) VALUES (%s, %s, %s, %s, %s)",
                    (session_id, user_id, file_name, local_path, datetime.utcnow().isoformat()))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def update_session_name(session_id: str, new_name: str, user_id: int):
    """Update the name of a session for a user."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE sessions SET name = %s WHERE session_id = %s AND user_id = %s", (new_name, session_id, user_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def get_session_name(session_id: str, user_id: int):
    """Get the name of a session for a user."""
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM sessions WHERE session_id = %s AND user_id = %s", (session_id, user_id))
        row = cur.fetchone()
        return row[0] if row and row[0] else session_id
    finally:
        cur.close()
        conn.close()

def get_files_from_db(session_id: str, user_id: int):
    """Get all files for a session for a user."""
    conn = get_db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT file_name, local_path, uploaded_at FROM session_files WHERE session_id = %s AND user_id = %s ORDER BY uploaded_at", (session_id, user_id))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

# -------------------- CHUNKS & TOPICS --------------------
def add_chunk_to_db(session_id: str, file_path: str, chunk_index: int, page_number: int, content: str, user_id: int):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO document_chunks (session_id, user_id, file_path, chunk_index, page_number, content) VALUES (%s, %s, %s, %s, %s, %s)",
            (session_id, user_id, file_path, chunk_index, page_number, content)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def get_chunks_for_file(session_id: str, file_path: str, user_id: int):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT chunk_index, page_number, content FROM document_chunks WHERE session_id = %s AND file_path = %s AND user_id = %s ORDER BY chunk_index ASC",
            (session_id, file_path, user_id)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_chunks_by_range(session_id: str, file_path: str, start_chunk: int, end_chunk: int, user_id: int):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT chunk_index, page_number, content FROM document_chunks WHERE session_id = %s AND file_path = %s AND chunk_index >= %s AND chunk_index <= %s AND user_id = %s ORDER BY chunk_index ASC",
            (session_id, file_path, start_chunk, end_chunk, user_id)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def add_topic_to_db(session_id: str, file_path: str, topic_index: int, topic_text: str, start_chunk_index: int, end_chunk_index: int, user_id: int):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO document_topics (session_id, user_id, file_path, topic_index, topic_text, start_chunk_index, end_chunk_index) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (session_id, user_id, file_path, topic_index, topic_text, start_chunk_index, end_chunk_index)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def get_topics_for_file(session_id: str, file_path: str, user_id: int):
    conn = get_db_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT topic_index, topic_text, start_chunk_index, end_chunk_index FROM document_topics WHERE session_id = %s AND file_path = %s AND user_id = %s ORDER BY topic_index ASC",
            (session_id, file_path, user_id)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_all_users():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, username, created_at FROM users")
        users = cur.fetchall()

        return [
            {
                "id": user["id"],
                "username": user["username"],
                "created_at": user["created_at"]
            }
            for user in users
        ]
    finally:
        cur.close()
        conn.close()