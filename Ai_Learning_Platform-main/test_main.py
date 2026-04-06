import os
import json
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from fastapi.responses import StreamingResponse

print("Basic imports done")

from database import init_db
print("Database imported")

from langchain_huggingface import HuggingFaceEmbeddings
print("Embeddings imported")

# -------------------- ENV --------------------
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")

print("Env loaded")

# -------------------- TTS CLIENT --------------------
elevenlabs_client = None
if elevenlabs_api_key:
    elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_key)

print("TTS client initialized")

# -------------------- TTS FUNCTION --------------------
def text_to_speech_stream(text: str):
    """Convert text to speech and return audio stream"""
    if not elevenlabs_client:
        return None

    try:
        audio = elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id="ONwNWTeUTsywCR9UbUPk",  # Your voice ID
            model_id="eleven_v3",
            output_format="mp3_44100_128",
        )
        return audio
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

print("TTS function defined")

# -------------------- FASTAPI --------------------
app = FastAPI(title="Graspd API")

print("FastAPI app created")

@app.get("/")
def read_root():
    return {"message": "Graspd API is running"}

print("Route added")

if __name__ == "__main__":
    print("Script completed successfully")