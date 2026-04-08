import os

# -------------------- TEACHING JSON OBJECT EXTRACTION --------------------
# -------------------- SAFE JSON EXTRACTION --------------------

def extract_json_object(text: str):
    import json

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1:
        return None

    json_str = text[start:end+1]

    try:
        return json.loads(json_str)
    except Exception:
        return None


def extract_json_array(text: str):
    import re, json

    match = re.search(r"\[.*?\]", text, re.DOTALL)
    if not match:
        return None

    try:
        return json.loads(match.group())
    except Exception:
        return None
# -------------------- DIRECT LLM (NO RAG) --------------------
# -------------------- DIRECT LLM --------------------

def run_llm_direct(prompt_text: str) -> str:
    if not api_key:
        raise Exception("Missing GROQ_API_KEY")

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0
    )

    response = llm.invoke(prompt_text)

    # Proper extraction
    try:
        return response.content.strip()
    except:
        return str(response).strip()

import shutil
import json
import uuid
import docx
from datetime import datetime

import uuid
from typing import List, Annotated, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from database import (
    init_db, get_sessions_from_db, get_sessions_with_created_at, add_session_to_db, delete_session_from_db,
    add_history_to_db, get_history_from_db, add_file_to_db, update_session_name, get_session_name, get_files_from_db,
    add_chunk_to_db, get_chunks_for_file, get_chunks_by_range, add_topic_to_db, get_topics_for_file,
    add_slide_to_db, get_slides_for_file
)


# Import auth router and user dependency
from auth import router as auth_router, get_current_user

from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_chroma import Chroma
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

# -------------------- ENV --------------------
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")

# -------------------- TTS CLIENT --------------------
elevenlabs_client = None
if elevenlabs_api_key:
    elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_key)

# -------------------- TTS FUNCTION --------------------
def text_to_speech_stream(text: str):
    """Convert text to speech and return audio stream"""
    if not elevenlabs_client:
        return None
    
    try:
        audio = elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id="FE4QURxZUK1rVrVK3PlK",  # Your voice ID
            model_id="eleven_v3",
            output_format="mp3_44100_128",
        )
        return audio
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

# -------------------- EMBEDDINGS --------------------
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# -------------------- PATHS --------------------
VECTORSTORE_ROOT = "chroma_sessions"
UPLOAD_DIR = "uploaded_files"

os.makedirs(VECTORSTORE_ROOT, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------- DB --------------------
db_conn = init_db()

# -------------------- MEMORY --------------------
store = {}
vectorstores = {}
teaching_sessions = {}

def get_session_history(session: str) -> BaseChatMessageHistory:
    if session not in store:
        store[session] = ChatMessageHistory()
    return store[session]

def vectorstore_dir_for_session(session_id: str) -> str:
    return os.path.join(VECTORSTORE_ROOT, session_id)

def load_vectorstore(session_id: str):
    directory = vectorstore_dir_for_session(session_id)
    if os.path.isdir(directory):
        try:
            # Try the old method first (for existing vectorstores)
            return Chroma(persist_directory=directory, embedding_function=embeddings)
        except Exception as e:
            print(f"Error loading vectorstore for {session_id}: {e}")
            return None
    return None

def save_vectorstore(session_id: str, vectorstore_obj):
    if hasattr(vectorstore_obj, "persist"):
        vectorstore_obj.persist()
    vectorstores[session_id] = vectorstore_obj




def run_professor_prompt(session_id: str, prompt_text: str):
    chain = get_rag_chain_for_session(session_id)
    if chain is None:
        raise HTTPException(400, "Upload documents first")

    response = chain.invoke(
        {"input": prompt_text},
        config={"configurable": {"session_id": session_id}}
    )

    return response.get("answer", "").strip()


# -------------------- DOCX LOADER --------------------
def load_docx_file(file_path):
    doc = docx.Document(file_path)
    full_text = []

    for paragraph in doc.paragraphs:
        full_text.append(paragraph.text)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                full_text.append(cell.text)

    content = "\n".join(full_text)
    return [Document(page_content=content, metadata={"source": file_path})]

# -------------------- FASTAPI --------------------

app = FastAPI(title="Graspd API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register auth router
app.include_router(auth_router)

# -------------------- MODELS --------------------
class SessionCreate(BaseModel):
    name: str

class SessionUpdate(BaseModel):
    name: str

class ChatQuery(BaseModel):
    query: str

class TTSRequest(BaseModel):
    text: str

class MessageHistory(BaseModel):
    role: str
    content: str
    timestamp: str

class SessionInfo(BaseModel):
    session_id: str
    name: str
    created_at: Optional[str]


# -------------------- STARTUP --------------------
# (Removed default session creation; sessions are now user-specific)


# -------------------- SESSION APIs --------------------
@app.get("/sessions", response_model=List[SessionInfo])
def get_sessions(current_user: dict = Depends(get_current_user)):
    sessions = []
    for row in get_sessions_with_created_at(user_id=current_user["id"]):
        session_id = row["session_id"]
        created_at = row["created_at"]
        name = get_session_name(session_id, current_user["id"])
        sessions.append({
            "session_id": session_id,
            "name": name,
            "created_at": created_at,
        })
    return sessions


@app.post("/sessions")
def create_session(session: SessionCreate, current_user: dict = Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    name = session.name.strip()

    if not name:
        raise HTTPException(400, "Session name cannot be empty")

    # No need to check for duplicate session_id, always unique
    created_at = datetime.utcnow().isoformat()
    add_session_to_db(session_id, current_user["id"], name, created_at)
    get_session_history(session_id)

    return {
        "message": "Session created",
        "session_id": session_id,
        "name": name,
        "created_at": created_at,
    }

@app.put("/sessions/{session_id}")
def update_session(session_id: str, session: SessionUpdate, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")
    
    new_name = session.name.strip()
    
    if not new_name:
        raise HTTPException(400, "Session name cannot be empty")
    
    update_session_name(session_id, new_name, current_user["id"])
    return {"message": "Session updated", "session_id": session_id, "name": new_name}

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")

    store.pop(session_id, None)
    vectorstores.pop(session_id, None)

    delete_session_from_db(session_id, user_id=current_user["id"])

    vector_dir = vectorstore_dir_for_session(session_id)
    if os.path.isdir(vector_dir):
        shutil.rmtree(vector_dir)

    return {"message": f"{session_id} deleted"}

# -------------------- UPLOAD API --------------------


@app.post("/sessions/{session_id}/upload")
async def upload_documents(
    session_id: str,
    files: Annotated[List[UploadFile], File(..., description="Upload PDF or DOCX files")],
    current_user: dict = Depends(get_current_user)
):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(status_code=404, detail="Session not found")

    failed_files = []
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)

    all_splits = []  # For Chroma (chat only)
    slide_db_count = 0

    for uploaded_file in files:
        file_ext = uploaded_file.filename.split('.')[-1].lower()

        # ✅ Restrict file types
        if uploaded_file.content_type not in [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]:
            failed_files.append({
                "filename": uploaded_file.filename,
                "error": "Invalid file type"
            })
            continue

        safe_filename = f"{uuid.uuid4().hex}_{uploaded_file.filename}"
        file_path = os.path.join(session_upload_dir, safe_filename)

        # Save file
        with open(file_path, "wb") as f:
            f.write(await uploaded_file.read())

        try:
            if file_ext == "pdf":
                loader = PyPDFLoader(file_path)
                docs = loader.load()
            elif file_ext == "docx":
                docs = load_docx_file(file_path)
            else:
                raise Exception("Unsupported format")

            add_file_to_db(session_id, uploaded_file.filename, file_path, user_id=current_user["id"])

            # --- SLIDE/PAGE extraction for teaching (with title/body split) ---
            slides = []  # Each is a dict: {"title": ..., "content": ...}
            if file_ext == "pdf":
                for idx, doc in enumerate(docs):
                    content = doc.page_content.strip()
                    lines = [l.strip() for l in content.split("\n") if l.strip()]
                    title = lines[0] if lines else "Untitled"
                    body = "\n".join(lines[1:]) if len(lines) > 1 else ""
                    # If both title and body are empty, treat as image-only
                    if not title and not body:
                        title = "[IMAGE ONLY PAGE]"
                        body = ""
                    add_slide_to_db(session_id, file_path, idx, body, title, user_id=current_user["id"])
                    slides.append({"title": title, "content": body})
                    slide_db_count += 1
            elif file_ext == "docx":
                content = docs[0].page_content.strip() if docs else ""
                lines = [l.strip() for l in content.split("\n") if l.strip()]
                title = lines[0] if lines else "Untitled"
                body = "\n".join(lines[1:]) if len(lines) > 1 else ""
                if not title and not body:
                    title = "[IMAGE ONLY PAGE]"
                    body = ""
                add_slide_to_db(session_id, file_path, 0, body, title, user_id=current_user["id"])
                slides.append({"title": title, "content": body})
                slide_db_count += 1

            # --- Topic generation: use only slide titles ---
            slide_titles = [s["title"] for s in slides if s["title"] and s["title"] != "[IMAGE ONLY PAGE]"]
            topic_text = "\n".join(slide_titles[:15])
            topic_prompt = f"""
These are slide titles from a presentation:

{topic_text}

Generate 4-6 main topics in logical teaching order.

Return ONLY a valid JSON array of strings.
Do NOT add explanation.
Do NOT add markdown.
Do NOT add text before or after.

Example:
[\"Topic 1\", \"Topic 2\"]
"""

            # Use direct LLM call for topic extraction (NO RAG)
            raw_topics = run_llm_direct(topic_prompt)
            print("RAW TOPICS RESPONSE:", raw_topics)
            topics = extract_json_array(raw_topics)
            print("PARSED TOPICS:", topics)
            # Validate topics
            if not isinstance(topics, list) or len(topics) < 1 or not all(isinstance(t, str) for t in topics):
                failed_files.append({
                    "filename": uploaded_file.filename,
                    "error": "Topic extraction failed"
                })
                raise HTTPException(500, "Topic extraction failed")

            # Map topics to slide ranges (even split)
            total_slides = len(slides)
            num_topics = len(topics)
            base = total_slides // num_topics
            rem = total_slides % num_topics
            slide_ranges = []
            start = 0
            for i in range(num_topics):
                end = start + base + (1 if i < rem else 0)
                slide_ranges.append((start, end-1))
                start = end

            # Store topics and mapping in DB
            for i, topic in enumerate(topics):
                rng = slide_ranges[i]
                add_topic_to_db(session_id, file_path, i, topic, rng[0], rng[1], user_id=current_user["id"])

            # --- Chroma chunking for chat endpoint only ---
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=2000,
                chunk_overlap=200
            )
            splits = splitter.split_documents(docs)
            all_splits.extend(splits)

        except Exception as e:
            failed_files.append({
                "filename": uploaded_file.filename,
                "error": str(e)
            })

    if not all_splits:
        raise HTTPException(status_code=400, detail={"errors": failed_files})

    # Chroma vectorstore for chat endpoint only
    vectorstore_dir = vectorstore_dir_for_session(session_id)
    os.makedirs(vectorstore_dir, exist_ok=True)
    vectorstore = Chroma.from_documents(
        documents=all_splits,
        embedding=embeddings,
        persist_directory=vectorstore_dir
    )
    save_vectorstore(session_id, vectorstore)

    return {
        "message": "Upload successful",
        "slides": slide_db_count,
        "failed_files": failed_files
    }



# --- New teaching step logic: sequential chunk fetching, no similarity_search ---
def _make_teaching_step(session_id: str, user_id: int):
    if session_id not in teaching_sessions:
        raise HTTPException(400, "Teaching session not started")

    state = teaching_sessions[session_id]
    pdfs = state.get("pdfs", [])

    if not pdfs:
        raise HTTPException(400, "No PDFs in teaching state")

    idx_pdf = state["current_pdf_index"]
    idx_topic = state["current_topic_index"]

    if idx_pdf >= len(pdfs):
        return {"message": "Teaching completed"}

    current_pdf = pdfs[idx_pdf]
    file_path = current_pdf.get("file_path")

    # --- Get topics ---
    topics_db = get_topics_for_file(session_id, file_path, user_id)
    print("TOPICS DB:", topics_db)

    if not topics_db:
        raise HTTPException(400, "No topics found. Upload may have failed.")

    if idx_topic >= len(topics_db):
        return {"message": "Teaching completed"}


    topic_row = topics_db[idx_topic]
    topic = topic_row[1]
    start_slide = topic_row[2]
    end_slide = topic_row[3]

    # --- Get slides ---
    slides = get_slides_for_file(session_id, file_path, user_id)
    if not slides or start_slide > end_slide or start_slide < 0 or end_slide >= len(slides):
        raise HTTPException(500, "Invalid slide range for topic")
    selected_slides = slides[start_slide:end_slide+1]
    # If all slides are image-only or empty, fallback to visual slide response
    if all((not s["content"] or s["content"] == "[IMAGE ONLY PAGE]") for s in selected_slides):
        # Use the first slide's title if available
        slide_title = selected_slides[0]["title"] if selected_slides and selected_slides[0]["title"] else "[IMAGE ONLY PAGE]"
        return {
            "step": idx_topic + 1,
            "pdf_index": idx_pdf,
            "topic_index": idx_topic,
            "topic": topic,
            "canvas": {
                "title": slide_title,
                "content": "This slide represents a visual diagram or UI flow.",
                "important_points": []
            },
            "voice": {
                "script": "This slide shows a visual representation. Please observe it carefully."
            }
        }
    # Otherwise, build context with titles and content
    context_fragment = "\n\n".join([
        f"Title: {s['title']}\nContent:\n{s['content']}" for s in selected_slides
    ])
    context_fragment = context_fragment[:3500]

    # --- Prompt ---
    teaching_prompt = f"""
You are a professor teaching a student step-by-step.

Topic: {topic}

Instructions:
- Explain clearly and simply
- Focus only on this topic
- Highlight important points for exams
- Avoid unnecessary details

You MUST return ONLY valid JSON.
Do NOT use markdown.
Do NOT add headings.
Do NOT add any text before or after JSON.

STRICT OUTPUT FORMAT:

{{
  "canvas": {{
    "title": "{topic}",
    "content": "2-4 line explanation",
    "important_points": ["point1", "point2"]
  }},
  "voice": {{
    "script": "slightly longer natural explanation"
  }}
}}

Context:
{context_fragment}
"""

    # --- LLM Call ---
    raw = run_llm_direct(teaching_prompt)
    print("RAW TEACHING RESPONSE:", raw)

    structured = extract_json_object(raw)
    print("PARSED STRUCTURED:", structured)

    # =========================
    # 🔥 FALLBACK LOGIC (KEY)
    # =========================

    if not structured:
        structured = {
            "canvas": {
                "title": topic,
                "content": raw[:200],
                "important_points": []
            },
            "voice": {
                "script": raw[:500]
            }
        }

    elif "canvas" not in structured or "voice" not in structured:

        # Case: only canvas returned
        if isinstance(structured, dict) and "title" in structured:
            structured = {
                "canvas": structured,
                "voice": {
                    "script": structured.get("content", "")
                }
            }

        # fallback
        else:
            structured = {
                "canvas": {
                    "title": topic,
                    "content": raw[:200],
                    "important_points": []
                },
                "voice": {
                    "script": raw[:500]
                }
            }

    # Final safety
    if "canvas" not in structured or "voice" not in structured:
        raise HTTPException(500, "Failed to build valid teaching response")

    return {
        "step": idx_topic + 1,
        "pdf_index": idx_pdf,
        "topic_index": idx_topic,
        "topic": topic,
        "canvas": structured["canvas"],
        "voice": structured["voice"]
    }



# --- New teaching start: fetch topics from DB, no similarity_search ---
@app.post("/sessions/{session_id}/teach/start")
def start_teaching(session_id: str, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")

    files = get_files_from_db(session_id, user_id=current_user["id"])
    if not files:
        raise HTTPException(400, "No PDFs uploaded for this session")

    teaching_state_pdfs = []
    for file in files:
        file_name = file["file_name"]
        file_path = file["local_path"]
        # topics will be fetched from DB in _make_teaching_step
        teaching_state_pdfs.append({"file_name": file_name, "file_path": file_path})

    teaching_sessions[session_id] = {
        "pdfs": teaching_state_pdfs,
        "current_pdf_index": 0,
        "current_topic_index": 0
    }
    return _make_teaching_step(session_id, current_user["id"])



# --- New teaching next: use DB topic count, no similarity_search ---
@app.post("/sessions/{session_id}/teach/next")
def next_teaching_step(session_id: str, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")
    if session_id not in teaching_sessions:
        raise HTTPException(400, "Teaching not started")

    state = teaching_sessions[session_id]
    state["current_topic_index"] += 1

    # Get current PDF and topics from DB
    if state["current_pdf_index"] < len(state["pdfs"]):
        current_pdf = state["pdfs"][state["current_pdf_index"]]
        file_path = current_pdf["file_path"]
        topics_db = get_topics_for_file(session_id, file_path, current_user["id"])
        if state["current_topic_index"] >= len(topics_db):
            state["current_pdf_index"] += 1
            state["current_topic_index"] = 0

    if state["current_pdf_index"] >= len(state["pdfs"]):
        return {"message": "Teaching completed"}

    teaching_sessions[session_id] = state
    return _make_teaching_step(session_id, current_user["id"])


# -------------------- TTS API --------------------
@app.post("/tts")
async def generate_tts(tts_request: TTSRequest):
    """Convert text to speech using ElevenLabs"""
    if not elevenlabs_client:
        raise HTTPException(500, "TTS service not configured")
    
    text = tts_request.text.strip()
    if not text:
        raise HTTPException(400, "Text cannot be empty")
    
    audio_stream = text_to_speech_stream(text)
    if audio_stream is None:
        raise HTTPException(500, "Failed to generate audio")
    
    return StreamingResponse(audio_stream, media_type="audio/mpeg")


# -------------------- RAG --------------------
def get_rag_chain_for_session(session_id: str):
    if not api_key:
        raise Exception("Missing GROQ_API_KEY")

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.1-8b-instant"
    )

    vs = vectorstores.get(session_id) or load_vectorstore(session_id)

    if vs is None:
        return None

    vectorstores[session_id] = vs
    retriever = vs.as_retriever()

    contextualize_prompt = ChatPromptTemplate.from_messages([
        ("system", "Rephrase question with history"),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}")
    ])

    history_aware_retriever = create_history_aware_retriever(
        llm, retriever, contextualize_prompt
    )

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", "Answer using context. Max 3 sentences.\n{context}"),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}")
    ])

    qa_chain = create_stuff_documents_chain(llm, qa_prompt)

    rag_chain = create_retrieval_chain(
        history_aware_retriever, qa_chain
    )

    return RunnableWithMessageHistory(
        rag_chain,
        get_session_history,
        input_messages_key="input",
        history_messages_key="chat_history",
        output_messages_key="answer"
    )

# -------------------- CHAT --------------------
@app.post("/sessions/{session_id}/chat")
def chat(session_id: str, query: ChatQuery, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")

    chain = get_rag_chain_for_session(session_id)

    if chain is None:
        raise HTTPException(400, "Upload documents first")

    user_input = query.query.strip()
    if not user_input:
        raise HTTPException(400, "Empty query")

    add_history_to_db(session_id, "user", user_input)

    response = chain.invoke(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}}
    )

    answer = response.get("answer", "")

    add_history_to_db(session_id, "assistant", answer)

    return {"user": user_input, "assistant": answer}

# -------------------- HISTORY --------------------
@app.get("/sessions/{session_id}/history", response_model=List[MessageHistory])
def get_history(session_id: str, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")

    rows = get_history_from_db(session_id, user_id=current_user["id"])

    return [
        {
            "role": r["role"],
            "content": r["content"],
            "timestamp": r["timestamp"]
        }
        for r in rows
    ]

# -------------------- DOCUMENTS --------------------
@app.get("/sessions/{session_id}/documents")
def get_documents(session_id: str, current_user: dict = Depends(get_current_user)):
    if session_id not in get_sessions_from_db(user_id=current_user["id"]):
        raise HTTPException(404, "Session not found")

    rows = get_files_from_db(session_id, user_id=current_user["id"])

    documents = [
        {
            "file_name": r["file_name"],
            "local_path": r["local_path"],
            "uploaded_at": r["uploaded_at"]
        }
        for r in rows
    ]

    return {"documents": documents}