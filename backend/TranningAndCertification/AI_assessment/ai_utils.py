import os
from google import genai
from google.genai.types import HttpOptions
from django.conf import settings
import json
import re
from typing import List, Dict, Optional
import tempfile
import subprocess
from pathlib import Path
#from faster_whisper import WhisperModel
import tiktoken
import logging

logger = logging.getLogger(__name__)


def _preview_text(value: str, limit: int = 500) -> str:
    """Return a compact log preview without leaking large prompt/response bodies."""
    value = (value or "").replace("\n", " ").strip()
    return value[:limit]


def parse_gemini_questions_response(response_text: str) -> List[str]:
    """
    Parse Gemini question output defensively.

    Gemini can return numbered lists, markdown numbered lists, bullets, or a JSON
    list. Keep this parser local and deterministic so malformed formatting does
    not look like an LLM generation failure.
    """
    if not response_text:
        return []

    cleaned = response_text.strip()
    fenced = re.sub(r'^```(?:json)?\s*|\s*```$', '', cleaned, flags=re.IGNORECASE).strip()

    try:
        parsed = json.loads(fenced)
        if isinstance(parsed, list):
            return [
                str(item).strip(' "\'`*,')
                for item in parsed
                if len(str(item).strip()) > 10
            ]
        if isinstance(parsed, dict):
            for key in ("questions", "data", "items"):
                items = parsed.get(key)
                if isinstance(items, list):
                    return [
                        str(item).strip(' "\'`*,')
                        for item in items
                        if len(str(item).strip()) > 10
                    ]
    except Exception:
        pass

    questions = []
    for raw_line in cleaned.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        line = re.sub(r'^\s*[-*]\s+', '', line)
        line = re.sub(r'^\s*\*\*(\d+[\.)])\*\*\s*', r'\1 ', line)
        match = re.match(r'^\s*(?:question\s*)?(\d+)[\.)\-:]\s*(.+)', line, re.IGNORECASE)
        if match:
            question_text = match.group(2).strip(' "\'`*,')
            min_length = 10
        else:
            question_text = line.strip(' "\'`*,')
            min_length = 20

        looks_like_question = (
            "?" in question_text
            or question_text.endswith(".")
            or any(word in question_text.lower() for word in ("how", "what", "why", "describe", "explain", "when"))
        )
        if len(question_text) > min_length and looks_like_question:
            questions.append(question_text)

    return questions

def derive_role_from_tech_stack(skills) -> str:
    """Map a list of skill strings to ONE valid AIAssessment role_type.

    Uses case-insensitive substring matching against a keyword map. When both
    frontend and backend signals are present the role is fullstack_developer.
    Defaults to fullstack_developer when nothing matches.
    """
    if not skills:
        return "fullstack_developer"

    blob = " ".join(str(s) for s in skills).lower()

    def has(*keywords) -> bool:
        return any(k in blob for k in keywords)

    frontend = has("react", "angular", "vue", "html", "css", "tailwind",
                   "next.js", "nextjs", "svelte")
    backend = has("node", "express", "nest", "django", "flask", "fastapi",
                  "spring", "rails", ".net", "laravel")

    # Specialized roles first — most specific wins.
    if has("salesforce") and has("admin"):
        return "salesforce_admin"
    if has("salesforce"):
        return "salesforce_developer"
    if has("tableau"):
        return "tableau_developer"
    if has("power bi", "powerbi", "power-bi"):
        return "power_bi_developer"
    if has("tensorflow", "pytorch", "scikit", "scikit-learn", "sklearn",
           "machine learning", " ml", "ml ", "deep learning"):
        return "data_scientist"
    if has("pandas", "numpy"):
        return "data_scientist"
    if has("docker", "kubernetes", "k8s", "aws", "ci/cd", "ci ", " ci",
           "terraform", "ansible", "jenkins"):
        return "devops_engineer"

    # MERN: mongo + react/express signals.
    if has("mongo") and (has("react") or has("express")):
        return "mern_stack_developer"

    if has("ux", "figma", "wireframe", "user research"):
        return "ux_designer"

    if frontend and backend:
        return "fullstack_developer"

    if has("django", "flask", "fastapi", "python"):
        return "python_developer"
    if has("spring", "java"):
        return "java_developer"
    if frontend:
        return "frontend_developer"
    if backend:
        return "backend_developer"

    if has("sql", "tableau", "power bi"):
        return "data_analyst"

    return "fullstack_developer"


# ============ TOKEN COUNTING UTILITIES ============

class TokenCounter:
    """Utility class for counting tokens using tiktoken"""
    
    def __init__(self, model_name: str = "gpt-3.5-turbo"):
        """Initialize token counter for a specific model"""
        try:
            self.encoding = tiktoken.encoding_for_model(model_name)
        except KeyError:
            # Fallback to cl100k_base encoding (used by gpt-3.5-turbo and gpt-4)
            self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in a text string"""
        if not text:
            return 0
        return len(self.encoding.encode(text))
    
    def count_tokens_in_messages(self, messages: List[Dict[str, str]]) -> int:
        """Count tokens in a list of messages (for chat completions)"""
        total_tokens = 0
        for message in messages:
            total_tokens += 4  # Every message has overhead
            for key, value in message.items():
                total_tokens += self.count_tokens(str(value))
        total_tokens += 2  # Extra tokens for message formatting
        return total_tokens

def get_token_counter() -> TokenCounter:
    """Factory for token counter"""
    return TokenCounter()

def estimate_assessment_tokens(hardcoded_questions: List[str], 
                               candidate_answers: List[str],
                               resume_text: str,
                               role_type: str,
                               experience_level: str) -> Dict[str, int]:
    """
    Estimate total tokens for an assessment including:
    - Question generation (if needed)
    - Feedback generation
    
    Returns dict with token breakdown
    """
    counter = get_token_counter()
    
    token_breakdown = {
        'hardcoded_questions': 0,
        'candidate_answers': 0,
        'resume': counter.count_tokens(resume_text),
        'feedback_prompt_base': 0,
        'estimated_feedback_response': 0,
        'total_estimated': 0
    }
    
    # Count hardcoded questions tokens
    for q in hardcoded_questions:
        token_breakdown['hardcoded_questions'] += counter.count_tokens(q)
    
    # Count candidate answers tokens
    for a in candidate_answers:
        token_breakdown['candidate_answers'] += counter.count_tokens(a)
    
    # Estimate feedback prompt base (system message + context)
    feedback_base = f"""You are a technical interviewer evaluating a {role_type} candidate with {experience_level} experience."""
    token_breakdown['feedback_prompt_base'] = counter.count_tokens(feedback_base)
    
    # Estimate feedback response (roughly 2-3x the input tokens)
    input_tokens = (token_breakdown['hardcoded_questions'] + 
                   token_breakdown['candidate_answers'] + 
                   token_breakdown['resume'])
    token_breakdown['estimated_feedback_response'] = int(input_tokens * 2.5)
    
    # Calculate total
    token_breakdown['total_estimated'] = (
        token_breakdown['hardcoded_questions'] +
        token_breakdown['candidate_answers'] +
        token_breakdown['resume'] +
        token_breakdown['feedback_prompt_base'] +
        token_breakdown['estimated_feedback_response']
    )
    
    return token_breakdown

# ============ DUPLICATE PREVENTION UTILITIES ============

def get_question_embeddings_hash(questions: List[str]) -> Dict[str, str]:
    """
    Create a hash/fingerprint of questions for duplicate detection.
    Uses semantic similarity without sending full questions to AI.
    """
    import hashlib
    
    question_hashes = {}
    for i, q in enumerate(questions):
        # Create a simple hash of the question
        # This helps identify exact or near-duplicate questions
        q_normalized = q.lower().strip()
        q_hash = hashlib.md5(q_normalized.encode()).hexdigest()
        question_hashes[f"q_{i}"] = q_hash
    
    return question_hashes

def filter_duplicate_questions(llm_questions: List[str], 
                               hardcoded_questions: List[str],
                               similarity_threshold: float = 0.7) -> List[str]:
    """
    Filter out LLM-generated questions that are too similar to hardcoded questions.
    Uses simple keyword matching to avoid sending all questions to AI.
    
    Args:
        llm_questions: List of LLM-generated questions
        hardcoded_questions: List of hardcoded questions
        similarity_threshold: Threshold for considering questions similar (0-1)
    
    Returns:
        Filtered list of unique LLM questions
    """
    from difflib import SequenceMatcher
    
    filtered_questions = []
    
    for llm_q in llm_questions:
        is_duplicate = False
        logger.info("[AI QUESTIONS] Checking for duplicates: llm_question=%s", _preview_text(llm_q))
        for hardcoded_q in hardcoded_questions:
            # Calculate similarity ratio
            similarity = SequenceMatcher(None, 
                                        llm_q.lower(), 
                                        hardcoded_q.lower()).ratio()
            
            if similarity >= similarity_threshold:
                logger.info(
                    "[AI QUESTIONS] Filtered duplicate question: similarity=%.2f llm_question_preview=%s hardcoded_question_preview=%s",
                    similarity,
                    _preview_text(llm_q),
                    _preview_text(hardcoded_q)
                )
                is_duplicate = True
                break
        
        if not is_duplicate:
            filtered_questions.append(llm_q)
    
    logger.info("[AI QUESTIONS] Duplicate filtering complete: original=%s filtered=%s duplicates_removed=%s",         len(llm_questions), len(filtered_questions), len(llm_questions) - len(filtered_questions)    )
    
    return filtered_questions

class GeminiAIClient:
    """
    Vertex AI (Gemini) client for generating interview questions and feedback, using Google service account
    """
    def __init__(self):
        self.configured = False
        self.client = None
        self.configure()

    def configure(self):
        try:
            # Get project/location either from env or settings
            project = getattr(settings, 'GOOGLE_CLOUD_PROJECT', None) or os.environ.get('GOOGLE_CLOUD_PROJECT')
            location = getattr(settings, 'GOOGLE_CLOUD_LOCATION', None) or os.environ.get('GOOGLE_CLOUD_LOCATION', 'us-central1')
            
            # Check if credentials are available. Do not log paths or secrets.
            credentials_file = (
                os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
                or getattr(settings, 'GOOGLE_APPLICATION_CREDENTIALS', None)
            )
            credentials_json = (
                os.environ.get('GOOGLE_CREDENTIALS_JSON')
                or getattr(settings, 'GOOGLE_CREDENTIALS_JSON', None)
            )
            credential_source = "file" if credentials_file else "none"

            if (not credentials_file or not os.path.exists(credentials_file)) and credentials_json:
                credentials_temp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
                credentials_temp.write(credentials_json)
                credentials_temp.close()
                credentials_file = credentials_temp.name
                credential_source = "GOOGLE_CREDENTIALS_JSON"
                logger.info("[AI QUESTIONS] Vertex AI credentials loaded from GOOGLE_CREDENTIALS_JSON")

            has_credentials = credentials_file and os.path.exists(credentials_file)

            logger.info(
                "[AI QUESTIONS] Vertex credential check: project_present=%s location=%s credentials_present=%s credential_source=%s",
                bool(project),
                location,
                bool(has_credentials),
                credential_source,
            )
            
            if project and has_credentials:
                # Configure for Vertex AI with proper credentials
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_file
                os.environ['GOOGLE_GENAI_USE_VERTEXAI'] = 'true'
                os.environ['GOOGLE_CLOUD_PROJECT'] = project
                os.environ['GOOGLE_CLOUD_LOCATION'] = location
                
                # Create client with Vertex AI settings
                self.client = genai.Client(
                    vertexai=True,
                    project=project,
                    location=location,
                    http_options=HttpOptions(api_version='v1'),
                )
                self.configured = True
                logger.info("[AI QUESTIONS] Vertex AI configured: project=%s location=%s", project, location)
                logger.info(
                    "[AI QUESTIONS] Vertex AI configured successfully: project=%s location=%s model=%s",
                    project,
                    location,
                    "gemini-2.5-flash",
                )
                return True
            else:
                missing = []
                if not project:
                    missing.append("GOOGLE_CLOUD_PROJECT")
                if not has_credentials:
                    missing.append("GOOGLE_APPLICATION_CREDENTIALS")
                logger.warning("[AI QUESTIONS] Vertex AI not fully configured. Missing: %s", ", ".join(missing))
                logger.warning("[AI QUESTIONS] Vertex AI not configured: missing=%s", ",".join(missing))
                return False
        except Exception as e:
            logger.exception("[AI QUESTIONS] Error configuring Vertex AI Gemini")
            return False

    def test_connection(self) -> bool:
        if not self.configured:
            logger.warning("[AI QUESTIONS] Gemini connection test skipped because client is not configured")
            return False
        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents='Test connection',
                config={'temperature': 0},
            )
            ok = bool(getattr(response, 'text', None))
            logger.info("[AI QUESTIONS] Gemini connection test result=%s", ok)
            return ok
        except Exception as e:
            logger.exception("[AI QUESTIONS] Gemini connection test failed")
            return False
    
    def generate_questions(self, resume_text: str, role_type: str = "Software Engineer",
                          num_questions: int = 5, experience_level: str = "2-5 years",
                          tech_stack: str = "",
                          job_description: str = "") -> List[str]:
        """Generate interview questions from the job description, tech stack, role
        and (when available) the candidate's resume, using the Gemini API."""
        if not self.configured:
            logger.warning(
                "[AI QUESTIONS] Question generation skipped because Gemini client is not configured: role=%s experience=%s requested=%s",
                role_type,
                experience_level,
                num_questions,
            )
            return []

        resume_text = (resume_text or "").strip()
        tech_stack = (tech_stack or "").strip()
        job_description = (job_description or "").strip()
        # The Job Description is the PRIMARY source of context and takes
        # precedence over the tech stack and the candidate resume. Tech stack
        # and experience level are required supporting constraints; the resume,
        # when present, only refines (it never overrides the JD).
        jd_block = (
            "PRIMARY CONTEXT — Job Description (this is the main source of truth; "
            "the questions must be grounded in it first):\n"
            f"{job_description}\n"
            if job_description else ""
        )
        stack_phrase = (
            f"the role's required tech stack is: {tech_stack}"
            if tech_stack else "no specific tech stack was provided"
        )
        resume_block = (
            f"\nSupporting context — the candidate's resume (use only to refine, "
            f"never to override the job description):\n{resume_text}\n"
            if resume_text else ""
        )
        # What the questions must be relevant to: JD first, then tech stack, then resume/role.
        relevance = job_description or tech_stack or resume_text or role_type

        # Determine difficulty based on experience level
        is_fresher = experience_level.lower() in ['fresher', '0-2_years', '0-2 years']
        
        if is_fresher:
            difficulty_instruction = """
IMPORTANT: Keep questions SIMPLE and FUNDAMENTAL for fresher/entry-level candidates:
- Focus on basic concepts and definitions
- Ask about fundamental knowledge, not complex implementations
- NO coding questions - only conceptual/theoretical questions
- Questions should test understanding, not problem-solving ability
- Use simple, clear language
- Examples: "What is...", "Explain the difference between...", "Why do we use..."
"""
        else:
            difficulty_instruction = """
Questions should be appropriate for experienced professionals:
- Mix of conceptual and practical questions
- Focus on real-world scenarios and best practices
- Test both knowledge and problem-solving ability
"""
            
        # Add randomness to ensure different questions each time
        import random
        import time
        random_seed = int(time.time() * 1000) % 1000  # Use timestamp-based seed for variation
        random.seed(random_seed)
        
        # Add variation instructions to prompt for diversity
        variation_instructions = [
            "Focus on different aspects and perspectives",
            "Explore various use cases and scenarios",
            "Cover different topics within the domain",
            "Ask questions from different angles",
            "Vary the depth and complexity",
        ]
        selected_variation = random.choice(variation_instructions)
        
        prompt = f"""You are conducting a technical interview for a {role_type} position.

{jd_block}
The candidate has {experience_level} experience and {stack_phrase}.
{resume_block}
Generation rules (in priority order):
1. The Job Description above is the PRIMARY context — base the questions on it first.
2. Then ensure the questions exercise the required tech stack: {tech_stack or relevance}.
3. Then calibrate every question to a {experience_level} experience level.

{difficulty_instruction}

IMPORTANT: Generate FRESH and UNIQUE questions. {selected_variation}. Avoid repeating common or generic questions.

Generate exactly {num_questions} interview questions. Each question should be:
- Complete and self-contained
- Relevant to: {relevance}
- Appropriate for {experience_level} experience level
- Clear and easy to understand
- Focus on TECHNICAL KNOWLEDGE, not coding ability
- Focus on key concepts and important points
- UNIQUE and DIFFERENT from standard interview questions

Format each question as:
1. Complete question text here?
2. Complete question text here?
3. Complete question text here?

Question types to include (vary the mix):
- Fundamental concepts and definitions (50%)
- Practical knowledge and use cases (30%)
- Best practices and when to use what (20%)
- IMPORTANT: Keep questions SHORT but MEANINGFUL. Each question should be 15-30 words maximum while covering essential technical points.

Generate {num_questions} FRESH and UNIQUE questions now:"""

        try:
            logger.info(
                "[AI QUESTIONS] Sending question generation prompt: role=%s experience=%s requested=%s resume_chars=%s",
                role_type,
                experience_level,
                num_questions,
                len(resume_text or ""),
            )
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config={
                    'temperature': 0.7,
                    # 'max_output_tokens': 1024,
                    'top_p': 0.95,
                    'top_k': 40,
                },
            )
            
            if getattr(response, 'text', None):
                questions_text = response.text
                questions = parse_gemini_questions_response(questions_text)
                
                logger.info("[AI QUESTIONS] Parsed %s questions from AI response", len(questions))
                logger.info(
                    "[AI QUESTIONS] Gemini response parsed: requested=%s parsed=%s response_chars=%s first_question_preview=%s",
                    num_questions,
                    len(questions),
                    len(questions_text),
                    _preview_text(questions[0], 120) if questions else "",
                )
                
                if len(questions) >= num_questions:
                    return questions[:num_questions]
                elif len(questions) > 0:
                    logger.warning(
                        "[AI QUESTIONS] Generated only %s questions, expected %s",
                        len(questions),
                        num_questions,
                    )
                    logger.warning(
                        "[AI QUESTIONS] Gemini under-generated questions: requested=%s parsed=%s",
                        num_questions,
                        len(questions),
                    )
                    return questions
                else:
                    logger.warning("[AI QUESTIONS] No valid questions parsed from AI response")
                    logger.warning(
                        "[AI QUESTIONS] Gemini returned no parsable questions: requested=%s response_preview=%s",
                        num_questions,
                        _preview_text(questions_text),
                    )
                    return []
            logger.warning("[AI QUESTIONS] Gemini question response did not contain text: requested=%s", num_questions)
                    
        except Exception as e:
            logger.exception("[AI QUESTIONS] Gemini question generation call failed")
            return []
        
        return []
    
    def provide_feedback(self, questions: List[str], answers: List[str], resume_text: str, 
                        gesture_analysis: Optional[Dict] = None,
                        question_numbers: Optional[List[int]] = None) -> str:
        """Provide detailed feedback with verification for each question-answer pair using Gemini API"""
        if not self.configured:
            return ""
        
        # Count tokens for this feedback generation
        counter = get_token_counter()
        
        qa_blocks = []
        for i, (q, a) in enumerate(zip(questions, answers)):
            q_number = question_numbers[i] if question_numbers and i < len(question_numbers) else (i + 1)
            qa_blocks.append(f"Question {q_number}: {q}\nAnswer: {a}")
        qa_pairs = "\n\n".join(qa_blocks)
        
        # Calculate tokens
        questions_tokens = sum(counter.count_tokens(q) for q in questions)
        answers_tokens = sum(counter.count_tokens(a) for a in answers)
        resume_tokens = counter.count_tokens(resume_text)
        
        logger.info(
            "[AI QUESTIONS] Token Count for Feedback Generation: questions=%s answers=%s resume=%s subtotal=%s",
            questions_tokens,
            answers_tokens,
            resume_tokens,
            questions_tokens + answers_tokens + resume_tokens,
        )
        
        # Add gesture analysis context if available
        gesture_context = ""
        if gesture_analysis:
            engagement = gesture_analysis.get('average_engagement', 0)
            eye_contact = gesture_analysis.get('eye_contact_percentage', 0)
            posture = gesture_analysis.get('posture_score', 0)
            gesture_context = f"\n\nCommunication Metrics (from video analysis):\n- Engagement Score: {engagement:.1f}/10\n- Eye Contact: {eye_contact:.0f}%\n- Posture Score: {posture:.1f}/10"
        
        # Extract assessment context from resume_text if available
        assessment_context = ""
        total_questions = len(questions)
        answered_questions = len(answers)
        unanswered_count = total_questions - answered_questions
        
        # Try to extract experience level and total questions from resume_text
        experience_level = "Not specified"
        if "Experience level" in resume_text:
            exp_match = re.search(r'Experience level[:\s]+([^\n]+)', resume_text)
            if exp_match:
                experience_level = exp_match.group(1).strip()
        
        if "Total interview questions" in resume_text:
            total_match = re.search(r'Total interview questions[:\s]+(\d+)', resume_text)
            if total_match:
                total_questions = int(total_match.group(1))
                unanswered_count = total_questions - answered_questions
        
        coverage_percent = round((answered_questions / total_questions) * 100) if total_questions > 0 else 0
        
        prompt = f"""
        You are a STRICT and EXPERIENCED technical interviewer evaluating a candidate's interview performance. 
        Be CRITICAL and HONEST in your assessment based on the candidate's actual answers.
        
        [WARN] CRITICAL ASSESSMENT CONTEXT:
        - Total questions asked: {total_questions}
        - Questions answered by candidate: {answered_questions}
        - Questions NOT answered: {unanswered_count}
        - Completion rate: {coverage_percent}%
        - Experience level expected: {experience_level}
        
        [WARN] SCORING RULES:
        1. For EACH answered question, evaluate based on:
           - Technical accuracy and depth (does answer show understanding?)
           - Completeness (did they address all aspects of the question?)
           - Relevance to experience level (is answer appropriate for {experience_level}?)
           - Communication clarity and structure
        
        2. Question-wise scores (0-10):
           - 8-10: Excellent answer, demonstrates strong understanding, complete and accurate
           - 6-7: Good answer, mostly correct but missing some details
           - 4-5: Average answer, partially correct but significant gaps
           - 2-3: Poor answer, minimal understanding, mostly incorrect
           - 0-1: Very poor or no meaningful answer
        
        3. Overall scores MUST account for:
           - Average of question-wise scores (weighted by answered questions)
           - HEAVY PENALTY for unanswered questions: Each unanswered question reduces overall score by (10 / total_questions)
           - Experience level alignment: If answers don't match {experience_level} expectations, reduce scores
        
        4. Final score calculation:
           - Base score = Average of all answered question scores
           - Penalty = (unanswered_count * 10) / total_questions
           - Final score = Base score - Penalty (minimum 0, maximum 10)
        
        Candidate's Background:
        {resume_text}
        
        Interview Questions and Answers:
        {qa_pairs}{gesture_context}
        
        EVALUATION INSTRUCTIONS:
        - The question numbers (Q1, Q2, Q3, etc.) correspond EXACTLY to the original interview question numbers.
        - You MUST preserve these numbers exactly as given (do NOT renumber or reorder questions).
        - For EACH answered question, provide detailed verification.
        - Compare answers against the expected knowledge for {experience_level} level.
        - Be specific about what was covered and what was missing in each answer.
        - Question scores should reflect actual answer quality, not just participation.
        
        Provide feedback in this EXACT format:
        
        **QUESTION-WISE VERIFICATION:**
        Q1: [Question text]
        [CHECK] Covered: [List what the candidate correctly addressed]
        [X] Missing: [List what the candidate failed to address or got wrong]
        Score: [X/10] - [Brief reason for score based on technical accuracy, completeness, and experience level alignment]
        
        Q2: [Question text]
        [CHECK] Covered: [List what the candidate correctly addressed]
        [X] Missing: [List what the candidate failed to address or got wrong]
        Score: [X/10] - [Brief reason for score based on technical accuracy, completeness, and experience level alignment]
        
        [Continue for ALL answered questions only...]
        
        **OVERALL ASSESSMENT:**
        **Technical Competency**: [Feedback based on technical accuracy and depth of answered questions, adjusted for {experience_level} level expectations. Penalize for {unanswered_count} unanswered questions.] Rating: [X/10]
        **Communication Skills**: [Feedback on clarity, structure, articulation of answered questions. Penalize for incomplete participation.] Rating: [X/10]
        **Problem-Solving Approach**: [Feedback on reasoning and approach in answered questions. Penalize for incomplete participation.] Rating: [X/10]
        **Strengths**: [Specific strengths observed in answers]
        **Areas for Improvement**: [Specific gaps or weaknesses found. MUST mention incomplete participation ({unanswered_count} unanswered questions) as a major issue.]
        **Overall Assessment**: [Concise, realistic overall evaluation. MUST reflect incomplete participation ({coverage_percent}% completion). Score should be calculated as: (average of question scores) - (penalty for unanswered questions).] Rating: [X/10]
        
        Note:
        - Ratings MUST be calculated based on the scoring rules above.
        - Overall score = (average of question scores) - (({unanswered_count} * 10) / {total_questions})
        - Keep feedback professional, balanced, and evidence-based.
        - Be honest and critical in your verification.
        - DO NOT inflate scores - incomplete participation is a serious issue.
        """
        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config={
                    'temperature': 0.2,
                    # 'max_output_tokens': 2048,
                    'top_p': 0.95,
                    'top_k': 40,
                },
            )
            if response.text:
                # Count response tokens
                response_tokens = counter.count_tokens(response.text)
                total_tokens = questions_tokens + answers_tokens + resume_tokens + response_tokens
                
                logger.info(
                    "[AI QUESTIONS] Feedback token usage: response=%s total=%s",
                    response_tokens,
                    total_tokens,
                )
                
                return response.text
            else:
                return ""
                
        except Exception as e:
            logger.exception("[AI QUESTIONS] Error generating feedback")
            return ""

_gemini_client_singleton: GeminiAIClient | None = None


def get_gemini_client() -> GeminiAIClient:
    """Process-wide singleton for the Vertex AI Gemini client.

    Building this every call re-runs configure(), re-reads env, re-loads
    credentials and re-instantiates the Gemini client — costing ~500 ms-1 s
    per call. Reuse a single configured client across the process lifetime
    so question generation only pays that cost once.
    """
    global _gemini_client_singleton
    if _gemini_client_singleton is None or not _gemini_client_singleton.configured:
        _gemini_client_singleton = GeminiAIClient()
    return _gemini_client_singleton

_model = None  # Global cache for the loaded model

# def get_faster_whisper_model():
#     """Load the Faster-Whisper model optimized for accuracy."""
#     global _model
#     if _model is None:
#         # Use "small" model for better accuracy (balance between speed and accuracy)
#         # "base" is faster but less accurate, "small" is better for accuracy
#         model_size = "base"  # Better accuracy than "base"
#         device = "cpu"
#         compute_type = "int8"  # Can use "float16" if GPU available for better accuracy

#         try:
#             logger.info(
#                 "[AI TRANSCRIPTION] Loading Whisper model: model=%s device=%s compute=%s",
#                 model_size,
#                 device,
#                 compute_type,
#             )
#             _model = WhisperModel(
#                 model_size, 
#                 device=device, 
#                 compute_type=compute_type,
#                 # Optimizations for accuracy
#                 cpu_threads=4,  # Use multiple CPU threads
#                 num_workers=1 
#                 # Single worker for consistency
#             )
#             logger.info("[AI TRANSCRIPTION] Whisper model loaded successfully")
#         except Exception as e:
#             logger.exception("[AI TRANSCRIPTION] Error loading Whisper model; falling back to base model")
#             try:
#                 _model = WhisperModel("base", device="cpu", compute_type="int8")
#                 logger.info("[AI TRANSCRIPTION] Fallback Whisper model loaded successfully")
#             except Exception as fallback_error:
#                 logger.exception("[AI TRANSCRIPTION] Fallback Whisper model also failed")
#                 raise
#     else:
#         logger.info("[AI TRANSCRIPTION] Reusing cached Whisper model")
#     return _model


def convert_webm_to_wav(input_path: str) -> str:
    """Convert WebM audio to WAV format for better Whisper compatibility."""
    try:
        import subprocess
        import tempfile
        import os
        
        # Validate input file
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        file_size = os.path.getsize(input_path)
        if file_size < 100:  # Too small to be valid audio
            raise ValueError(f"File too small ({file_size} bytes) to be valid audio")
        
        logger.info(
            "[AI TRANSCRIPTION] Converting WebM to WAV: file=%s bytes=%s",
            os.path.basename(input_path),
            file_size,
        )
        
        # First try with ffmpeg
        try:
            # Create temporary WAV file
            wav_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            wav_path = wav_file.name
            wav_file.close()
            
            # Use ffmpeg to convert audio to WAV with more robust settings for fragmented WebM
            cmd = [
                'ffmpeg', '-i', input_path,
                '-f', 'wav',             # Force WAV output format
                '-acodec', 'pcm_s16le',  # 16-bit PCM
                '-ar', '16000',          # 16kHz sample rate (Whisper optimal)
                '-ac', '1',              # Mono channel
                '-avoid_negative_ts', 'make_zero',  # Handle timing issues
                '-fflags', '+genpts+discardcorrupt',  # Generate timestamps and discard corrupt packets
                '-ignore_unknown',       # Ignore unknown streams
                '-movflags', '+faststart',  # Optimize for streaming
                '-y',                    # Overwrite output
                wav_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0 and os.path.exists(wav_path):
                wav_size = os.path.getsize(wav_path)
                if wav_size > 0:
                    logger.info(
                        "[AI TRANSCRIPTION] Audio converted WebM->WAV: before=%s after=%s",
                        file_size,
                        wav_size,
                    )
                    return wav_path
                else:
                    logger.error("[AI TRANSCRIPTION] Converted WAV file is empty")
                    try:
                        os.unlink(wav_path)
                    except:
                        pass
            else:
                logger.error("[AI TRANSCRIPTION] FFmpeg conversion failed: %s", result.stderr)
                # Clean up failed conversion
                try:
                    os.unlink(wav_path)
                except:
                    pass
        except FileNotFoundError:
            logger.warning("[AI TRANSCRIPTION] FFmpeg not found, trying pydub conversion")
            
        # Fallback: Try with pydub
        try:
            from pydub import AudioSegment
            
            logger.info("[AI TRANSCRIPTION] Attempting pydub conversion")
            
            # Try multiple formats to auto-detect - prioritize non-WebM formats
            formats_to_try = ["wav", "mp4", "ogg", "webm", "m4a", "aac"]
            audio = None
            loaded_format = None
            
            for fmt in formats_to_try:
                try:
                    logger.info("[AI TRANSCRIPTION] Trying audio format: %s", fmt)
                    audio = AudioSegment.from_file(input_path, format=fmt)
                    loaded_format = fmt
                    logger.info("[AI TRANSCRIPTION] Successfully loaded audio as %s", fmt)
                    break
                except Exception as e:
                    logger.debug("[AI TRANSCRIPTION] Failed loading as %s: %s", fmt, str(e)[:100])
                    continue
            
            if audio is None:
                raise Exception("Could not load audio in any supported format")
            
            # Validate audio has content
            if len(audio) == 0:
                raise Exception("Audio file is empty or silent")
            
            # Convert to WAV with Whisper-optimal settings
            audio = audio.set_frame_rate(16000).set_channels(1)
            
            # Create temporary WAV file
            wav_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            wav_path = wav_file.name
            wav_file.close()
            
            # Export as WAV
            audio.export(wav_path, format="wav")
            
            if os.path.exists(wav_path):
                wav_size = os.path.getsize(wav_path)
                if wav_size > 0:
                    logger.info(
                        "[AI TRANSCRIPTION] Audio converted with pydub: format=%s before=%s after=%s",
                        loaded_format,
                        file_size,
                        wav_size,
                    )
                    return wav_path
                else:
                    logger.error("[AI TRANSCRIPTION] pydub converted WAV file is empty")
                    try:
                        os.unlink(wav_path)
                    except:
                        pass
                    raise Exception("Converted WAV file is empty")
                
        except ImportError:
            logger.warning("[AI TRANSCRIPTION] pydub not available, using original file")
        except Exception as e:
            logger.exception("[AI TRANSCRIPTION] pydub conversion failed")
            
        # If all conversions fail, return original
        logger.warning("[AI TRANSCRIPTION] Using original WebM file (no conversion available)")
        return input_path
            
    except Exception as e:
        logger.exception("[AI TRANSCRIPTION] Audio conversion error")
        return input_path  # Return original if conversion fails

def post_process_transcript(transcript: str) -> str:
    """Post-process transcript to fix common errors, remove repetitions, and improve readability"""
    if not transcript:
        return transcript
    
    import re
    
    # Step 1: Fix common spacing issues
    transcript = re.sub(r'\s+', ' ', transcript)  # Multiple spaces to single space
    
    # Step 2: Remove consecutive repeated words (common Whisper issue)
    # This removes patterns like "the the the" or "3rd of the 3rd of the 3rd"
    words = transcript.split()
    deduped_words = []
    prev_word = None
    repeat_count = 0
    
    for word in words:
        # Check if current word is different from previous or if we've had too many repeats
        word_lower = word.lower()
        if word_lower != (prev_word.lower() if prev_word else None):
            deduped_words.append(word)
            prev_word = word
            repeat_count = 0
        else:
            repeat_count += 1
            # Allow max 2 consecutive repeats (so "very very important" is OK, but not "very very very")
            if repeat_count <= 1:
                deduped_words.append(word)
    
    transcript = ' '.join(deduped_words)
    
    # Step 3: Remove repetitive phrases (like "of the 3rd of the 3rd of the 3rd")
    # Detect when same phrase is repeated multiple times
    transcript = re.sub(r'\b(\w+(?:\s+\w+){0,3})\s+(?:\1\s+){2,}', r'\1 ', transcript, flags=re.IGNORECASE)
    
    # Step 4: Fix common word errors (add more as needed)
    common_fixes = {
        r'\bpandas\b': 'pandas',  # Ensure correct capitalization
        r'\bnumpy\b': 'NumPy',
        r'\bsklearn\b': 'scikit-learn',
        r'\bapi\b': 'API',
        r'\bhttp\b': 'HTTP',
        r'\bjson\b': 'JSON',
        r'\bhtml\b': 'HTML',
        r'\bcss\b': 'CSS',
        r'\bjs\b': 'JavaScript',
        r'\bdb\b': 'database',
        r'\bsql\b': 'SQL',
    }
    
    for pattern, replacement in common_fixes.items():
        transcript = re.sub(pattern, replacement, transcript, flags=re.IGNORECASE)
    
    # Step 5: Final cleanup - remove extra spaces again
    transcript = re.sub(r'\s+', ' ', transcript).strip()
    
    # Step 6: Capitalize first letter
    if transcript:
        transcript = transcript[0].upper() + transcript[1:] if len(transcript) > 1 else transcript.upper()
    
    return transcript.strip()

# def transcribe_audio_chunk_realtime(audio_file_path: str, language_hint: str = None) -> str:
#     """Fast transcription for real-time audio chunks using optimized settings."""
#     converted_path = None
#     try:
#         logger.info("[AI TRANSCRIPTION] Real-time chunk transcription: %s", audio_file_path)
        
#         # Validate input file exists and has content
#         import os
#         if not os.path.exists(audio_file_path):
#             logger.error("[AI TRANSCRIPTION] Audio file not found: %s", audio_file_path)
#             return ""
        
#         file_size = os.path.getsize(audio_file_path)
#         if file_size < 100:  # Too small for meaningful transcription
#             logger.warning("[AI TRANSCRIPTION] Audio chunk too small (%s bytes), skipping transcription", file_size)
#             return ""
        
#         # Convert WebM to WAV for better compatibility
#         converted_path = convert_webm_to_wav(audio_file_path)
        
#         # If conversion failed and returned original path, the file might be problematic
#         if converted_path == audio_file_path:
#             logger.warning("[AI TRANSCRIPTION] Using original file (conversion failed), may have compatibility issues")
        
#         model = get_faster_whisper_model()
        
#         # Optimized settings for speed over accuracy
#         segments, info = model.transcribe(
#             converted_path,
#             beam_size=1,  # Fastest beam size
#             language=language_hint or "en",
#             word_timestamps=False,
#             vad_filter=True,  # Voice activity detection
#             vad_parameters=dict(min_silence_duration_ms=300),  # Shorter silence detection
#             temperature=0.0,  # Deterministic for speed
#             compression_ratio_threshold=2.4,
#             log_prob_threshold=-1.0,
#             no_speech_threshold=0.6,
#             condition_on_previous_text=False  # Faster processing
#         )
        
#         transcript_parts = []
#         for segment in segments:
#             transcript_parts.append(segment.text)
        
#         transcript = " ".join(transcript_parts).strip()
        
#         if transcript:
#             logger.info("[AI TRANSCRIPTION] Real-time transcription preview: %s", _preview_text(transcript, 50))
#         else:
#             logger.info("[AI TRANSCRIPTION] No speech detected in chunk")
        
#         return transcript
        
#     except Exception as e:
#         logger.exception("[AI TRANSCRIPTION] Real-time transcription error")
#         return ""
#     finally:
#         # Clean up converted file
#         if converted_path and converted_path != audio_file_path:
#             try:
#                 os.unlink(converted_path)
#             except:
#                 pass

# def transcribe_audio_with_whisper(audio_file_path: str, language_hint: str = None) -> str:
#     """Transcribe audio using Faster-Whisper (Python native) — full audio capture"""
#     converted_path = None
#     try:
#         logger.info("[AI TRANSCRIPTION] Starting Whisper transcription for: %s", audio_file_path)
#         logger.info("[AI TRANSCRIPTION] File exists: %s", os.path.exists(audio_file_path))
#         if os.path.exists(audio_file_path):
#             file_size = os.path.getsize(audio_file_path)
#             logger.info("[AI TRANSCRIPTION] File size: %s bytes", file_size)
        
#         # Convert WebM to WAV for better compatibility
#         converted_path = convert_webm_to_wav(audio_file_path)
        
#         model = get_faster_whisper_model()
#         logger.info("[AI TRANSCRIPTION] Model loaded successfully, starting transcription")

#         segments, info = model.transcribe(
#             converted_path,
#             language=language_hint or "en",

#             # Accuracy > speed
#             beam_size=5,
#             best_of=5,

            
            
#             temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0),

#             # Relax filtering so nothing gets dropped at model level
#             compression_ratio_threshold=2.8,
#             log_prob_threshold=-2.0,
#             no_speech_threshold=0.3,
#             condition_on_previous_text=False,
#             vad_filter=False,
#             without_timestamps=False,
#         )

#         logger.info(
#             "[AI TRANSCRIPTION] Detected language=%s probability=%.2f duration=%.2fs",
#             info.language,
#             info.language_probability,
#             info.duration,
#         )

#         # Collect EVERY segment — no confidence filtering, no aggressive dedup.
#         # Model-level thresholds already handle quality.
#         transcript_parts = []
#         prev_text = ""
#         prev_start = -1.0
#         prev_end = -1.0

#         for segment in segments:
#             segment_text = segment.text.strip()
#             if not segment_text:
#                 continue

#             # Only skip if EXACT same text AND same time window (true duplicate from
#             # decoder glitch — not a legitimate repetition in speech)
#             if (
#                 segment_text == prev_text
#                 and abs(segment.start - prev_start) < 0.05
#                 and abs(segment.end - prev_end) < 0.05
#             ):
#                 logger.warning("[AI TRANSCRIPTION] Skipping decoder-duplicate: %s", _preview_text(segment_text, 50))
#                 continue

#             transcript_parts.append(segment_text)
#             prev_text = segment_text
#             prev_start = segment.start
#             prev_end = segment.end

#         transcript = " ".join(transcript_parts).strip()
#         transcript = post_process_transcript(transcript)

#         logger.info(
#             "[AI TRANSCRIPTION] Segments collected=%s final_transcript_preview=%s",
#             len(transcript_parts),
#             _preview_text(transcript, 100),
#         )
        
#         return transcript
#     except Exception as e:
#         logger.exception("[AI TRANSCRIPTION] Error in faster-whisper transcription")
#         return ""

# def transcribe_audio(audio_file_path: str, method: str = 'whisper') -> str:
#     """
#     Transcribe audio using ONLY Whisper model - no fallbacks allowed.
#     This ensures consistent, high-quality transcription.
#     """
#     logger.info("[AI TRANSCRIPTION] Using Whisper model for transcription")
#     logger.info("[AI TRANSCRIPTION] Audio file: %s", audio_file_path)
#     logger.info("[AI TRANSCRIPTION] Method: %s (Whisper enforced)", method)
    
#     transcript = transcribe_audio_with_whisper(audio_file_path)
    
#     if not transcript:
#         logger.error("[AI TRANSCRIPTION] Whisper transcription failed - returning empty string (no fallbacks)")
#         return ""
    
#     logger.info("[AI TRANSCRIPTION] Whisper transcription successful: %s", _preview_text(transcript, 50))
#     return transcript


# Mock transcript generation removed - Whisper-only enforcement

def extract_scores_from_feedback(feedback_text: str) -> Dict[str, float]:
    """Extract numerical scores from AI feedback text"""
    scores = {
        'technical_score': 0.0,
        'communication_score': 0.0,
        'problem_solving_score': 0.0,
        'overall_score': 0.0
    }
    
    try:
        # Extract ratings from feedback using regex
        technical_match = re.search(r'Technical Competency.*?Rating:\s*(\d+)', feedback_text)
        communication_match = re.search(r'Communication Skills.*?Rating:\s*(\d+)', feedback_text)
        problem_solving_match = re.search(r'Problem-Solving Approach.*?Rating:\s*(\d+)', feedback_text)
        overall_match = re.search(r'Overall Assessment.*?Rating:\s*(\d+)', feedback_text)
        
        if technical_match:
            scores['technical_score'] = float(technical_match.group(1))
        if communication_match:
            scores['communication_score'] = float(communication_match.group(1))
        if problem_solving_match:
            scores['problem_solving_score'] = float(problem_solving_match.group(1))
        if overall_match:
            scores['overall_score'] = float(overall_match.group(1))
            
    except Exception as e:
        logger.exception("[AI QUESTIONS] Error extracting scores")
    
    return scores


def get_mixed_questions(role_type: str, experience_level: str, total_questions: int,
                       num_hardcoded: int, resume_text: str = "",
                       num_coding: int = 0,
                       hardcoded_question_ids: list = None,
                       tech_stack: str = "",
                       job_description: str = "") -> List[Dict[str, any]]:
    """
    Get a mix of hardcoded questions, coding questions, and LLM-generated questions.

    Args:
        role_type: The role type (e.g., 'software_engineer')
        experience_level: Experience level (e.g., '2-5_years')
        total_questions: Total number of questions needed
        num_hardcoded: Number of hardcoded text questions to include
        resume_text: Resume text for LLM question generation
        num_coding: Number of coding questions from core.Question bank

    Returns:
        List of question dictionaries with 'text', 'type', and 'source' keys
    """
    from .models import Question, Profile
    import random

    questions = []

   # Step 1: Load admin-selected hardcoded questions (supports prefixed IDs)
    if hardcoded_question_ids:
        # Question generation frequently runs in a background thread (see
        # AI_assessment.tasks.generate_questions_async) where the request's
        # tenant context never propagates — contextvars don't cross thread
        # boundaries. core.Question and mock_interview.Question are TenantModels,
        # so with an empty context TenantManager filters them down to .none()
        # and the admin-selected hardcoded questions silently vanish.
        # Elevate to super-admin for the duration of this lookup to bypass the
        # multi-tenancy filter (instead of rewriting every query with
        # all_for_super_admin()), then restore the previous context.
        from organization.context import (
            current_organization_id,
            current_user_is_super_admin,
            current_user_is_individual,
        )
        _org_token = current_organization_id.set(None)
        _super_token = current_user_is_super_admin.set(True)
        _indiv_token = current_user_is_individual.set(False)
        try:
            from core.models import Question as CoreQuestion
            from .models import Question as AIQuestion

            core_ids = []
            mock_ids = [] 

            for qid in hardcoded_question_ids:
                qid_str = str(qid)
                if qid_str.startswith('core_'):
                    core_ids.append(int(qid_str.replace('core_', '')))
                elif qid_str.startswith('mock_'):
                    mock_ids.append(int(qid_str.replace('mock_', '')))
                else:
                    # Legacy plain integer → treat as core
                    try:
                        core_ids.append(int(qid_str))
                    except ValueError:
                        pass

            # Load core questions (coding/text/subjective etc.)
            for q in CoreQuestion.objects.filter(id__in=core_ids):
                questions.append({
                    'text': q.title + ('\n\n' + q.description if q.description else ''),
                    'type': q.question_type,
                    'source': 'hardcoded',
                    'question_id': q.id,
                    'sample_input': getattr(q, 'sample_input', '') or '',
                    'sample_output': getattr(q, 'sample_output', '') or '',
                    'marks': getattr(q, 'marks', 0),
                })

                    # ✅ Load mock interview questions
            if mock_ids:
                from mock_interview.models import Question as MockQuestion
                for q in MockQuestion.objects.filter(id__in=mock_ids):
                    questions.append({
                        'text': q.text,
                        'type': 'text',
                        'source': 'hardcoded',
                        'question_id': f'mock_{q.id}',
                    })

            logger.info(
                "[AI QUESTIONS] Loaded hardcoded questions: core=%s mock=%s total=%s",
                len(core_ids),
                len(mock_ids),
                len(questions),
            )
            logger.info(
                "[AI QUESTIONS] Loaded selected hardcoded questions: core_ids=%s mock_ids=%s loaded=%s",
                len(core_ids),
                len(mock_ids),
                len(questions),
            )
        except Exception as e:
            logger.exception("[AI QUESTIONS] Error fetching selected hardcoded questions")
        finally:
            # Always restore the caller's tenant context, even on error, so the
            # super-admin elevation never leaks into the rest of the request.
            current_organization_id.reset(_org_token)
            current_user_is_super_admin.reset(_super_token)
            current_user_is_individual.reset(_indiv_token)
    # Step 2: Generate remaining questions using LLM
    num_llm_needed = total_questions - len(questions)
    
    logger.info(
        "[AI QUESTIONS] Question mix calculation: total_needed=%s hardcoded_selected=%s llm_needed=%s",
        total_questions,
        len(questions),
        num_llm_needed,
    )
    logger.info(
        "[AI QUESTIONS] Mix requested: role=%s experience=%s total=%s hardcoded_loaded=%s hardcoded_ids=%s coding_requested=%s llm_needed=%s resume_chars=%s",
        role_type,
        experience_level,
        total_questions,
        len(questions),
        len(hardcoded_question_ids or []),
        num_coding,
        num_llm_needed,
        len(resume_text or ""),
    )
    
    if num_llm_needed > 0:
        try:
            gemini_client = get_gemini_client()
            logger.info("[AI QUESTIONS] Gemini client created: configured=%s", gemini_client.configured)

            # OPT: drop the round-trip "test_connection" call. It was making
            # an extra LLM request (~2-5 s) just to probe the connection
            # before the real generate_questions call. Skip it — if the
            # actual generation fails we already log and fall back below.
            if gemini_client.configured:
                logger.info("[AI QUESTIONS] Vertex AI client configured")
                logger.info("[AI QUESTIONS] Gemini configured; generating LLM questions: needed=%s", num_llm_needed)
                
                # Map role_type to display name
                role_display = dict(Question._meta.get_field('complexity_level').choices).get(
                    experience_level, experience_level
                )
                
                llm_questions = gemini_client.generate_questions(
                    resume_text=resume_text,
                    role_type=role_type,
                    num_questions=num_llm_needed,
                    experience_level=role_display,
                    tech_stack=tech_stack,
                    job_description=job_description
                )
                
                if llm_questions:
                    logger.info(
                        "[AI QUESTIONS] Gemini generated raw questions: requested=%s raw_count=%s",
                        num_llm_needed,
                        len(llm_questions),
                    )
                    # Get hardcoded question texts for duplicate filtering
                    hardcoded_texts = [q['text'] for q in questions if q['source'] == 'hardcoded']
                    
                    # Filter out duplicates
                    filtered_llm_questions = filter_duplicate_questions(
                        llm_questions, 
                        hardcoded_texts,
                        similarity_threshold=0.7
                    )
                    
                    # If we filtered out too many, generate more
                    if len(filtered_llm_questions) < num_llm_needed:
                        shortage = num_llm_needed - len(filtered_llm_questions)
                        logger.warning("[AI QUESTIONS] Need %s more questions after filtering duplicates", shortage)
                        logger.warning(
                            "[AI QUESTIONS] LLM duplicate filtering shortage: needed=%s after_filter=%s shortage=%s",
                            num_llm_needed,
                            len(filtered_llm_questions),
                            shortage,
                        )
                        additional_questions = gemini_client.generate_questions(
                            resume_text=resume_text,
                            role_type=role_type,
                            num_questions=shortage,
                            experience_level=role_display,
                            tech_stack=tech_stack,
                            job_description=job_description
                        )
                        if additional_questions:
                            additional_filtered = filter_duplicate_questions(
                                additional_questions,
                                hardcoded_texts + filtered_llm_questions,
                                similarity_threshold=0.7
                            )
                            filtered_llm_questions.extend(additional_filtered)
                    
                    for q in filtered_llm_questions:
                        questions.append({
                            'text': q,
                            'type': 'text',
                            'source': 'llm'
                        })
                    logger.info("[AI QUESTIONS] Generated %s unique LLM questions", len(filtered_llm_questions))
                    logger.info(
                        "[AI QUESTIONS] LLM questions accepted after filtering: accepted=%s requested=%s",
                        len(filtered_llm_questions),
                        num_llm_needed,
                    )
                else:
                    logger.warning("[AI QUESTIONS] Gemini returned no LLM questions after parsing")
            else:
                logger.warning(
                    "[AI QUESTIONS] LLM connection failed in get_mixed_questions: configured=%s",
                    gemini_client.configured,
                )
                logger.warning(
                    "[AI QUESTIONS] Gemini connection failed in get_mixed_questions: configured=%s project_present=%s credentials_env_present=%s",
                    gemini_client.configured,
                    bool(os.environ.get('GOOGLE_CLOUD_PROJECT')),
                    bool(os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')),
                )
                
        except Exception as e:
            logger.exception("[AI QUESTIONS] Error while generating LLM questions in get_mixed_questions")
            
    else:
        logger.info("[AI QUESTIONS] No LLM questions needed; all requested questions are hardcoded")
    
    coding_count = sum(1 for q in questions if q.get('type') == 'coding')
    hardcoded_count = sum(1 for q in questions if q['source'] == 'hardcoded' and q.get('type') != 'coding')
    llm_count = sum(1 for q in questions if q['source'] == 'llm')
    logger.info(
        "[AI QUESTIONS] Total questions assembled: total=%s coding=%s hardcoded_text=%s llm=%s",
        len(questions),
        coding_count,
        hardcoded_count,
        llm_count,
    )
    logger.info(
        "[AI QUESTIONS] Mix assembled before shuffle: total=%s coding=%s hardcoded_text=%s llm=%s",
        len(questions),
        coding_count,
        hardcoded_count,
        llm_count,
    )
    
    # Shuffle the final question list to randomize order
    random.shuffle(questions)
    logger.info("[AI QUESTIONS] Questions shuffled for randomization")
    
    # return questions[:total_questions]
    # Never cut hardcoded questions — use max of total or hardcoded count
    effective_total = max(total_questions, len(hardcoded_question_ids or []))
    final_questions = questions[:effective_total]
    logger.info(
        "[AI QUESTIONS] Mix returning to caller: returned=%s effective_total=%s sources=%s",
        len(final_questions),
        effective_total,
        [q.get('source') for q in final_questions if isinstance(q, dict)],
    )
    return final_questions
