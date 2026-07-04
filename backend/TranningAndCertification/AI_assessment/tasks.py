"""
Background tasks for AI Assessment - handles long-running operations asynchronously
"""
import threading
import time
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging
from django.conf import settings
from .models import CandidateAIAssessment, AIInterviewResponse
from .ai_utils import get_gemini_client
logger = logging.getLogger(__name__)


def _question_source_counts(questions):
    counts = {}
    for question in questions or []:
        source = question.get('source', 'unknown') if isinstance(question, dict) else 'legacy'
        counts[source] = counts.get(source, 0) + 1
    return counts


def generate_feedback_async(candidate_ai_id):
    """Generate AI feedback asynchronously in a background thread"""
    try:
        candidate_ai = CandidateAIAssessment.objects.get(id=candidate_ai_id)

        # Idempotency guard — if a feedback run has already populated the
        # canonical scores, don't burn another LLM call. Without this a
        # double-submit (UI retry, page reload, manual admin trigger) made
        # the candidate wait again and consumed quota.
        if (candidate_ai.ai_feedback and
                candidate_ai.overall_score and candidate_ai.overall_score > 0):
            logger.info(
                "[ASYNC] Feedback already generated, skipping: candidate_ai_id=%s overall_score=%s",
                candidate_ai_id, candidate_ai.overall_score,
            )
            return

        logger.info("[ASYNC] Starting feedback generation for assessment %s", candidate_ai_id)

        responses = AIInterviewResponse.objects.filter(
            candidate_assessment=candidate_ai
        ).order_by('question_number')
        answered_responses = responses.exclude(answer_text__isnull=True).exclude(answer_text='')

        if answered_responses.exists():
            gemini_client = get_gemini_client()
            # OPT: drop the test_connection() round-trip (extra LLM call,
            # ~2-5s). If the actual provide_feedback() call fails we already
            # fall through to the warning branch below.
            if gemini_client.configured:
                questions = [r.question_text for r in answered_responses]
                answers = [r.answer_text for r in answered_responses]
                question_numbers = [r.question_number for r in answered_responses]
                total_questions = len(candidate_ai.generated_questions or [])
                if not total_questions:
                    total_questions = candidate_ai.ai_assessment.num_questions
                attempted_count = answered_responses.count()
                unanswered_count = max(total_questions - attempted_count, 0) if total_questions else 0
                coverage_percent = round((attempted_count / total_questions) * 100) if total_questions else 0
                experience_level = candidate_ai.ai_assessment.get_experience_level_display()
                
                # Enhanced assessment context with proper formatting
                assessment_context = (
                    f"\n\nAssessment context:\n"
                    f"Total interview questions: {total_questions}\n"
                    f"Questions answered by the candidate: {attempted_count}\n"
                    f"Unanswered questions: {unanswered_count}\n"
                    f"Approximate question coverage: {coverage_percent}% of the assessment\n"
                    f"Experience level for this assessment: {experience_level}"
                )

                feedback = ""
                max_attempts = 3
                retry_delays = [1, 3]
                for attempt in range(1, max_attempts + 1):
                    try:
                        logger.info(
                            "[ASYNC] Generating Gemini feedback attempt %s/%s for candidate_ai_id=%s",
                            attempt,
                            max_attempts,
                            candidate_ai_id,
                        )
                        feedback = gemini_client.provide_feedback(
                            questions=questions,
                            answers=answers,
                            resume_text=f"{candidate_ai.resume_text}{assessment_context}",
                            gesture_analysis=candidate_ai.gesture_analysis,
                            question_numbers=question_numbers
                        )
                        if feedback:
                            break
                        logger.warning(
                            "[ASYNC] Gemini returned empty feedback on attempt %s/%s for candidate_ai_id=%s",
                            attempt,
                            max_attempts,
                            candidate_ai_id,
                        )
                    except Exception:
                        logger.exception(
                            "[ASYNC] Gemini feedback attempt %s/%s failed for candidate_ai_id=%s",
                            attempt,
                            max_attempts,
                            candidate_ai_id,
                        )
                    if attempt < max_attempts:
                        time.sleep(retry_delays[min(attempt - 1, len(retry_delays) - 1)])
                
                if feedback:
                    logger.info("[ASYNC] AI Feedback generated - %d characters", len(feedback))
                    candidate_ai.ai_feedback = feedback
                    candidate_ai.calculate_scores_from_feedback(feedback)
                    # Surface silent extraction failures. The regex parser in
                    # calculate_scores_from_feedback assumes the LLM emitted
                    # `Rating: N/10` and `**Technical Competency**:` markers
                    # exactly; when Gemini drifts those formats we end up
                    # with all-zero scores AND no logged reason. Dump a
                    # 600-char preview so we can debug from the worker log.
                    if (candidate_ai.overall_score or 0) == 0:
                        logger.warning(
                            "[ASYNC] Scores extracted as 0 — likely LLM format drift. "
                            "raw_feedback_preview=%r",
                            (feedback or "")[:600],
                        )
                    else:
                        logger.info(
                            "[ASYNC] Scores calculated: overall=%s technical=%s communication=%s problem_solving=%s",
                            candidate_ai.overall_score,
                            candidate_ai.technical_score,
                            candidate_ai.communication_score,
                            candidate_ai.problem_solving_score,
                        )
                else:
                    logger.warning("[ASYNC] No feedback generated after retries, using default message")
                    candidate_ai.ai_feedback = "Assessment completed successfully. Detailed feedback will be available soon."
                    candidate_ai.save(update_fields=['ai_feedback'])
            else:
                logger.warning("[ASYNC] Gemini connection failed")
                candidate_ai.ai_feedback = "Assessment completed successfully. AI feedback is currently unavailable."
                candidate_ai.save(update_fields=['ai_feedback'])
        else:
            candidate_ai.ai_feedback = "Assessment completed. No responses found for feedback generation."
            candidate_ai.save(update_fields=['ai_feedback'])
            
    except Exception as e:
        logger.exception(" [ASYNC] Error in feedback generation")
        try:
            logger.info("Attempting to save default feedback message for candidate_ai_id %s", candidate_ai_id)
            candidate_ai = CandidateAIAssessment.objects.get(id=candidate_ai_id)
            candidate_ai.ai_feedback = "Assessment completed successfully. Feedback generation encountered an issue."
            candidate_ai.save(update_fields=['ai_feedback'])
        except Exception:
            logger.exception(" [ASYNC] Error occurred while saving default feedback message")
            pass


def send_completion_emails_async(candidate_ai_id, ai_assessment_id):
    """Send completion emails asynchronously in a background thread"""
    try:
        candidate_ai = CandidateAIAssessment.objects.get(id=candidate_ai_id)
        
        logger.info("[ASYNC] Sending completion emails for assessment %s", candidate_ai_id)
        
        candidate_email = (candidate_ai.candidate.email or "").strip()
        cc_recipients = []
        if candidate_email.lower().endswith('@zecdata.com'):
            cc_recipients = ['abhishek@zecdata.com', 'prashant.t@zecdata.com']

        # Email to Candidate
        candidate_context = {
            'candidate_name': candidate_ai.candidate.get_full_name() or candidate_ai.candidate.username,
            'assessment_title': candidate_ai.ai_assessment.title,
            'overall_score': candidate_ai.overall_score,
            'technical_score': candidate_ai.technical_score,
            'communication_score': candidate_ai.communication_score,
            'problem_solving_score': candidate_ai.problem_solving_score,
            'result_url': f"{settings.SITE_URL}/candidate/ai-assessment/{ai_assessment_id}/result"
        }
        
        candidate_subject = f'AI Interview Completed - {candidate_ai.ai_assessment.title}'
        candidate_html = render_to_string('emails/ai_assessment_completed_candidate.html', candidate_context)
        candidate_plain = strip_tags(candidate_html)

        candidate_email_message = EmailMultiAlternatives(
            subject=candidate_subject,
            body=candidate_plain,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[candidate_ai.candidate.email],
        )
        candidate_email_message.attach_alternative(candidate_html, 'text/html')
        candidate_email_message.send(fail_silently=True)
        
        # Email to Admin (assigned_by)
        admin_context = {
            'admin_name': candidate_ai.assigned_by.get_full_name() or candidate_ai.assigned_by.username,
            'candidate_name': candidate_ai.candidate.get_full_name() or candidate_ai.candidate.username,
            'candidate_email': candidate_ai.candidate.email,
            'assessment_title': candidate_ai.ai_assessment.title,
            'overall_score': candidate_ai.overall_score,
            'technical_score': candidate_ai.technical_score,
            'communication_score': candidate_ai.communication_score,
            'problem_solving_score': candidate_ai.problem_solving_score,
            'completed_time': candidate_ai.end_time,
            'report_url': f"{settings.SITE_URL}/admin/result/ai-assessment/{ai_assessment_id}/report/{candidate_ai.id}",
        }
        
        admin_subject = f'AI Interview Completed - {candidate_ai.candidate.get_full_name()} - {candidate_ai.ai_assessment.title}'
        admin_html = render_to_string('emails/ai_assessment_completed_admin.html', admin_context)
        admin_plain = strip_tags(admin_html)

        admin_email_message = EmailMultiAlternatives(
            subject=admin_subject,
            body=admin_plain,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[candidate_ai.assigned_by.email],
            cc=cc_recipients or None,
        )
        admin_email_message.attach_alternative(admin_html, 'text/html')
        admin_email_message.send(fail_silently=True)
        
        logger.info("[ASYNC] Emails sent to %s and %s", candidate_ai.candidate.email, candidate_ai.assigned_by.email)
        
    except Exception as e:
        logger.exception("[ASYNC] Error sending emails")


# NOTE: start_async_feedback_and_emails() was removed - feedback generation is now synchronous
# Email sending is handled directly in views.py using threading.Thread


def generate_questions_async(candidate_ai_id):
    """
    Generate interview questions asynchronously in a background thread.
    This runs immediately after introduction video is submitted so questions
    are ready when assessment page loads.
    """
    try:
        logger.info("[ASYNC QUESTIONS] Starting question generation task for candidate_ai_id %s", candidate_ai_id)
        candidate_ai = CandidateAIAssessment.objects.all_for_super_admin().get(id=candidate_ai_id)
        ai = candidate_ai.ai_assessment
        effective_total = max(ai.num_questions, len(ai.hardcoded_question_ids or []))
        
        logger.info(
            "[ASYNC QUESTIONS] Starting question generation: assignment=%s assessment=%s candidate=%s effective_total=%s existing_count=%s status=%s",
            candidate_ai.id,
            ai.id,
            candidate_ai.candidate_id,
            effective_total,
            len(candidate_ai.generated_questions or []),
            candidate_ai.questions_generation_status,
        )
        
        # Update status to processing
        candidate_ai.questions_generation_status = 'processing'
        candidate_ai.save(update_fields=['questions_generation_status'])
        
        # Generate mixed questions (hardcoded + coding + LLM)
        if not candidate_ai.generated_questions or len(candidate_ai.generated_questions) < effective_total:
            from .ai_utils import get_mixed_questions
            
            try:
                logger.info("[ASYNC QUESTIONS] Generating questions for role: %s, experience level: %s", ai.get_role_type_display(), ai.get_experience_level_display())
                num_coding = getattr(ai, 'num_coding_questions', 0) or 0
                logger.info("[AI] Generating %s total questions...", ai.num_questions)
                logger.info("Hardcoded: %s", ai.num_hardcoded_questions)
                logger.info("Coding: %s", num_coding)
                logger.info("LLM: %s", ai.num_questions - ai.num_hardcoded_questions - num_coding)
                logger.info(
                    "[ASYNC QUESTIONS] Generation inputs: assignment=%s total=%s effective_total=%s hardcoded_ids=%s resume_chars=%s",
                    candidate_ai.id,
                    ai.num_questions,
                    effective_total,
                    len(ai.hardcoded_question_ids or []),
                    len(candidate_ai.resume_text or ""),
                )
                
                mixed_questions_data = get_mixed_questions(
                    role_type=ai.role_type,
                    experience_level=ai.experience_level,
                    total_questions=ai.num_questions,
                    num_hardcoded=ai.num_hardcoded_questions,
                    hardcoded_question_ids=ai.hardcoded_question_ids or [],
                    resume_text=candidate_ai.resume_text,
                    num_coding=num_coding,
                    tech_stack=", ".join(ai.tech_stack or []),
                    job_description=ai.description,
                )
                source_counts = _question_source_counts(mixed_questions_data)
                logger.info(
                    "[ASYNC QUESTIONS] get_mixed_questions returned: assignment=%s count=%s sources=%s",
                    candidate_ai.id,
                    len(mixed_questions_data or []),
                    source_counts,
                )
                
                if mixed_questions_data and len(mixed_questions_data) >= effective_total:
                    candidate_ai.generated_questions = mixed_questions_data
                    candidate_ai.questions_generation_status = 'completed'
                    candidate_ai.save(update_fields=['generated_questions', 'questions_generation_status'])
                    logger.info(
                        "[ASYNC QUESTIONS] Saved generated questions: assignment=%s count=%s status=%s sources=%s",
                        candidate_ai.id,
                        len(candidate_ai.generated_questions),
                        candidate_ai.questions_generation_status,
                        source_counts,
                    )
                else:
                    raise ValueError(
                        f"Insufficient questions generated: got {len(mixed_questions_data or [])}, needed {effective_total}"
                    )
                    
            except Exception as e:
                logger.exception(f"[ASYNC QUESTIONS] Error generating questions due to : {e}")
                # Safety net: ALWAYS preserve every admin-configured
                # hardcoded question, then top up with generic prompts
                # until we hit the configured num_questions count. This
                # honours the "X total, Y hardcoded, (X-Y) AI" contract
                # even when Gemini is down or partially failed — the
                # candidate sees Y hardcoded + (X-Y) generic instead of
                # 5 random generic prompts.
                role = ai.get_role_type_display()
                generic = [
                    {"text": f"Describe a challenging {role} problem you solved and the approach you took.", "type": "text", "source": "fallback"},
                    {"text": f"How would you design a scalable solution for a typical {role} task?", "type": "text", "source": "fallback"},
                    {"text": f"What are your strongest technical skills and how have you applied them in real projects?", "type": "text", "source": "fallback"},
                    {"text": f"Explain a time you optimized performance in a project. What was the impact?", "type": "text", "source": "fallback"},
                    {"text": f"What are your go-to debugging strategies when facing complex issues?", "type": "text", "source": "fallback"},
                    {"text": f"What are the most important best practices in your {role} work and why?", "type": "text", "source": "fallback"},
                    {"text": f"Walk me through a recent {role} project you're proud of, end to end.", "type": "text", "source": "fallback"},
                    {"text": "How do you approach learning a new technology or framework when you need it for a project?", "type": "text", "source": "fallback"},
                ]
                from .ai_utils import get_mixed_questions as _gmq
                hardcoded_only = []
                try:
                    hardcoded_only = _gmq(
                        role_type=ai.role_type,
                        experience_level=ai.experience_level,
                        total_questions=len(ai.hardcoded_question_ids or []),
                        num_hardcoded=ai.num_hardcoded_questions,
                        hardcoded_question_ids=ai.hardcoded_question_ids or [],
                        resume_text=candidate_ai.resume_text,
                        num_coding=0,
                    )
                except Exception:
                    logger.exception("[ASYNC QUESTIONS] Hardcoded re-pull failed during fallback")
                hardcoded_only = [q for q in (hardcoded_only or []) if q.get('source') == 'hardcoded']
                need = max(0, effective_total - len(hardcoded_only))
                topped_up = [generic[i % len(generic)] for i in range(need)]
                candidate_ai.generated_questions = (hardcoded_only + topped_up)[:effective_total]
                candidate_ai.questions_generation_status = 'completed'
                candidate_ai.save(update_fields=['generated_questions', 'questions_generation_status'])
                logger.warning(
                    "[ASYNC QUESTIONS] Saved fallback questions: assignment=%s count=%s status=%s sources=%s",
                    candidate_ai.id,
                    len(candidate_ai.generated_questions),
                    candidate_ai.questions_generation_status,
                    _question_source_counts(candidate_ai.generated_questions),
                )
        else:
            candidate_ai.questions_generation_status = 'completed'
            candidate_ai.save(update_fields=['questions_generation_status'])
    except Exception as exc:
        logger.exception(
            "[ASYNC QUESTIONS] Unexpected error in generate_questions_async for candidate_ai_id=%s",
            candidate_ai_id,
        )


# ==================== Celery Tasks from new_ai_assessment ====================

import os
import tempfile
import base64
from io import BytesIO
from celery import shared_task
from django.core.files.base import ContentFile
import boto3


def transcribe_pending_answer_recordings(assignment):
    """Transcribe all saved voice responses for an assignment."""
    # Get all responses that need transcription
    pending_responses = AIInterviewResponse.objects.filter(
        candidate_assessment=assignment,
        question_type="text",
        audio_recording__isnull=False,
    ).exclude(audio_recording="").filter(answer_text="")
    
    total_to_transcribe = pending_responses.count()
    logger.info(f"Found {total_to_transcribe} responses with audio that need transcription for assignment {assignment.id}")

    transcribed_count = 0
    failed_count = 0

    for response_obj in pending_responses.order_by("question_number"):
        temp_path = None
        try:
            logger.info(
                "Transcribing saved answer audio for assignment %s, question %s, audio_size=%s bytes",
                assignment.id,
                response_obj.question_number,
                response_obj.audio_recording.size if response_obj.audio_recording else 0,
            )

            with response_obj.audio_recording.open("rb") as audio_file:
                audio_data = audio_file.read()

            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name

            from .ai_utils import transcribe_audio
            transcript = transcribe_audio(temp_path, method="whisper")
            if transcript and transcript.strip():
                response_obj.answer_text = transcript
                response_obj.save(update_fields=["answer_text", "responded_at"])
                transcribed_count += 1
                logger.info(f"Successfully transcribed Q{response_obj.question_number}: {transcript[:100]}")
            else:
                failed_count += 1
                logger.warning(
                    "Transcription returned empty text for assignment %s, question %s",
                    assignment.id,
                    response_obj.question_number,
                )
        except Exception as exc:
            failed_count += 1
            logger.exception(
                "Failed to transcribe saved answer audio for assignment %s, question %s: %s",
                assignment.id,
                response_obj.question_number,
                exc,
            )
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    # Log a summary
    logger.info(f"Transcription complete for assignment {assignment.id}: {transcribed_count} succeeded, {failed_count} failed")
    return {"transcribed_count": transcribed_count, "failed_count": failed_count, "total": total_to_transcribe}


@shared_task
def process_intro_video_upload(assignment_id, video_data):
    """
    Process intro video upload in background
    """
    try:
        logger.info(f"Processing intro video upload for assignment {assignment_id}")
        assignment = CandidateAIAssessment.objects.get(id=assignment_id)

        format_info, encoded = video_data.split(";base64,")
        ext = format_info.split("/")[-1]
        video_content = base64.b64decode(encoded)
        video_file = ContentFile(video_content, name=f"intro_{assignment.id}.{ext}")

        video_url = None
        if getattr(settings, "USE_S3", False):
            from core.storage_utils import s3_handler
            video_url = s3_handler.upload_introduction_video(
                video_file, assignment.candidate.email, filename=f"intro_{assignment.id}.{ext}"
            )

        if video_url:
            assignment.introduction_video_url = video_url
        else:
            assignment.introduction_video = video_file

        assignment.save(update_fields=["introduction_video", "introduction_video_url"])
        logger.info(f"Intro video processed successfully for assignment {assignment_id}")

        return {"status": "success", "assignment_id": assignment_id}

    except Exception as exc:
        logger.exception(f"Failed to process intro video for assignment {assignment_id}: {exc}")
        return {"status": "error", "assignment_id": assignment_id, "error": str(exc)}


@shared_task
def process_answer_recording(assignment_id, question_number, audio_data, question_text="", question_type="text"):
    """
    Process answer recording upload in background
    """
    try:
        logger.info(f"Processing answer recording for assignment {assignment_id}, question {question_number}")
        assignment = CandidateAIAssessment.objects.get(id=assignment_id)
        if isinstance(audio_data, str):
            audio_data = base64.b64decode(audio_data)

        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name

        try:
            # Create or update response
            response_obj, created = AIInterviewResponse.objects.get_or_create(
                candidate_assessment=assignment,
                question_number=question_number,
                defaults={"question_text": question_text},
            )

            if question_text:
                response_obj.question_text = question_text
            response_obj.question_type = question_type

            # Transcribe audio
            from .ai_utils import transcribe_audio
            transcript = transcribe_audio(temp_path, method="whisper")
            if transcript:
                response_obj.answer_text = transcript
            else:
                logger.warning(f"Transcription failed for assignment {assignment_id}, question {question_number}")

            # Save audio recording
            audio_file = ContentFile(audio_data, name=f"ai_{assignment.id}_q{question_number}.webm")
            response_obj.audio_recording.save(audio_file.name, audio_file, save=False)

            # Set response time
            from django.utils import timezone
            if created and assignment.start_time:
                response_obj.response_time = int((timezone.now() - assignment.start_time).total_seconds())

            response_obj.save()

            logger.info(f"Answer recording processed successfully for assignment {assignment_id}, question {question_number}")
            return {
                "status": "success",
                "assignment_id": assignment_id,
                "question_number": question_number,
                "transcript": transcript
            }

        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    except Exception as exc:
        logger.exception(f"Failed to process answer recording for assignment {assignment_id}, question {question_number}: {exc}")
        return {
            "status": "error",
            "assignment_id": assignment_id,
            "question_number": question_number,
            "error": str(exc)
        }


@shared_task
def process_answer_transcription(assignment_id, question_number):
    """
    Process answer transcription in background (if needed separately)
    """
    try:
        logger.info(f"Processing transcription for assignment {assignment_id}, question {question_number}")
        assignment = CandidateAIAssessment.objects.get(id=assignment_id)

        response_obj = AIInterviewResponse.objects.filter(
            candidate_assessment=assignment,
            question_number=question_number
        ).first()

        if not response_obj or not response_obj.audio_recording:
            logger.warning(f"No audio recording found for assignment {assignment_id}, question {question_number}")
            return {"status": "no_audio", "assignment_id": assignment_id, "question_number": question_number}

        # Download audio from S3 if needed
        if response_obj.audio_recording_url:
            # Download from S3
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME,
            )
            s3_key = response_obj.audio_recording_url.split('amazonaws.com/')[-1]
            obj = s3_client.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=s3_key)
            audio_data = obj["Body"].read()
        else:
            # Read from local storage
            with response_obj.audio_recording.open('rb') as f:
                audio_data = f.read()

        # Save to temp file and transcribe
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name

        try:
            from .ai_utils import transcribe_audio
            transcript = transcribe_audio(temp_path, method="whisper")
            if transcript:
                response_obj.answer_text = transcript
                response_obj.save(update_fields=["answer_text"])
                logger.info(f"Transcription completed for assignment {assignment_id}, question {question_number}")
                return {
                    "status": "success",
                    "assignment_id": assignment_id,
                    "question_number": question_number,
                    "transcript": transcript
                }
            else:
                logger.warning(f"Transcription failed for assignment {assignment_id}, question {question_number}")
                return {
                    "status": "failed",
                    "assignment_id": assignment_id,
                    "question_number": question_number
                }
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    except Exception as exc:
        logger.exception(f"Failed to process transcription for assignment {assignment_id}, question {question_number}: {exc}")
        return {
            "status": "error",
            "assignment_id": assignment_id,
            "question_number": question_number,
            "error": str(exc)
        }


@shared_task
def process_video_upload(assignment_id, s3_url=None, video_data=None):
    """
    Process final interview video upload in background
    """
    try:
        logger.info(f"Processing video upload for assignment {assignment_id}")
        assignment = CandidateAIAssessment.objects.get(id=assignment_id)

        if s3_url:
            assignment.assessment_video_url = s3_url
            assignment.save(update_fields=["assessment_video_url"])
            logger.info(f"Video URL saved successfully for assignment {assignment_id}")
            return {"status": "success", "assignment_id": assignment_id, "video_url": s3_url}

        elif video_data:
            if isinstance(video_data, str):
                video_data = base64.b64decode(video_data)

            # Direct file upload
            video_url = None
            content_type = "video/webm"
            video_file = ContentFile(video_data, name=f"interview_{assignment.id}.webm")

            if getattr(settings, "USE_S3", False):
                try:
                    s3_client = boto3.client(
                        "s3",
                        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                        region_name=settings.AWS_S3_REGION_NAME,
                    )
                    file_key = f"{assignment.candidate.email}/interview_video/interview_{assignment.id}.webm"
                    s3_client.upload_fileobj(
                        BytesIO(video_data),
                        settings.AWS_STORAGE_BUCKET_NAME,
                        file_key,
                        ExtraArgs={"ContentType": content_type},
                    )
                    video_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"

                    # Remux video for better seeking
                    from .views import remux_webm_in_background
                    remux_webm_in_background(s3_client, settings.AWS_STORAGE_BUCKET_NAME, file_key)

                except Exception as exc:
                    logger.warning(f"S3 upload failed for interview video, using local storage: {exc}")
                    video_url = None

            if video_url:
                assignment.interview_video_url = video_url
                assignment.save(update_fields=["interview_video_url"])
            else:
                assignment.interview_video.save(video_file.name, video_file, save=True)
                video_url = assignment.interview_video.url

            logger.info(f"Video uploaded successfully for assignment {assignment_id}")
            return {"status": "success", "assignment_id": assignment_id, "video_url": video_url}

        else:
            return {"status": "error", "assignment_id": assignment_id, "error": "No video data or URL provided"}

    except Exception as exc:
        logger.exception(f"Failed to process video upload for assignment {assignment_id}: {exc}")
        return {"status": "error", "assignment_id": assignment_id, "error": str(exc)}
                
    except Exception as e:
        logger.exception(f"[ASYNC QUESTIONS] Error in question generation as {e}")
        try:
            logger.info("[ASYNC QUESTIONS] Setting questions_generation_status to 'failed' for candidate_ai_id %s", candidate_ai_id)
            candidate_ai = CandidateAIAssessment.objects.all_for_super_admin().get(id=candidate_ai_id)
            candidate_ai.questions_generation_status = 'failed'
            candidate_ai.save(update_fields=['questions_generation_status'])
        except Exception as e:
            logger.exception(f"[ASYNC QUESTIONS] Error occurred while setting generation status to 'failed' due to :{e}")
            raise e
