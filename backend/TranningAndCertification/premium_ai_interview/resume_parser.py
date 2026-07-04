"""
Resume PDF extraction and LLM-based structured parsing.
Supports pdfplumber (primary) with PyMuPDF as fallback.
"""
import io
import re
import json


def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or '' for page in pdf.pages]
        return '\n'.join(pages).strip()
    except ImportError:
        pass
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype='pdf')
        return '\n'.join(page.get_text() for page in doc).strip()
    except ImportError:
        pass
    raise RuntimeError(
        'No PDF library available. Install pdfplumber: pip install pdfplumber'
    )


def parse_resume_with_llm(text: str) -> dict:
    """
    Use the project LLM to convert raw resume text into structured JSON.
    Returns a dict with keys: name, skills, experience_years, projects, summary, role.
    """
    from .langgraph_interview import _llm, _parse_json

    # Truncate to ~4000 chars to stay within token limits
    truncated = text[:4000]

    prompt = f"""You are a professional resume parser. Extract structured information from the resume text below.

Resume Text:
\"\"\"
{truncated}
\"\"\"

Respond with ONLY valid JSON (no markdown fences):
{{
  "name": "<candidate full name, or empty string if not found>",
  "skills": ["<skill1>", "<skill2>", "<skill3>"],
  "experience_years": "<e.g. 3 years | fresher | 1-2 years>",
  "projects": ["<Project title: brief 1-line description>"],
  "summary": "<2-3 sentence professional summary>",
  "role": "<most suitable job title inferred from resume>"
}}

Rules:
- skills: extract ALL technical skills, languages, frameworks, tools (max 20)
- projects: up to 5 most significant, each as "Title: brief description"
- experience_years: total professional experience as a short string
- role: infer the best-fit job title (e.g. "Full Stack Developer", "Data Scientist")
- If a field cannot be determined, use an empty string or empty list"""

    raw = _llm(prompt)
    result = _parse_json(raw, {
        "name": "",
        "skills": [],
        "experience_years": "fresher",
        "projects": [],
        "summary": "",
        "role": "",
    })

    # Sanitise types
    if not isinstance(result.get('skills'), list):
        result['skills'] = []
    if not isinstance(result.get('projects'), list):
        result['projects'] = []
    result.setdefault('name', '')
    result.setdefault('experience_years', 'fresher')
    result.setdefault('summary', '')
    result.setdefault('role', '')

    return result
