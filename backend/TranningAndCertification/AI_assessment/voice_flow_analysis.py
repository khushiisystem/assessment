"""Voice-flow risk analysis for AI interview proctoring.

This module intentionally returns reviewer-facing risk evidence, not a
cheating verdict. All callers should treat failures as non-blocking.
"""

from __future__ import annotations

import json
import logging
import math
import re
import statistics
import subprocess
from dataclasses import dataclass
from typing import Any

from django.utils import timezone

from AI_assessment.ai_utils import get_gemini_client
from AI_assessment.models import AIVoiceAnalysis, AIInterviewResponse, CandidateAIAssessment

logger = logging.getLogger(__name__)

SILENCE_MIN_SECONDS = 1.2
LONG_PAUSE_SECONDS = 3.0
SUSPICIOUS_PAUSE_SECONDS = 5.0

FILLER_WORDS = {
    "um",
    "uh",
    "hmm",
    "like",
    "actually",
    "basically",
    "literally",
    "you know",
    "i mean",
    "sort of",
    "kind of",
}

STRUCTURE_MARKERS = (
    "first",
    "second",
    "third",
    "finally",
    "in conclusion",
    "overall",
    "moreover",
    "furthermore",
    "therefore",
    "for example",
    "best practice",
)


@dataclass
class AudioMetrics:
    duration_seconds: float
    pause_timeline: list[dict[str, float]]
    speech_rate_timeline: list[dict[str, float]]


def analyze_and_store_voice_flow(
    *,
    assignment: CandidateAIAssessment,
    response: AIInterviewResponse,
    audio_file_path: str,
    transcript: str,
    question_text: str,
    question_number: int,
) -> AIVoiceAnalysis:
    """Analyze a spoken answer and persist/update its reviewer-facing risk row."""

    result = analyze_voice_flow(
        audio_file_path=audio_file_path,
        transcript=transcript,
        question_text=question_text,
        question_type=response.question_type,
    )

    analysis, _ = AIVoiceAnalysis.objects.update_or_create(
        candidate_assessment=assignment,
        question_number=question_number,
        defaults={
            "response": response,
            "audio_duration_seconds": result["audio_duration_seconds"],
            "transcript_word_count": result["transcript_word_count"],
            "speech_rate_wpm": result["speech_rate_wpm"],
            "pause_count": result["pause_count"],
            "long_pause_count": result["long_pause_count"],
            "longest_pause_seconds": result["longest_pause_seconds"],
            "pause_timeline": result["pause_timeline"],
            "speech_rate_timeline": result["speech_rate_timeline"],
            "filler_word_count": result["filler_word_count"],
            "sentence_complexity_delta": result["sentence_complexity_delta"],
            "answer_structure_score": result["answer_structure_score"],
            "mid_answer_shift_score": result["mid_answer_shift_score"],
            "llm_consistency_score": result["llm_consistency_score"],
            "overall_risk_score": result["overall_risk_score"],
            "risk_level": result["risk_level"],
            "signals": result["signals"],
            "llm_review": result["llm_review"],
        },
    )

    if analysis.risk_level == "high":
        append_voice_flow_alert(assignment, analysis)
    else:
        remove_voice_flow_alert(assignment, analysis.question_number)

    aggregate_voice_flow_for_assignment(assignment)
    return analysis


def analyze_voice_flow(
    *,
    audio_file_path: str,
    transcript: str,
    question_text: str,
    question_type: str = "text",
) -> dict[str, Any]:
    transcript = (transcript or "").strip()
    words = _words(transcript)

    if question_type == "coding":
        return _low_result(
            signal="Voice flow not applicable to coding response.",
            transcript_word_count=len(words),
        )

    if len(words) < 20:
        return _low_result(
            signal="Answer is too short for reliable voice-flow analysis.",
            transcript_word_count=len(words),
        )

    audio = _extract_audio_metrics(audio_file_path, len(words))
    pauses = audio.pause_timeline
    long_pauses = [p for p in pauses if p["duration_seconds"] >= LONG_PAUSE_SECONDS]
    longest_pause = max((p["duration_seconds"] for p in pauses), default=0)
    speech_rate = (len(words) / audio.duration_seconds) * 60 if audio.duration_seconds > 0 else 0

    split_ratio = _largest_pause_split_ratio(pauses, audio.duration_seconds)
    before_words, after_words = _split_words(words, split_ratio)
    before_text = " ".join(before_words)
    after_text = " ".join(after_words)

    filler_count = _count_fillers(transcript)
    before_filler_rate = _safe_rate(_count_fillers(before_text), len(before_words))
    after_filler_rate = _safe_rate(_count_fillers(after_text), len(after_words))
    complexity_delta = _sentence_complexity(after_text) - _sentence_complexity(before_text)
    structure_score = _structure_score(after_text)
    mid_answer_shift_score = _mid_answer_shift_score(
        longest_pause=longest_pause,
        before_words=len(before_words),
        after_words=len(after_words),
        before_filler_rate=before_filler_rate,
        after_filler_rate=after_filler_rate,
        complexity_delta=complexity_delta,
        structure_score=structure_score,
    )

    heuristic_score, signals = _heuristic_score(
        word_count=len(words),
        speech_rate=speech_rate,
        longest_pause=longest_pause,
        long_pause_count=len(long_pauses),
        before_words=len(before_words),
        after_words=len(after_words),
        before_filler_rate=before_filler_rate,
        after_filler_rate=after_filler_rate,
        complexity_delta=complexity_delta,
        structure_score=structure_score,
        mid_answer_shift_score=mid_answer_shift_score,
    )

    llm_review = _llm_review_if_useful(
        heuristic_score=heuristic_score,
        question_text=question_text,
        transcript=transcript,
        metrics={
            "audio_duration_seconds": round(audio.duration_seconds, 2),
            "transcript_word_count": len(words),
            "speech_rate_wpm": round(speech_rate, 2),
            "longest_pause_seconds": round(longest_pause, 2),
            "long_pause_count": len(long_pauses),
            "mid_answer_shift_score": round(mid_answer_shift_score, 2),
            "answer_structure_score": round(structure_score, 2),
            "signals": signals,
        },
    )
    llm_score = float(llm_review.get("risk_score") or 0)
    overall_score = round((heuristic_score * 0.7) + (llm_score * 0.3), 1)
    risk_level = risk_level_for_score(overall_score)

    if llm_review.get("evidence"):
        signals.extend([str(item) for item in llm_review["evidence"][:2] if item])

    return {
        "audio_duration_seconds": round(audio.duration_seconds, 2),
        "transcript_word_count": len(words),
        "speech_rate_wpm": round(speech_rate, 2),
        "pause_count": len(pauses),
        "long_pause_count": len(long_pauses),
        "longest_pause_seconds": round(longest_pause, 2),
        "pause_timeline": pauses,
        "speech_rate_timeline": audio.speech_rate_timeline,
        "filler_word_count": filler_count,
        "sentence_complexity_delta": round(complexity_delta, 2),
        "answer_structure_score": round(structure_score, 2),
        "mid_answer_shift_score": round(mid_answer_shift_score, 2),
        "llm_consistency_score": round(llm_score, 2),
        "overall_risk_score": overall_score,
        "risk_level": risk_level,
        "signals": _dedupe(signals) or ["No strong voice-flow risk signals detected."],
        "llm_review": llm_review,
    }


def aggregate_voice_flow_for_assignment(assignment: CandidateAIAssessment) -> dict[str, Any]:
    analyses = list(assignment.voice_analyses.all().order_by("question_number"))
    if not analyses:
        summary = {
            "risk_score": 0,
            "risk_level": "low",
            "average_risk_score": 0,
            "max_risk_score": 0,
            "counts": {"low": 0, "medium": 0, "high": 0},
            "flagged_questions": [],
            "updated_at": timezone.now().isoformat(),
        }
    else:
        scores = [a.overall_risk_score for a in analyses]
        counts = {
            "low": sum(1 for a in analyses if a.risk_level == "low"),
            "medium": sum(1 for a in analyses if a.risk_level == "medium"),
            "high": sum(1 for a in analyses if a.risk_level == "high"),
        }
        max_score = max(scores)
        summary = {
            "risk_score": round(max_score, 1),
            "risk_level": risk_level_for_score(max_score),
            "average_risk_score": round(statistics.mean(scores), 1),
            "max_risk_score": round(max_score, 1),
            "counts": counts,
            "flagged_questions": [
                a.question_number for a in analyses if a.risk_level in {"medium", "high"}
            ],
            "updated_at": timezone.now().isoformat(),
        }

    assignment.voice_flow_analysis = summary
    assignment.voice_flow_risk_score = summary["risk_score"]
    assignment.voice_flow_risk_level = summary["risk_level"]
    assignment.save(
        update_fields=[
            "voice_flow_analysis",
            "voice_flow_risk_score",
            "voice_flow_risk_level",
        ]
    )
    return summary


def append_voice_flow_alert(assignment: CandidateAIAssessment, analysis: AIVoiceAnalysis) -> None:
    alerts = list(assignment.cheating_alerts or [])
    alert_id = f"voice_flow_ai_assistance_q{analysis.question_number}"
    if any(alert.get("id") == alert_id for alert in alerts):
        return

    alerts.append(
        {
            "id": alert_id,
            "type": "voice_flow_ai_assistance",
            "severity": "high",
            "message": (
                f"Potential AI assistance risk detected from voice flow on "
                f"question {analysis.question_number}."
            ),
            "timestamp": timezone.now().isoformat(),
            "question_number": analysis.question_number,
            "risk_score": analysis.overall_risk_score,
            "risk_level": analysis.risk_level,
            "signals": analysis.signals[:5],
            "screenshot_url": None,
        }
    )
    assignment.cheating_alerts = alerts
    assignment.total_proctor_warnings += 1
    assignment.save(update_fields=["cheating_alerts", "total_proctor_warnings"])


def remove_voice_flow_alert(assignment: CandidateAIAssessment, question_number: int) -> None:
    alerts = list(assignment.cheating_alerts or [])
    alert_id = f"voice_flow_ai_assistance_q{question_number}"
    filtered = [alert for alert in alerts if alert.get("id") != alert_id]
    if len(filtered) == len(alerts):
        return
    assignment.cheating_alerts = filtered
    assignment.total_proctor_warnings = max(0, assignment.total_proctor_warnings - 1)
    assignment.save(update_fields=["cheating_alerts", "total_proctor_warnings"])


def risk_level_for_score(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 45:
        return "medium"
    return "low"


def voice_analysis_summary(analysis: AIVoiceAnalysis | None) -> dict[str, Any] | None:
    if not analysis:
        return None
    return {
        "risk_score": round(analysis.overall_risk_score, 1),
        "risk_level": analysis.risk_level,
        "signals": analysis.signals or [],
        "audio_duration_seconds": analysis.audio_duration_seconds,
        "speech_rate_wpm": analysis.speech_rate_wpm,
        "pause_count": analysis.pause_count,
        "long_pause_count": analysis.long_pause_count,
        "longest_pause_seconds": analysis.longest_pause_seconds,
        "filler_word_count": analysis.filler_word_count,
        "sentence_complexity_delta": analysis.sentence_complexity_delta,
        "answer_structure_score": analysis.answer_structure_score,
        "mid_answer_shift_score": analysis.mid_answer_shift_score,
        "llm_consistency_score": analysis.llm_consistency_score,
        "llm_review": analysis.llm_review or {},
    }


def _extract_audio_metrics(audio_file_path: str, word_count: int) -> AudioMetrics:
    try:
        from pydub import AudioSegment
        from pydub.silence import detect_silence

        audio = AudioSegment.from_file(audio_file_path)
        duration_seconds = len(audio) / 1000
        silence_threshold = max(audio.dBFS - 16, -45)
        raw_pauses = detect_silence(
            audio,
            min_silence_len=int(SILENCE_MIN_SECONDS * 1000),
            silence_thresh=silence_threshold,
        )
        pause_timeline = [
            {
                "start_seconds": round(start / 1000, 2),
                "end_seconds": round(end / 1000, 2),
                "duration_seconds": round((end - start) / 1000, 2),
            }
            for start, end in raw_pauses
        ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("pydub voice metrics failed, falling back to ffprobe: %s", exc)
        duration_seconds = _ffprobe_duration(audio_file_path)
        pause_timeline = []

    return AudioMetrics(
        duration_seconds=max(duration_seconds, 0),
        pause_timeline=pause_timeline,
        speech_rate_timeline=_speech_rate_timeline(
            duration_seconds=max(duration_seconds, 0),
            word_count=word_count,
            pauses=pause_timeline,
        ),
    )


def _ffprobe_duration(audio_file_path: str) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                audio_file_path,
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        return float((result.stdout or "0").strip() or 0)
    except Exception:  # noqa: BLE001
        return 0


def _speech_rate_timeline(
    *, duration_seconds: float, word_count: int, pauses: list[dict[str, float]]
) -> list[dict[str, float]]:
    if duration_seconds <= 0 or word_count <= 0:
        return []
    minute_rate = (word_count / duration_seconds) * 60
    timeline = [{"start_seconds": 0, "end_seconds": round(duration_seconds, 2), "wpm": round(minute_rate, 2)}]
    if pauses:
        for pause in pauses[:5]:
            timeline.append(
                {
                    "start_seconds": pause["end_seconds"],
                    "end_seconds": round(min(duration_seconds, pause["end_seconds"] + 20), 2),
                    "wpm": round(minute_rate * (1.15 if pause["duration_seconds"] >= LONG_PAUSE_SECONDS else 1), 2),
                }
            )
    return timeline


def _llm_review_if_useful(
    *, heuristic_score: float, question_text: str, transcript: str, metrics: dict[str, Any]
) -> dict[str, Any]:
    if heuristic_score < 35 or len(_words(transcript)) < 45:
        return {}

    try:
        client = get_gemini_client()
        if not client.configured:
            return {}

        prompt = f"""
You are reviewing an interview answer for possible AI-assisted reading.
Return strict JSON only. Do not call the candidate a cheater.

Question: {question_text}
Transcript: {transcript[:4000]}
Voice metrics JSON: {json.dumps(metrics)}

Return:
{{
  "risk_score": 0-100,
  "risk_level": "low" | "medium" | "high",
  "reasoning": "short reviewer-facing explanation",
  "evidence": ["specific evidence"],
  "recommended_reviewer_action": "short action"
}}
"""
        response = client.model.generate_content(prompt)
        text = (getattr(response, "text", "") or "").strip()
        payload = _parse_json_object(text)
        risk_score = max(0, min(100, float(payload.get("risk_score") or 0)))
        return {
            "risk_score": risk_score,
            "risk_level": payload.get("risk_level") or risk_level_for_score(risk_score),
            "reasoning": str(payload.get("reasoning") or "")[:800],
            "evidence": payload.get("evidence") if isinstance(payload.get("evidence"), list) else [],
            "recommended_reviewer_action": str(payload.get("recommended_reviewer_action") or "")[:400],
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Voice-flow LLM review failed: %s", exc)
        return {}


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.IGNORECASE | re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            return json.loads(match.group(0))
    return {}


def _heuristic_score(**kwargs: Any) -> tuple[float, list[str]]:
    score = 0.0
    signals: list[str] = []

    if kwargs["longest_pause"] >= SUSPICIOUS_PAUSE_SECONDS and kwargs["after_words"] >= 25:
        score += 30
        signals.append("Long mid-answer pause followed by substantial continuation.")
    elif kwargs["longest_pause"] >= LONG_PAUSE_SECONDS and kwargs["after_words"] >= 20:
        score += 18
        signals.append("Long pause followed by continued answer delivery.")

    if kwargs["long_pause_count"] >= 2:
        score += 12
        signals.append("Multiple long pauses detected during the answer.")

    if kwargs["after_filler_rate"] + 0.04 < kwargs["before_filler_rate"] and kwargs["after_words"] >= 25:
        score += 14
        signals.append("Filler-word rate drops after the main pause.")

    if kwargs["complexity_delta"] >= 4:
        score += 15
        signals.append("Transcript shifts toward more complex sentence structure after the pause.")

    if kwargs["structure_score"] >= 35:
        score += 14
        signals.append("Continuation contains unusually structured or polished phrasing.")

    if kwargs["mid_answer_shift_score"] >= 50:
        score += 18
        signals.append("Answer shifts from hesitant flow to polished continuation.")

    if kwargs["speech_rate"] >= 185 and kwargs["word_count"] >= 70:
        score += 8
        signals.append("High sustained speaking rate for a long answer.")

    if kwargs["word_count"] < 35:
        score = min(score, 35)

    return round(min(score, 100), 1), signals


def _mid_answer_shift_score(
    *,
    longest_pause: float,
    before_words: int,
    after_words: int,
    before_filler_rate: float,
    after_filler_rate: float,
    complexity_delta: float,
    structure_score: float,
) -> float:
    score = 0
    if longest_pause >= LONG_PAUSE_SECONDS:
        score += min(35, longest_pause * 5)
    if after_words >= max(25, before_words):
        score += 18
    if after_filler_rate + 0.04 < before_filler_rate:
        score += 14
    if complexity_delta > 0:
        score += min(18, complexity_delta * 3)
    score += min(15, structure_score * 0.3)
    return min(score, 100)


def _structure_score(text: str) -> float:
    lower = text.lower()
    marker_count = sum(1 for marker in STRUCTURE_MARKERS if marker in lower)
    list_count = len(re.findall(r"\b(?:one|two|three|firstly|secondly|thirdly)\b|(?:^|\s)\d+[.)]", lower))
    return min(100, (marker_count * 10) + (list_count * 12))


def _sentence_complexity(text: str) -> float:
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    if not sentences:
        return 0
    words_per_sentence = [len(_words(sentence)) for sentence in sentences]
    avg_words = statistics.mean(words_per_sentence) if words_per_sentence else 0
    connector_count = len(re.findall(r"\b(because|therefore|however|although|moreover|whereas|while)\b", text.lower()))
    return avg_words + connector_count


def _largest_pause_split_ratio(pauses: list[dict[str, float]], duration_seconds: float) -> float:
    if not pauses or duration_seconds <= 0:
        return 0.5
    pause = max(pauses, key=lambda item: item["duration_seconds"])
    midpoint = (pause["start_seconds"] + pause["end_seconds"]) / 2
    return max(0.15, min(0.85, midpoint / duration_seconds))


def _split_words(words: list[str], ratio: float) -> tuple[list[str], list[str]]:
    split_at = max(1, min(len(words) - 1, int(math.floor(len(words) * ratio))))
    return words[:split_at], words[split_at:]


def _count_fillers(text: str) -> int:
    lower = text.lower()
    return sum(len(re.findall(rf"\b{re.escape(word)}\b", lower)) for word in FILLER_WORDS)


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9']+", text or "")


def _safe_rate(count: int, total: int) -> float:
    return count / total if total else 0


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            result.append(item.strip())
    return result


def _low_result(signal: str, transcript_word_count: int = 0) -> dict[str, Any]:
    return {
        "audio_duration_seconds": 0,
        "transcript_word_count": transcript_word_count,
        "speech_rate_wpm": 0,
        "pause_count": 0,
        "long_pause_count": 0,
        "longest_pause_seconds": 0,
        "pause_timeline": [],
        "speech_rate_timeline": [],
        "filler_word_count": 0,
        "sentence_complexity_delta": 0,
        "answer_structure_score": 0,
        "mid_answer_shift_score": 0,
        "llm_consistency_score": 0,
        "overall_risk_score": 0,
        "risk_level": "low",
        "signals": [signal],
        "llm_review": {},
    }
