import os
import shutil
import json
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from database import (
    init_db, get_sessions_from_db, add_session_to_db, delete_session_from_db,
    add_history_to_db, get_history_from_db, add_file_to_db, update_session_name, get_session_name, get_files_from_db
)

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


from typing import List, Annotated
from fastapi import UploadFile, File, HTTPException
import os
import uuid


import docx
import uuid

# -------------------- ENV --------------------
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

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


def get_rag_relevant_context(session_id: str, file_path: str, topic: str, k: int = 6):
    vs = vectorstores.get(session_id) or load_vectorstore(session_id)
    if vs is None:
        return ""

    context_docs = []
    try:
        # If source filtering is supported, use it
        context_docs = vs.similarity_search(topic, k=k, filter={"source": file_path})
    except Exception:
        try:
            context_docs = vs.similarity_search(topic, k=k)
        except Exception:
            context_docs = []

    context_text = "\n\n".join([doc.page_content for doc in context_docs if getattr(doc, 'page_content', None)])
    return context_text[:12000]  # bound size for prompt safety


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

# -------------------- MODELS --------------------
class SessionCreate(BaseModel):
    session_id: str

class SessionUpdate(BaseModel):
    name: str

class SessionInfo(BaseModel):
    session_id: str
    name: str

class ChatQuery(BaseModel):
    query: str

class MessageHistory(BaseModel):
    role: str
    content: str
    timestamp: str

# -------------------- STARTUP --------------------
@app.on_event("startup")
def startup_event():
    if not get_sessions_from_db():
        add_session_to_db("default_session")

# -------------------- SESSION APIs --------------------
@app.get("/sessions", response_model=List[SessionInfo])
def get_sessions():
    sessions = []
    for session_id in get_sessions_from_db():
        name = get_session_name(session_id)
        sessions.append({"session_id": session_id, "name": name})
    return sessions

@app.post("/sessions")
def create_session(session: SessionCreate):
    session_id = session.session_id.strip()

    if not session_id:
        raise HTTPException(400, "Session name cannot be empty")

    if session_id in get_sessions_from_db():
        raise HTTPException(400, "Session already exists")

    add_session_to_db(session_id)
    get_session_history(session_id)

    return {"message": "Session created", "session_id": session_id}

@app.put("/sessions/{session_id}")
def update_session(session_id: str, session: SessionUpdate):
    if session_id not in get_sessions_from_db():
        raise HTTPException(404, "Session not found")
    
    new_name = session.name.strip()
    
    if not new_name:
        raise HTTPException(400, "Session name cannot be empty")
    
    update_session_name(session_id, new_name)
    return {"message": "Session updated", "session_id": session_id, "name": new_name}

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    if session_id not in get_sessions_from_db():
        raise HTTPException(404, "Session not found")

    store.pop(session_id, None)
    vectorstores.pop(session_id, None)

    delete_session_from_db(session_id)

    vector_dir = vectorstore_dir_for_session(session_id)
    if os.path.isdir(vector_dir):
        shutil.rmtree(vector_dir)

    return {"message": f"{session_id} deleted"}

# -------------------- UPLOAD API --------------------
@app.post("/sessions/{session_id}/upload")
async def upload_documents(
    session_id: str,
    files: Annotated[List[UploadFile], File(..., description="Upload PDF or DOCX files")]
):
    if session_id not in get_sessions_from_db():
        raise HTTPException(status_code=404, detail="Session not found")

    documents = []
    failed_files = []

    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)

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

            documents.extend(docs)
            add_file_to_db(session_id, uploaded_file.filename, file_path)

        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)

            failed_files.append({
                "filename": uploaded_file.filename,
                "error": str(e)
            })

    if not documents:
        raise HTTPException(status_code=400, detail={"errors": failed_files})

    # Split + Embed
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=5000,
        chunk_overlap=500
    )
    splits = splitter.split_documents(documents)

    vectorstore_dir = vectorstore_dir_for_session(session_id)
    os.makedirs(vectorstore_dir, exist_ok=True)

    vectorstore = Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        persist_directory=vectorstore_dir
    )

    save_vectorstore(session_id, vectorstore)

    return {
        "message": "Upload successful",
        "chunks": len(splits),
        "failed_files": failed_files
    }


def _make_teacher_topics(session_id: str, file_name: str, file_path: str):
    source_context = get_rag_relevant_context(session_id, file_path, f"Main topics for {file_name}", k=8)

    teacher_prompt = f"""You are a professor.

From the document content below (PDF file: {file_name}), extract 4-6 main topics in logical teaching order.
Keep topics concise and meaningful.
Return STRICT JSON array only, e.g. [\"Topic 1\", \"Topic 2\"] (no explanation, no markdown, no extras).

Context:
{source_context}
"""

    raw = run_professor_prompt(session_id, teacher_prompt)

    try:
        topics = json.loads(raw)
        if not isinstance(topics, list) or not all(isinstance(t, str) for t in topics):
            raise ValueError("Invalid topic response format")
    except Exception:
        raise HTTPException(500, f"Failed to parse topics for file {file_name}. raw: {raw[:800]}")

    if len(topics) < 1:
        raise HTTPException(500, f"No topics extracted for {file_name}")

    return topics


def _make_teaching_step(session_id: str):
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
    topics = current_pdf.get("topics", [])

    if idx_topic >= len(topics):
        return {"message": "Teaching completed"}

    topic = topics[idx_topic]
    file_path = current_pdf.get("file_path")
    context_fragment = get_rag_relevant_context(session_id, file_path, topic, k=6)

    teaching_prompt = f"""You are a professor teaching a student step-by-step.
Topic: {topic}

Instructions:
- Explain clearly and simply
- Focus only on this topic
- Highlight important points for exams
- Avoid unnecessary details

Use only the provided relevant context.

Context:
{context_fragment}

Output STRICT JSON ONLY, no markdown:
{{
  "canvas": {{
    "title": "{topic}",
    "content": "(2-4 lines explanation)",
    "important_points": ["..."]
  }},
  "voice": {{
    "script": "(more natural, slightly longer explanation)"
  }}
}}
"""

    raw = run_professor_prompt(session_id, teaching_prompt)

    try:
        structured = json.loads(raw)
        if not isinstance(structured, dict) or "canvas" not in structured or "voice" not in structured:
            raise ValueError("Invalid teaching step format")
    except Exception:
        raise HTTPException(500, f"Failed to parse teaching step for topic {topic}. raw: {raw[:1200]}")

    return {
        "step": idx_topic + 1,
        "pdf_index": idx_pdf,
        "topic_index": idx_topic,
        "topic": topic,
        "canvas": structured.get("canvas"),
        "voice": structured.get("voice")
    }


@app.post("/sessions/{session_id}/teach/start")
def start_teaching(session_id: str):
    if session_id not in get_sessions_from_db():
        raise HTTPException(404, "Session not found")

    files = get_files_from_db(session_id)
    if not files:
        raise HTTPException(400, "No PDFs uploaded for this session")

    teaching_state_pdfs = []

    for file in files:
        file_name = file["file_name"]
        file_path = file["local_path"]
        topics = _make_teacher_topics(session_id, file_name, file_path)
        teaching_state_pdfs.append({"file_name": file_name, "file_path": file_path, "topics": topics})

    teaching_sessions[session_id] = {
        "pdfs": teaching_state_pdfs,
        "current_pdf_index": 0,
        "current_topic_index": 0
    }

    return _make_teaching_step(session_id)


@app.post("/sessions/{session_id}/teach/next")
def next_teaching_step(session_id: str):
    if session_id not in get_sessions_from_db():
        raise HTTPException(404, "Session not found")

    if session_id not in teaching_sessions:
        raise HTTPException(400, "Teaching not started")

    state = teaching_sessions[session_id]
    state["current_topic_index"] += 1

    if state["current_pdf_index"] < len(state["pdfs"]):
        current_pdf = state["pdfs"][state["current_pdf_index"]]
        if state["current_topic_index"] >= len(current_pdf.get("topics", [])):
            state["current_pdf_index"] += 1
            state["current_topic_index"] = 0

    if state["current_pdf_index"] >= len(state["pdfs"]):
        return {"message": "Teaching completed"}

    teaching_sessions[session_id] = state
    return _make_teaching_step(session_id)


# -------------------- RAG --------------------
def get_rag_chain_for_session(session_id: str):
    if not api_key:
        raise Exception("Missing GROQ_API_KEY")

    llm = ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.3-70b-versatile"
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
def chat(session_id: str, query: ChatQuery):
    if session_id not in get_sessions_from_db():
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
def get_history(session_id: str):
    if session_id not in get_sessions_from_db():
        raise HTTPException(404, "Session not found")

    rows = get_history_from_db(session_id)

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
def get_documents(session_id: str):
    if session_id not in get_sessions_from_db():
        raise HTTPException(404, "Session not found")

    rows = get_files_from_db(session_id)

    documents = [
        {
            "file_name": r["file_name"],
            "local_path": r["local_path"],
            "uploaded_at": r["uploaded_at"]
        }
        for r in rows
    ]

    return {"documents": documents}