"""
LangGraph-powered AI Interview Engine
Implements a stateful interview flow with difficulty-aware questions,
follow-up probing, real-time evaluation, and final report generation.
"""
import os
import json
import re
from typing import TypedDict, List, Optional

# import google.genai as genai  # temporarily disabled — using Groq
from groq import Groq as GroqClient
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt, Command

try:
    from langgraph.checkpoint.sqlite import SqliteSaver
    import sqlite3
    _DB_PATH = os.path.join(os.path.dirname(__file__), 'langgraph_sessions.sqlite3')
    _CONN = sqlite3.connect(_DB_PATH, check_same_thread=False)
    _CHECKPOINTER = SqliteSaver(_CONN)
except Exception:
    from langgraph.checkpoint.memory import MemorySaver
    _CHECKPOINTER = MemorySaver()


# ── LLM helper ────────────────────────────────────────────────────────────────
# def _get_client():  # Gemini — temporarily disabled
#     api_key = os.getenv("GOOGLE_AI_API_KEY", "")
#     return genai.Client(api_key=api_key)


def _llm(prompt: str) -> str:
    # Groq (temporary replacement for Gemini)
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
      raise ValueError("GROQ_API_KEY is missing")

    client = GroqClient(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()


def _parse_json(text: str, default: dict) -> dict:
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    # Second attempt – strip markdown fences
    try:
        cleaned = re.sub(r'```(?:json)?', '', text).strip().strip('`')
        if cleaned:
            return json.loads(cleaned)
    except Exception:
        pass
    return default


def _score_needs_followup(score: float) -> bool:
    """Follow up only for partially correct answers (4-8 range)."""
    return 4 <= score <= 8


def _coerce_score(value, default: int = 5) -> int:
    try:
        return max(0, min(10, round(float(value))))
    except (TypeError, ValueError):
        return default


# ── Prompt helpers ────────────────────────────────────────────────────────────
_DIFFICULTY_DESC = {
    'easy': 'beginner-level conceptual (definitions, basic syntax, simple use-cases)',
    'medium': 'intermediate applied (practical coding, design patterns, problem-solving)',
    'hard': 'advanced expert-level (system design, edge cases, internals, optimisation)',
}


def _build_resume_context(resume_data: dict) -> str:
    """Format resume data into a compact prompt context string."""
    if not resume_data:
        return ''
    skills = ', '.join(resume_data.get('skills', [])[:15]) or 'N/A'
    projects = '; '.join(resume_data.get('projects', [])[:4]) or 'N/A'
    exp = resume_data.get('experience_years', 'N/A')
    summary = resume_data.get('summary', '')
    return (
        f"Candidate Background:\n"
        f"  Experience: {exp}\n"
        f"  Skills: {skills}\n"
        f"  Projects: {projects}\n"
        + (f"  Summary: {summary}\n" if summary else '')
    )


def _get_interview_mode(state: dict) -> str:
    """Determine mode: 'resume', 'role', or 'hybrid'."""
    has_resume = bool(state.get('resume_data'))
    has_role = bool(state.get('role', '').strip())
    if has_resume and has_role:
        return 'hybrid'
    if has_resume:
        return 'resume'
    return 'role'


def _generate_question(state: dict) -> str:
    asked = [
        item['content']
        for item in state['conversation']
        if item['type'] in ('question', 'followup')
    ]
    asked_text = '\n'.join(f'- {q}' for q in asked) if asked else 'None yet'
    mode = _get_interview_mode(state)
    resume_ctx = _build_resume_context(state.get('resume_data') or {})

    if mode == 'resume':
        role_line = f"**{state.get('resume_data', {}).get('role', 'Software Engineer')}** role"
        context_block = f"""You are interviewing based on the candidate's resume.

Candidate Background:
{resume_ctx}

Generate questions that directly probe their listed skills and projects."""
    elif mode == 'hybrid':
        role_line = f"**{state['role']}** role"
        context_block = f"""You are doing a hybrid interview: combine role-specific questions with resume context.

Candidate Background:
{resume_ctx}

Alternate between role requirements and candidate's specific background."""
    else:
        role_line = f"**{state['role']}** role"
        context_block = 'You are a professional technical interviewer.'
    prompt = f"""You are a professional technical interviewer. Generate EXACTLY ONE interview question.

{context_block}

ROLE: {role_line}
DIFFICULTY: {state['difficulty']} (easy/medium/hard)
QUESTION #{state['question_number'] + 1} OF {state['max_questions']}

PREVIOUSLY ASKED TOPICS (AVOID REPEATING):
{asked_text}

RULES (MANDATORY):
✓ Generate EXACTLY one question - no sub-questions
✓ One question mark only
✓ Specific and concrete - not abstract
✓ Tests ONE skill or concept
✓ Can be answered in 1-2 minutes
✗ NO "and" connecting different concepts
✗ NO "also", "additionally", "furthermore"
✗ NO "part a/b/c" phrasing
✗ NO multi-part questions like "how and why"

Output ONLY the question text. No explanation, no numbering, no preamble."""
    
    question = _llm(prompt)
    
    # Validation: Ensure atomicity
    if question.count("?") > 1 or any(x in question.lower() for x in ["and also", "furthermore", "additionally"]):
        # Simple fallback/cleanup if the LLM fails strict constraints
        question = question.split("?")[0] + "?"
        
    return question


def _evaluate_answer(question: str, answer: str, role: str, difficulty: str) -> dict:
    prompt = f"""You are evaluating a technical interview answer using a structured rubric.

QUESTION: {question}
CANDIDATE ANSWER: {answer}
ROLE: {role}
DIFFICULTY: {difficulty}

SCORING RUBRIC:
Core Concept Understanding (0-3 points):
  3 = clear and correct understanding
  2 = mostly correct with a minor gap
  1 = partial or shallow understanding
  0 = incorrect, blank, or unrelated

Explanation Quality (0-2 points):
  2 = clear and specific
  1 = understandable but vague
  0 = unclear, missing, or incoherent

Practical Application (0-3 points):
  3 = concrete implementation detail or example
  2 = reasonable practical mention
  1 = weak or generic practical mention
  0 = no practical application

Edge Cases and Depth (0-2 points):
  2 = identifies meaningful limitations, tradeoffs, or edge cases
  1 = mentions depth but does not explain it
  0 = no edge cases or depth

Total score must be the sum of the four rubric values, from 0 to 10.

FOLLOW-UP RULE:
- Set needs_followup=true only when total score is between 4 and 8 inclusive.
- Set needs_followup=false when total score is 1 to 3 or 9 to 10.
- If the answer is blank, unrelated, or "I don't know", score 0 to 3 and needs_followup=false.
- Do not default to 5. Use the rubric.

Respond with ONLY valid JSON:
{{
  "score": <0-10 integer>,
  "rubric_breakdown": {{
    "core_understanding": <0-3>,
    "explanation_quality": <0-2>,
    "practical_application": <0-3>,
    "edge_cases": <0-2>
  }},
  "feedback": "<1-2 sentence evaluation>",
  "needs_followup": <true|false>,
  "weakest_area": "<core_understanding|explanation_quality|practical_application|edge_cases>"
}}"""
    default_eval = {
        "score": 5,
        "rubric_breakdown": {"core_understanding": 1, "explanation_quality": 1, "practical_application": 1, "edge_cases": 1},
        "feedback": "Answer recorded.",
        "needs_followup": False,
        "weakest_area": "practical_application"
    }
    text = _llm(prompt)
    result = _parse_json(text, default_eval)

    if result == default_eval:
        score_match = re.search(r'\b(?:score|total)\D{0,20}([0-9](?:\.\d+)?|10(?:\.0+)?)\b', text, re.IGNORECASE)
        if score_match:
            result['score'] = _coerce_score(score_match.group(1))

    result['score'] = _coerce_score(result.get('score', 5))
    result['needs_followup'] = _score_needs_followup(result['score'])
    if result.get('weakest_area') not in {"core_understanding", "explanation_quality", "practical_application", "edge_cases"}:
        result['weakest_area'] = "practical_application"
    return result


def _generate_followup(orig_question: str, answer: str, feedback: str, weakest_area: str, role: str,
                       resume_data: dict | None = None) -> str:
    resume_ctx = _build_resume_context(resume_data or {})
    resume_hint = f"\nCandidate Background:\n{resume_ctx}" if resume_ctx else ''

    strategy = {
        "practical_application": "Ask for concrete implementation detail or walk through code/steps.",
        "core_understanding": "Probe deeper into fundamental concepts.",
        "explanation_quality": "Request clarification or elaboration.",
        "edge_cases": "Challenge with a hypothetical or edge case."
    }
    prompt = f"""You are generating a follow-up question for a technical interview.

ROLE: {role}
{resume_hint}

CANDIDATE'S PREVIOUS RESPONSE:
{answer}

EVALUATION FEEDBACK:
{feedback}

WEAKEST AREA:
{weakest_area}

Generate the follow-up from the candidate's previous response, not from the previous question.
Do not repeat the original question.

{strategy.get(weakest_area, '')}

Rules:
- Ask exactly one targeted follow-up question.
- Focus on the weakest area shown above.
- The question must be answerable in 1-2 minutes.
- Use exactly one question mark.

Return ONLY the follow-up question text."""
    return _llm(prompt)


def _generate_final_report(state: dict) -> dict:
    avg_score = sum(state['scores']) / len(state['scores']) if state['scores'] else 0

    qa_pairs = []
    conv = state['conversation']
    i = 0
    while i < len(conv):
        if conv[i]['type'] in ('question', 'followup'):
            q_text = conv[i]['content']
            a_text, score, feedback = "No answer provided.", 0, ""
            if i + 1 < len(conv) and conv[i+1]['type'] == 'answer':
                a_text = conv[i+1]['content']
                score = conv[i+1].get('score', 0)
                feedback = conv[i+1].get('feedback', '')
                i += 1
            qa_pairs.append({
                "question": q_text,
                "answer": a_text,
                "score": score,
                "feedback": feedback
            })
        i += 1

    resume_ctx = _build_resume_context(state.get('resume_data') or {})
    resume_info = f"\nCandidate Background:\n{resume_ctx}" if resume_ctx else ""
    
    prompt = f"""Generate a final technical interview assessment using a structured competency mapping.

Candidate: {state.get('candidate_name', 'Candidate')}
Role: {state['role']}
Difficulty: {state['difficulty']}
Interview Mode: {_get_interview_mode(state)}{resume_info}
Average Score: {avg_score:.1f}/10
Questions answered: {len(state['scores'])}

Q&A Summary (includes rubric breakdowns):
{json.dumps(qa_pairs, indent=2)}

COMPETENCY MAPPING TASK:
1. Group the questions by technical competency (e.g. "System Design", "Database", "Practical Implementation", "Problem Solving").
2. Calculate a proficiency score for each.
3. Identify exactly 3 strengths and 3 improvement areas.

Respond with ONLY valid JSON:
{{
  "overall_score": <float>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "summary": "<3-4 sentence overall assessment>",
  "competencies": [
    {{ "name": "System Design", "score": <float>, "level": "Mastery/Proficiency/Basic" }},
    ...
  ],
  "strengths": ["...", "...", "..."],
  "improvements": ["...", "...", "..."],
  "recommendation": "<Strong Hire|Hire|Consider|No Hire>",
  "recommendation_reason": "<1-2 sentence justification>"
}}"""
    text = _llm(prompt)
    report = _parse_json(text, {
        "overall_score": avg_score,
        "grade": "C",
        "summary": "Interview completed.",
        "strengths": [],
        "improvements": [],
        "recommendation": "Consider",
        "recommendation_reason": "Further evaluation recommended.",
    })
    report['qa_pairs'] = qa_pairs
    report['overall_score'] = round(avg_score, 1)
    return report


# ── Graph State ───────────────────────────────────────────────────────────────
class InterviewState(TypedDict):
    candidate_name: str
    role: str
    difficulty: str
    max_questions: int
    max_followups: int
    question_number: int
    followup_count: int
    conversation: List[dict]
    scores: List[float]
    current_question: str
    final_report: Optional[dict]
    resume_data: Optional[dict]   # structured parsed resume (may be None)

# ── Graph Nodes ───────────────────────────────────────────────────────────────
def interview_node(state: InterviewState) -> InterviewState:
    """
    Generates a question, waits for the candidate's answer via interrupt(),
    evaluates it, optionally follows up, then returns updated state.
    This node is called once per main question (self-loops until all done).
    """
    q_num = state['question_number']

    # Generate the next main question
    question = _generate_question(state)

    # ── Interrupt: wait for candidate answer ──────────────────────────────────
    answer = interrupt({
        "type": "question",
        "question": question,
        "question_number": q_num + 1,
        "total_questions": state['max_questions'],
        "is_followup": False,
    })

    eval_result = _evaluate_answer(question, answer, state['role'], state['difficulty'])
    score = float(eval_result.get('score', 5))
    feedback = eval_result.get('feedback', '')
    needs_followup = eval_result.get('needs_followup', False)
    weakest_area = eval_result.get('weakest_area', 'practical_application')
    rubric = eval_result.get('rubric_breakdown', {})

    conv = list(state['conversation']) + [
        {"type": "question", "content": question},
        {
            "type": "answer", 
            "content": answer, 
            "score": score, 
            "feedback": feedback,
            "rubric": rubric,
            "weakest_area": weakest_area
        },
    ]
    scores = list(state['scores']) + [score]

    # ── Follow-up loop ────────────────────────────────────────────────────────
    last_q, last_a, last_fb, last_weakest = question, answer, feedback, weakest_area
    followup_count = 0

    while needs_followup and followup_count < state['max_followups']:
        fup_q = _generate_followup(last_q, last_a, last_fb, last_weakest, state['role'],
                                    resume_data=state.get('resume_data'))

        conv.append({"type": "followup", "content": fup_q})

        fup_answer = interrupt({
            "type": "followup",
            "question": fup_q,
            "question_number": q_num + 1,
            "total_questions": state['max_questions'],
            "is_followup": True,
        })

        fup_eval = _evaluate_answer(fup_q, fup_answer, state['role'], state['difficulty'])
        fup_score = float(fup_eval.get('score', 5))
        fup_feedback = fup_eval.get('feedback', '')
        fup_weakest = fup_eval.get('weakest_area', 'practical_application')
        fup_rubric = fup_eval.get('rubric_breakdown', {})

        conv.append({
            "type": "answer",
            "content": fup_answer,
            "score": fup_score,
            "feedback": fup_feedback,
            "rubric": fup_rubric,
            "weakest_area": fup_weakest
        })
        scores.append(fup_score)

        # Only continue follow-ups if still needed and budget remains
        needs_followup = (
            fup_eval.get('needs_followup', False)
            and (followup_count + 1 < state['max_followups'])
        )
        last_q, last_a = fup_q, fup_answer
        last_fb = fup_eval.get('feedback', '')
        last_weakest = fup_eval.get('weakest_area', 'practical_application')
        followup_count += 1

    return {
        **state,
        "conversation": conv,
        "scores": scores,
        "question_number": q_num + 1,
        "current_question": question,
        "followup_count": followup_count,
    }


def report_node(state: InterviewState) -> InterviewState:
    report = _generate_final_report(state)
    return {**state, "final_report": report}


# ── Routing ───────────────────────────────────────────────────────────────────
def _route(state: InterviewState) -> str:
    return "report" if state['question_number'] >= state['max_questions'] else "interview"


# ── Compile once (singleton) ──────────────────────────────────────────────────
_GRAPH = None


def get_interview_graph():
    global _GRAPH

    if _GRAPH is None:
        builder = StateGraph(InterviewState)
        builder.add_node("interview", interview_node)
        builder.add_node("report", report_node)
        builder.set_entry_point("interview")

        builder.add_conditional_edges(
            "interview",
            _route,
            {"interview": "interview", "report": "report"},
        )

        builder.add_edge("report", END)

        _GRAPH = builder.compile(checkpointer=_CHECKPOINTER)

        try:
            png_data = _GRAPH.get_graph().draw_mermaid_png()

            save_dir = os.path.join(os.path.dirname(__file__), "generated_graphs")
            os.makedirs(save_dir, exist_ok=True)

            save_path = os.path.join(save_dir, "graph.png")

            with open(save_path, "wb") as f:
                f.write(png_data)

            print(f"Graph image saved at {save_path}")

        except Exception as e:
            print(f"Graph image generation skipped: {e}")

    return _GRAPH


# ── Public API ────────────────────────────────────────────────────────────────
def start_session(session_id: str, candidate_name: str, role: str,
                  difficulty: str, max_questions: int = 5,
                  resume_data: dict | None = None) -> dict:
    """
    Start a new interview session.
    Returns the first question as interrupt data.
    """
    graph = get_interview_graph()
    config = {"configurable": {"thread_id": session_id}}

    initial_state: InterviewState = {
        "candidate_name": candidate_name,
        "role": role,
        "difficulty": difficulty,
        "max_questions": max_questions,
        "max_followups": 2,
        "question_number": 0,
        "followup_count": 0,
        "conversation": [],
        "scores": [],
        "current_question": "",
        "final_report": None,
        "resume_data": resume_data,
    }

    result = graph.invoke(initial_state, config=config)
    return _extract_result(result, graph, config)


def _recover_state(graph, config: dict) -> dict:
    """
    Fallback: read the last saved checkpoint state and return it as completed.
    Used when graph.invoke() fails or returns None (e.g. thread already at END,
    or checkpoint is corrupted due to a previous crash).
    """
    try:
        saved = graph.get_state(config)
        state = saved.values if saved else {}
    except Exception:
        state = {}
    return {
        "status": "completed",
        "final_report": state.get("final_report"),
        "scores": state.get("scores", []),
        "conversation": state.get("conversation", []),
        "question_number": state.get("question_number", 0),
    }


def submit_answer(session_id: str, answer: str) -> dict:
    """
    Resume the paused graph with the candidate's answer.
    Returns the next question or the final report.
    """
    import traceback
    graph = get_interview_graph()
    config = {"configurable": {"thread_id": session_id}}
    try:
        result = graph.invoke(Command(resume=answer), config=config)
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        # Corrupted checkpoint or internal LangGraph state error.
        # Log the full traceback for debugging, then recover gracefully.
        print(f"[submit_answer] graph.invoke() failed: {exc}")
        traceback.print_exc()
        return _recover_state(graph, config)
    return _extract_result(result, graph, config)


def _extract_result(result: dict, graph, config: dict) -> dict:
    """
    Parse what the graph returned:
    - If interrupted → return {status: "active", question, ...}
    - If completed  → return {status: "completed", final_report, ...}
    """
    # graph.invoke() returns None when the thread already reached END.
    if result is None:
        return _recover_state(graph, config)

    # In some cases result might be a StateSnapshot object rather than a dict
    res_dict = result if isinstance(result, dict) else getattr(result, 'values', {})
    if not res_dict and hasattr(result, '__dict__'):
        res_dict = result.__dict__

    interrupts = res_dict.get('__interrupt__', [])

    if interrupts:
        iv = interrupts[0]
        value = iv.value if hasattr(iv, 'value') else iv.get('value', {})
        return {
            "status": "active",
            "type": value.get("type", "question"),
            "question": value.get("question", ""),
            "question_number": value.get("question_number", 1),
            "total_questions": value.get("total_questions", 5),
            "is_followup": value.get("is_followup", False),
            "scores": res_dict.get("scores", []),
            "conversation": res_dict.get("conversation", []),
        }

    # Completed
    return {
        "status": "completed",
        "final_report": res_dict.get("final_report"),
        "scores": res_dict.get("scores", []),
        "conversation": res_dict.get("conversation", []),
        "question_number": res_dict.get("question_number", 0),
    }
