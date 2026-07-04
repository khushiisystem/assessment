"""S3 handoff helpers for the standalone Celery worker.

The worker must not read or write the Django database.  Django owns DB state,
packages the data Celery needs into S3, and later consumes Celery's S3 result.
"""
from __future__ import annotations

from contextlib import contextmanager

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlparse
from django.db import transaction
import boto3
from botocore.config import Config
from django.conf import settings
from django.utils import timezone as django_timezone
from organization.context import clear_tenant_context, set_tenant_context

from AI_assessment.models import AIInterviewResponse, CandidateAIAssessment

@contextmanager
def celery_system_context():
    set_tenant_context(None, is_super_admin=True)
    try:
        yield
    finally:
        clear_tenant_context()


def _to_int(value):
    if value in (None, ""):
        return None
    return int(value)
    
logger = logging.getLogger(__name__)

CELERY_OP_PREFIX = "celery_op"


def _safe_folder(value: str, fallback: str, *, allow_email: bool = False) -> str:
    text = (value or fallback or "candidate").strip().lower()
    if allow_email:
        text = re.sub(r"[^a-z0-9._@+-]+", "-", text)
        text = re.sub(r"-+", "-", text).strip("-._")
        return text or fallback
    text = re.sub(r"[^a-z0-9._-]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-._")
    return text or fallback


def get_s3_bucket() -> str:
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "") or ""
    if not bucket:
        raise RuntimeError("AWS_STORAGE_BUCKET_NAME is required for Celery S3 handoff.")
    return bucket


def get_s3_client():
    """Create an S3 client with the same signing settings everywhere."""
    kwargs: Dict[str, Any] = {
        "aws_access_key_id": getattr(settings, "AWS_ACCESS_KEY_ID", None),
        "aws_secret_access_key": getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
        "region_name": getattr(settings, "AWS_S3_REGION_NAME", None) or "us-east-1",
        "config": Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    }
    endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("s3", **kwargs)


def build_key(*parts: Any) -> str:
    return "/".join(str(part).strip("/") for part in parts if part not in (None, ""))


def public_s3_url(key: str) -> str:
    bucket = get_s3_bucket()
    region = getattr(settings, "AWS_S3_REGION_NAME", None) or "us-east-1"
    if region == "us-east-1":
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def put_json(key: str, payload: Dict[str, Any]) -> Dict[str, str]:
    bucket = get_s3_bucket()
    get_s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, default=str, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return {"bucket": bucket, "key": key, "url": public_s3_url(key)}


def put_file(key: str, file_field, content_type: str = "application/octet-stream") -> Dict[str, str]:
    bucket = get_s3_bucket()
    with file_field.open("rb") as handle:
        get_s3_client().upload_fileobj(
            handle,
            bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    return {"bucket": bucket, "key": key, "url": public_s3_url(key)}


def get_json(key: str) -> Dict[str, Any]:
    obj = get_s3_client().get_object(Bucket=get_s3_bucket(), Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))


def s3_key_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        return parsed.path.lstrip("/") or None
    return url.strip("/") or None


def _file_ref(
    file_field,
    *,
    handoff_key: Optional[str] = None,
    content_type: str = "application/octet-stream",
) -> Dict[str, Optional[str]]:
    if not file_field:
        return {"url": None, "key": None, "name": None}
    try:
        url = file_field.url
    except Exception:  # noqa: BLE001
        url = None
    name = getattr(file_field, "name", None)
    key = s3_key_from_url(url) or name

    logger.info(f"_file_ref  start before :{handoff_key} ********")

    # If storage returns a local/media URL, Celery on another server cannot read it.
    # Copy it into the S3 handoff area and pass that real S3 key instead.
    if handoff_key and (not url or url.startswith("/") or key == name):
        logger.info("FIle started copying from local to s3***************")
        logger.info("Copying file %s to S3 handoff key %s", name, handoff_key)
        try:
            logger.info(f"_file_ref  start :{handoff_key} ********")
            uploaded = put_file(handoff_key, file_field, content_type=content_type)
            logger.info(f"_file_ref  start :{handoff_key} ********")
            return {"url": uploaded["url"], "key": uploaded["key"], "name": name}
        except Exception:  # noqa: BLE001
            logger.exception("Failed to copy %s to S3 handoff key %s", name, handoff_key)
            # Return name as the key so Celery can find it at the correct S3 path.
            return {"url": url, "key": name, "name": name}

    return {"url": url, "key": key, "name": name}


def _question_id(response: AIInterviewResponse, question_data: Any) -> str:
    if getattr(response, "coding_question_id", None):
        return str(response.coding_question_id)
    if isinstance(question_data, dict):
        for key in ("id", "question_id", "coding_question_id"):
            if question_data.get(key) not in (None, ""):
                return str(question_data[key])
    return str(response.question_number)


def build_assessment_handoff(assignment: CandidateAIAssessment) -> Dict[str, Any]:
    logger.info("build_assessment_handoff Start ********")
    # Write the assessment input manifest to S3 and return the Celery payload.
    questions = list(assignment.generated_questions or [])
    responses = AIInterviewResponse.objects.filter(
        candidate_assessment=assignment
    ).order_by("question_number")
    logger.info("build_assessment_handoff AIInterviewResponse end ********")

    candidate_name = assignment.candidate.get_full_name() or assignment.candidate.username or assignment.candidate.email
    logger.info("build_assessment_handoff assignment end ********")
    candidate_folder = _safe_folder(
        assignment.candidate.email,
        f"candidate-{assignment.candidate_id}",
        allow_email=True,
    )
    candidate_prefix = build_key(candidate_folder, CELERY_OP_PREFIX)
    assignment_prefix = build_key(candidate_prefix, "assignments", assignment.id)
    question_payloads = []
    for response in responses:
        logger.info(f"response for loop ******** q{response.question_number}.webm")

        index = response.question_number - 1
        question_data = questions[index] if 0 <= index < len(questions) else {}
        audio_ref = _file_ref(
            response.audio_recording,
            handoff_key=build_key(
                assignment_prefix,
                "input",
                "audio",
                f"q{response.question_number}.webm",
            ),
            content_type="audio/webm",
        )
        # question_payloads.append(
        #     {
        #         "candidate_id": assignment.candidate_id,
        #         "assignment_id": assignment.id,
        #         "ai_assessment_id": assignment.ai_assessment_id,
        #         "candidate_folder": candidate_folder,
        #         "question_id": _question_id(response, question_data),
        #         "question_number": response.question_number,
        #         "question_text": response.question_text,
        #         "question_type": response.question_type,
        #         "answer_text": response.answer_text,
        #         "code_answer": response.code_answer,
        #         "code_language": response.code_language,
        #         "code_execution_results": response.code_execution_results,
        #         "code_marks_earned": response.code_marks_earned,
        #         "code_marks_total": response.code_marks_total,
        #         "audio": audio_ref,
        #     }
        # ------- Adding new payload ----------------
        logger.info("New payload build**********************")
        question_payloads.append(
            {
                # Audit / identity fields (from upstream)
                "candidate_id": assignment.candidate_id,
                "assignment_id": assignment.id,
                "ai_assessment_id": assignment.ai_assessment_id,
                "candidate_folder": candidate_folder,
                # Question metadata
                "question_id": _question_id(response, question_data),
                "question_number": response.question_number,
                "question_text": response.question_text,
                "question_type": response.question_type,
                # Candidate's response — answer_text was missing from the
                # upstream snippet so subjective / voice-transcript
                # answers never reached the scoring worker.
                "answer_text": response.answer_text,
                # Coding response (kept from both branches)
                "code_answer": response.code_answer,
                "code_language": response.code_language,
                "code_execution_results": response.code_execution_results,
                "code_marks_earned": response.code_marks_earned,
                "code_marks_total": response.code_marks_total,
                "audio": audio_ref,
            }
        )
    
    payload = {
        "candidate_id": assignment.candidate_id,
        "assignment_id": assignment.id,
        "ai_assessment_id": assignment.ai_assessment_id,
        "candidate_folder": candidate_folder,
        "questions": question_payloads,
    }
        
    
    logger.info("FOR looppp build_assessment_handoff assignment end ********")

    input_key = build_key(
        assignment_prefix,
        "input",
        "assessment_payload.json",
    )
    output_prefix = build_key(
        assignment_prefix,
        "results",
    )
    input_payload = {
        "schema_version": "2026-05-19",
        "created_at": datetime.now(timezone.utc).isoformat(),
        #"candidate_id": assignment.candidate_id,
        "candidate_name": candidate_name,
        "candidate_email": assignment.candidate.email,
        "candidate_folder": candidate_folder,
        "candidate_prefix": candidate_prefix,
        #"assignment_id": assignment.id,
        #"ai_assessment_id": assignment.ai_assessment_id,
        "resume_text": assignment.resume_text,
        "generated_questions": assignment.generated_questions,
        #---------- Not neede anymore -----------------

        # "assessment": {
        #     "title": assignment.ai_assessment.title,
        #     "role_type": assignment.ai_assessment.role_type,
        #     "experience_level": assignment.ai_assessment.experience_level,
        #     "num_questions": assignment.ai_assessment.num_questions,
        # },
        # "media": {
        #     "introduction_video": {
        #         "url": assignment.introduction_video_url,
        #         "key": s3_key_from_url(assignment.introduction_video_url),
        #         "file": _file_ref(
        #             assignment.introduction_video,
        #             handoff_key=build_key(assignment_prefix, "input", "media", "introduction.webm"),
        #             content_type="video/webm",
        #         ),
        #     },
        #     "interview_video": {
        #         "url": assignment.interview_video_url or assignment.assessment_video_url,
        #         "key": s3_key_from_url(assignment.interview_video_url or assignment.assessment_video_url),
        #         "file": _file_ref(
        #             assignment.interview_video,
        #             handoff_key=build_key(assignment_prefix, "input", "media", "interview.webm"),
        #             content_type="video/webm",
        #         ),
        #     },
        # },
        # "analysis": {
        #     "gesture_analysis": assignment.gesture_analysis,
        #     "communication_metrics": assignment.communication_metrics,
        #     "communication_score": assignment.communication_score,
        # },
        "payload": payload,
        "output_prefix": output_prefix,
    }
    input_s3 = put_json(input_key, input_payload)
    logger.info("build_assessment_handoff End ********")
    return {
        "candidate_id": assignment.candidate_id,
        #"candidate_name": candidate_name,
        "candidate_email": assignment.candidate.email,
        "candidate_folder": candidate_folder,
        "candidate_prefix": candidate_prefix,
        "assignment_id": assignment.id,
        "ai_assessment_id": assignment.ai_assessment_id,
        "input_s3": input_s3,
        "input_s3_key": input_s3["key"],
        "output_prefix": output_prefix,
    }


def extract_result_key(callback_payload: Dict[str, Any]) -> Optional[str]:
    """Find the S3 result key from either generic-executor or task result data."""
    for key in ("result_s3_key", "output_s3_key", "s3_key"):
        if callback_payload.get(key):
            return callback_payload[key]

    result = callback_payload.get("result")
    if isinstance(result, dict):
        for key in ("result_s3_key", "output_s3_key", "s3_key"):
            if result.get(key):
                return result[key]
        output = result.get("output_s3")
        if isinstance(output, dict) and output.get("key"):
            return output["key"]

    return None


def apply_celery_result(result_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Apply Celery's S3 result to Django-owned DB state."""
    result = result_payload.get("result") if "result" in result_payload else result_payload
    if not isinstance(result, dict):
        return {"updated_responses": 0, "report_updated": False}

    assignment_id = _to_int(result.get("assignment_id") or result_payload.get("assignment_id"))
    ai_assessment_id = _to_int(result.get("ai_assessment_id") or result_payload.get("ai_assessment_id"))
    candidate_id = _to_int(result.get("candidate_id") or result_payload.get("candidate_id"))

    if not assignment_id:
        return {"updated_responses": 0, "report_updated": False}

    with celery_system_context(), transaction.atomic():
        assignment = (
            CandidateAIAssessment.objects
            .all_for_super_admin()
            .select_for_update()
            .select_related("candidate", "ai_assessment")
            .get(id=assignment_id)
        )

        if ai_assessment_id and assignment.ai_assessment_id != ai_assessment_id:
            raise ValueError(
                f"Celery result ai_assessment_id mismatch: got {ai_assessment_id}, expected {assignment.ai_assessment_id}"
            )

        if candidate_id and assignment.candidate_id != candidate_id:
            raise ValueError(
                f"Celery result candidate_id mismatch: got {candidate_id}, expected {assignment.candidate_id}"
            )

        updated = 0
        logger.info("Applying Celery result for assignment %s", assignment_id)

        responses = result.get("responses") or result.get("question_results") or []
        for item in responses:
            if not isinstance(item, dict):
                continue

            question_number = item.get("question_number")
            transcript = item.get("transcript") or item.get("answer_text")
            if question_number is None or transcript in (None, ""):
                continue

            response = (
                AIInterviewResponse.objects
                .all_for_super_admin()
                .filter(
                    candidate_assessment=assignment,
                    question_number=question_number,
                )
                .first()
            )

            if not response:
                continue

            if response.answer_text != transcript:
                response.answer_text = transcript
                response.save(update_fields=["answer_text", "responded_at"])
                updated += 1

        ai_feedback = result.get("ai_feedback")
        report_updated = False
        was_completed = assignment.status == "completed"

        if ai_feedback:
            logger.info(
                "Applying Celery AI feedback for assignment %s: feedback_chars=%s",
                assignment_id,
                len(ai_feedback),
            )
            assignment.status = "completed"
            assignment.end_time = django_timezone.now()
            assignment.ai_feedback = ai_feedback
            assignment.calculate_scores_from_feedback(ai_feedback)
            report_updated = True

            if not was_completed:
                try:
                    from AI_assessment.tasks import send_completion_emails_async

                    send_completion_emails_async(assignment.id, assignment.ai_assessment.id)
                except Exception:
                    logger.exception("Failed to send completion emails for assignment %s", assignment_id)

        logger.info(
            "Applied Celery S3 result for assignment %s: updated_responses=%s report_updated=%s",
            assignment_id,
            updated,
            report_updated,
        )
        return {"updated_responses": updated, "report_updated": report_updated}
