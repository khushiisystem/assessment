"""
AI Utilities for Mock Interview Module
Includes transcription using Groq and human-like TTS using gTTS (Free)
"""

import os
import io
import logging
from groq import Groq
from gtts import gTTS

logger = logging.getLogger(__name__)

# Initialize clients
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not found")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

def transcribe_audio_with_groq(file_path):
    client = get_groq_client()
    try:
        with open(file_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(file_path), file.read()),
                model="whisper-large-v3-turbo",
            )
            return transcription.text
    except Exception as e:
        logger.error(f"Groq transcription failed: {e}")
        raise

def generate_interviewer_intro(candidate_name, role, resume_summary=None):
    client = get_groq_client()
    prompt = f"You are an AI interviewer named Zec. Introduce yourself to {candidate_name} for the {role} position. Keep it to 3-4 warm, professional sentences. End by saying you're ready to start."
    if resume_summary:
        prompt += f" Reference their background briefly: {resume_summary}"
    
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": "You are a professional AI interviewer. Be warm and concise."},
                      {"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Failed to generate intro: {e}")
        return f"Hello {candidate_name}, I'm Zec. I've reviewed your background for the {role} role and I'm excited to get started. Shall we begin?"

def generate_tts_audio(text):
    """
    Generate human-like speech from text using gTTS (Google Translate TTS).
    This is free and does not require an API key.
    """
    try:
        tts = gTTS(text=text, lang='en', tld='co.uk') # Using UK TLD for a slightly more professional sound
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        return fp.getvalue()
    except Exception as e:
        logger.error(f"gTTS failed: {e}")
        return None
