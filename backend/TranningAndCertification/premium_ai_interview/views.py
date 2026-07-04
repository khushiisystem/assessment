import json
import os
import re
import tempfile
from datetime import datetime

import boto3
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView


class PremiumAIThrottle(SimpleRateThrottle):
    """Per-IP rate limit (auth or not) for cost-bearing AI endpoints (rate set
    via REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['premium_ai'])."""
    scope = "premium_ai"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

try:
    from google.genai.errors import ClientError as GeminiClientError
except ImportError:
    GeminiClientError = Exception

from .langgraph_interview import start_session, submit_answer
from .models import AIInterviewSession


def _handle_gemini_error(exc):
    """Return a DRF Response for Gemini/Groq API errors, or None if not handled."""
    msg = str(exc)
    exc_type = type(exc).__name__
    if exc_type in ('ConnectError', 'ConnectTimeout', 'RemoteProtocolError') or \
            'getaddrinfo failed' in msg or 'ConnectError' in msg or \
            'connection' in msg.lower() and 'error' in msg.lower():
        return Response(
            {'error': 'Unable to reach the AI service. Please check your internet connection and try again.'},
            status=503,
        )
    if '429' in msg or 'RESOURCE_EXHAUSTED' in msg or 'quota' in msg.lower() or 'rate_limit' in msg.lower():
        import re as retry_re
        retry = retry_re.search(r'retry in ([\d.]+)s', msg)
        wait = f" Please retry in {retry.group(1)} seconds." if retry else ''
        return Response(
            {'error': f'AI quota exceeded - you have used all free-tier requests for today.{wait}'},
            status=429,
        )
    if '401' in msg or 'API_KEY' in msg or 'No API key' in msg or 'invalid_api_key' in msg.lower():
        return Response({'error': 'Invalid or missing AI API key.'}, status=500)
    return None


def _get_bucket_name():
    return getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None) or os.getenv('AWS_STORAGE_BUCKET_NAME')


def _get_region_name():
    return getattr(settings, 'AWS_S3_REGION_NAME', None) or os.getenv('AWS_S3_REGION_NAME', 'us-east-1')


def _get_s3_client(signature_v4=True, virtual_host=False):
    kwargs = {
        'aws_access_key_id': getattr(settings, 'AWS_ACCESS_KEY_ID', None) or os.getenv('AWS_ACCESS_KEY_ID'),
        'aws_secret_access_key': getattr(settings, 'AWS_SECRET_ACCESS_KEY', None) or os.getenv('AWS_SECRET_ACCESS_KEY'),
        'region_name': _get_region_name(),
    }
    if signature_v4:
        config_kwargs = {'signature_version': 's3v4'}
        if virtual_host:
            config_kwargs['s3'] = {'addressing_style': 'virtual'}
        kwargs['config'] = boto3.session.Config(**config_kwargs)
    return boto3.client('s3', **kwargs)


def _public_s3_url(key):
    bucket = _get_bucket_name()
    region = _get_region_name()
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def _sanitize_candidate_email(candidate_email, session_id):
    source = (candidate_email or '').strip().lower()
    if not source:
        source = f"session-{session_id}"
    return re.sub(r'[^a-z0-9@._-]+', '_', source)


def _build_premium_s3_key(session, filename):
    safe_email = _sanitize_candidate_email(session.candidate_email, session.session_id)
    return f"premium/{safe_email}/{filename}"


def _build_timestamped_filename(prefix, extension):
    stamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    clean_ext = extension if extension.startswith('.') else f'.{extension}'
    return f"{prefix}_{stamp}{clean_ext}"


def _serialize_session(session):
    return {
        'session_id': str(session.session_id),
        'candidate_name': session.candidate_name,
        'candidate_email': session.candidate_email,
        'role': session.role,
        'difficulty': session.difficulty,
        'status': session.status,
        'interview_mode': session.interview_mode,
        'resume_data': session.resume_data,
        'question_number': session.question_number,
        'max_questions': session.max_questions,
        'scores': session.scores,
        'overall_score': session.overall_score,
        'final_report': session.final_report,
        'conversation': session.conversation,
        'audio_recordings': session.audio_recordings,
        'interview_video_url': session.interview_video_url,
        'interview_video_key': session.interview_video_key,
        'created_at': session.created_at,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PremiumAIThrottle])
def parse_resume(request):
    """Parse an uploaded PDF resume and return structured JSON."""
    pdf_file = request.FILES.get('resume')
    if not pdf_file:
        return Response({'error': 'No resume file provided.'}, status=400)
    if not pdf_file.name.lower().endswith('.pdf'):
        return Response({'error': 'Only PDF files are supported.'}, status=400)

    try:
        from .resume_parser import extract_pdf_text, parse_resume_with_llm
        file_bytes = pdf_file.read()
        text = extract_pdf_text(file_bytes)
        if not text.strip():
            return Response({'error': 'Could not extract text from PDF. Ensure the PDF is not image-only.'}, status=400)
        resume_data = parse_resume_with_llm(text)
        return Response({'resume_data': resume_data})
    except Exception as exc:
        err_resp = _handle_gemini_error(exc)
        if err_resp:
            return err_resp
        return Response({'error': str(exc)}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PremiumAIThrottle])
def start_interview(request):
    candidate_name = request.data.get('candidate_name', '').strip()
    candidate_email = request.data.get('candidate_email', '').strip().lower()
    role = request.data.get('role', '').strip()
    difficulty = request.data.get('difficulty', 'medium').strip().lower()
    max_questions = int(request.data.get('max_questions', 5))
    resume_data = request.data.get('resume_data') or None
    if resume_data and not isinstance(resume_data, dict):
        try:
            resume_data = json.loads(resume_data)
        except Exception:
            resume_data = None

    if not candidate_name:
        return Response({'error': 'candidate_name is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not role and not resume_data:
        return Response({'error': 'Provide a role, upload a resume, or both.'}, status=status.HTTP_400_BAD_REQUEST)

    if difficulty not in ('easy', 'medium', 'hard'):
        difficulty = 'medium'
    max_questions = max(3, min(50, max_questions))

    if resume_data and role:
        interview_mode = 'hybrid'
    elif resume_data:
        interview_mode = 'resume'
        role = resume_data.get('role', 'Software Engineer')
    else:
        interview_mode = 'role'

    session = AIInterviewSession.objects.create(
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        role=role,
        difficulty=difficulty,
        max_questions=max_questions,
        status='active',
        interview_mode=interview_mode,
        resume_data=resume_data,
    )
    try:
        graph_result = start_session(
            session_id=str(session.session_id),
            candidate_name=candidate_name,
            role=role,
            difficulty=difficulty,
            max_questions=max_questions,
            resume_data=resume_data,
        )
    except Exception as exc:
        session.delete()
        err_resp = _handle_gemini_error(exc)
        if err_resp:
            return err_resp
        return Response({'error': f'AI service error: {str(exc)}'}, status=500)

    _sync_session(session, graph_result)
    return Response({
        'session_id': str(session.session_id),
        'candidate_email': session.candidate_email,
        'interview_mode': interview_mode,
        **graph_result,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def answer_question(request, session_id):
    session = get_object_or_404(AIInterviewSession, session_id=session_id)
    if session.status == 'completed':
        return Response({'error': 'Session already completed.'}, status=status.HTTP_400_BAD_REQUEST)
    answer = request.data.get('answer', '').strip()
    if not answer:
        return Response({'error': 'answer is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        graph_result = submit_answer(str(session_id), answer)
    except Exception as exc:
        err_resp = _handle_gemini_error(exc)
        if err_resp:
            return err_resp
        return Response({'error': f'AI service error: {str(exc)}'}, status=500)
    _sync_session(session, graph_result)
    return Response({'session_id': str(session_id), **graph_result})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_session(request, session_id):
    session = get_object_or_404(AIInterviewSession, session_id=session_id)
    return Response(_serialize_session(session))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sessions(request):
    # Was AllowAny → publicly dumped every session's PII. Now: super admins see
    # all; everyone else sees only their own sessions (matched by email).
    user = request.user
    is_super = bool(user.is_superuser or getattr(user, "role", None) == "super_admin")
    sessions = AIInterviewSession.objects.all().order_by('-created_at')
    if not is_super:
        sessions = sessions.filter(candidate_email__iexact=(user.email or "__no_match__"))
    sessions = sessions[:100]
    return Response([
        {
            'session_id': str(s.session_id),
            'candidate_name': s.candidate_name,
            'candidate_email': s.candidate_email,
            'role': s.role,
            'difficulty': s.difficulty,
            'status': s.status,
            'question_number': s.question_number,
            'max_questions': s.max_questions,
            'overall_score': s.overall_score,
            'interview_video_url': s.interview_video_url,
            'created_at': s.created_at,
        }
        for s in sessions
    ])


@api_view(['GET'])
@permission_classes([AllowAny])
def get_roles(request):
    return Response({
        'success': True,
        'data': [
            'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
            'Python Developer', 'JavaScript Developer', 'React Developer',
            'Node.js Developer', 'DevOps Engineer', 'Data Scientist',
            'Machine Learning Engineer', 'Data Engineer', 'Mobile Developer',
            'Cloud Engineer', 'QA Engineer', 'Database Administrator',
            'System Design Architect', 'Cybersecurity Engineer',
            'Product Manager Technical',
        ],
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PremiumAIThrottle])
def transcribe_audio(request):
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return Response({'error': 'No audio file provided.'}, status=400)
    tmp_path = None
    try:
        from .ai_utils import transcribe_audio_with_groq

        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
            tmp.write(audio_file.read())
            tmp_path = tmp.name

        text = transcribe_audio_with_groq(tmp_path)
        return Response({'text': text})
    except Exception as exc:
        return Response({'error': str(exc)}, status=500)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_interview_intro(request, session_id):
    session = get_object_or_404(AIInterviewSession, session_id=session_id)
    try:
        from .ai_utils import generate_interviewer_intro

        resume_summary = None
        if session.resume_data and isinstance(session.resume_data, dict):
            resume_summary = session.resume_data.get('summary')

        intro_text = generate_interviewer_intro(
            session.candidate_name,
            session.role,
            resume_summary,
        )
        return Response({'introduction': intro_text})
    except Exception as exc:
        return Response({'error': str(exc)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([PremiumAIThrottle])
def tts_view(request):
    text = request.query_params.get('text', '')
    if not text:
        return Response({'error': 'No text provided'}, status=400)

    try:
        from .ai_utils import generate_tts_audio

        audio_data = generate_tts_audio(text)
        if audio_data:
            return HttpResponse(audio_data, content_type='audio/mpeg')
        return Response({'error': 'TTS generation failed'}, status=500)
    except Exception as exc:
        return Response({'error': str(exc)}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def end_interview(request, session_id):
    """End an interview early and generate a partial report."""
    session = get_object_or_404(AIInterviewSession, session_id=session_id)

    if session.status == 'completed':
        return Response({
            'session_id': str(session.session_id),
            'status': 'completed',
            'final_report': session.final_report,
            'scores': session.scores,
            'overall_score': session.overall_score,
            'conversation': session.conversation,
            'interview_video_url': session.interview_video_url,
        })

    scores = session.scores or []
    conversation = session.conversation or []
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    try:
        from .langgraph_interview import _generate_final_report as _gen_report
        state = {
            'candidate_name': session.candidate_name,
            'role': session.role,
            'difficulty': session.difficulty,
            'conversation': conversation,
            'scores': scores,
            'resume_data': session.resume_data,
        }
        report = _gen_report(state)
    except Exception:
        report = {
            'overall_score': avg_score,
            'grade': 'N/A',
            'summary': f'Interview ended early after {len(scores)} question(s) answered.',
            'competencies': [],
            'strengths': [],
            'improvements': [],
            'recommendation': 'Incomplete',
            'recommendation_reason': 'Interview was ended before completion.',
            'qa_pairs': [],
        }

    session.status = 'completed'
    session.final_report = report
    session.overall_score = report.get('overall_score', avg_score)
    session.save(update_fields=['status', 'final_report', 'overall_score', 'updated_at'])

    return Response({
        'session_id': str(session.session_id),
        'status': 'completed',
        'final_report': report,
        'scores': scores,
        'overall_score': session.overall_score,
        'conversation': conversation,
        'interview_video_url': session.interview_video_url,
    })


class UploadAnswerAudioView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, session_id):
        session = get_object_or_404(AIInterviewSession, session_id=session_id)
        audio_file = request.FILES.get('audio')
        question_number = request.data.get('question_number', '')

        if not audio_file:
            return Response({'error': 'audio is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not _get_bucket_name():
            return Response({'error': 'S3 bucket is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        extension = os.path.splitext(audio_file.name or 'answer.webm')[1] or '.webm'
        prefix = f"audio_answer_q{question_number or session.question_number or '0'}"
        filename = _build_timestamped_filename(prefix, extension)
        file_key = _build_premium_s3_key(session, filename)

        try:
            _get_s3_client().upload_fileobj(
                audio_file,
                _get_bucket_name(),
                file_key,
                ExtraArgs={'ContentType': getattr(audio_file, 'content_type', 'audio/webm')},
            )
            s3_url = _public_s3_url(file_key)
            recordings = list(session.audio_recordings or [])
            recordings.append({
                'question_number': int(question_number) if str(question_number).isdigit() else session.question_number,
                'file_name': filename,
                'file_key': file_key,
                'audio_url': s3_url,
                'uploaded_at': datetime.utcnow().isoformat() + 'Z',
            })
            session.audio_recordings = recordings
            session.save(update_fields=['audio_recordings', 'updated_at'])
            return Response({
                'status': 'success',
                'audio_url': s3_url,
                'file_key': file_key,
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GetInterviewVideoUploadUrlView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, session_id):
        session = get_object_or_404(AIInterviewSession, session_id=session_id)
        file_name = request.data.get('file_name', 'premium_interview.webm')
        file_type = request.data.get('file_type', 'video/webm')
        use_multipart = str(request.data.get('use_multipart', 'true')).lower() == 'true'

        if not _get_bucket_name():
            return Response({'error': 'S3 bucket is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        extension = os.path.splitext(file_name)[1] or '.webm'
        filename = _build_timestamped_filename(f"interview_{session.session_id}", extension)
        file_key = _build_premium_s3_key(session, filename)

        try:
            s3_client = _get_s3_client(virtual_host=True)

            if use_multipart:
                multipart_upload = s3_client.create_multipart_upload(
                    Bucket=_get_bucket_name(),
                    Key=file_key,
                    ContentType=file_type,
                )
                upload_id = multipart_upload['UploadId']
                s3_url = _public_s3_url(file_key)
                session.interview_video_url = s3_url
                session.interview_video_key = file_key
                session.save(update_fields=['interview_video_url', 'interview_video_key', 'updated_at'])

                return Response({
                    'upload_id': upload_id,
                    'file_key': file_key,
                    's3_url': s3_url,
                    'multipart': True,
                })

            presigned_post = s3_client.generate_presigned_post(
                Bucket=_get_bucket_name(),
                Key=file_key,
                Fields={'Content-Type': file_type},
                Conditions=[['content-length-range', 0, 1024 * 1024 * 1024]],
                ExpiresIn=7200,
            )
            s3_url = _public_s3_url(file_key)
            session.interview_video_url = s3_url
            session.interview_video_key = file_key
            session.save(update_fields=['interview_video_url', 'interview_video_key', 'updated_at'])

            return Response({
                'url': presigned_post['url'],
                'fields': presigned_post['fields'],
                'file_key': file_key,
                's3_url': s3_url,
                'multipart': False,
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadInterviewVideoChunkView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, session_id):
        get_object_or_404(AIInterviewSession, session_id=session_id)
        upload_id = request.data.get('upload_id')
        file_key = request.data.get('file_key')
        chunk_index = int(request.data.get('chunk_index', 1))
        chunk_file = request.FILES.get('chunk')

        if not all([upload_id, file_key, chunk_file]):
            return Response(
                {'error': 'upload_id, file_key, and chunk are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = _get_s3_client().upload_part(
                Bucket=_get_bucket_name(),
                Key=file_key,
                PartNumber=chunk_index,
                UploadId=upload_id,
                Body=chunk_file.read(),
            )
            return Response({
                'status': 'success',
                'chunk_index': chunk_index,
                'etag': response['ETag'],
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CompleteInterviewVideoUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request, session_id):
        session = get_object_or_404(AIInterviewSession, session_id=session_id)
        upload_id = request.data.get('upload_id')
        file_key = request.data.get('file_key')
        parts = request.data.get('parts', [])

        if not all([upload_id, file_key, parts]):
            return Response(
                {'error': 'upload_id, file_key, and parts are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        s3_client = _get_s3_client()
        try:
            s3_client.complete_multipart_upload(
                Bucket=_get_bucket_name(),
                Key=file_key,
                UploadId=upload_id,
                MultipartUpload={'Parts': parts},
            )
            s3_url = _public_s3_url(file_key)
            session.interview_video_url = s3_url
            session.interview_video_key = file_key
            session.save(update_fields=['interview_video_url', 'interview_video_key', 'updated_at'])
            return Response({
                'status': 'success',
                's3_url': s3_url,
                'file_key': file_key,
            })
        except Exception as exc:
            try:
                s3_client.abort_multipart_upload(
                    Bucket=_get_bucket_name(),
                    Key=file_key,
                    UploadId=upload_id,
                )
            except Exception:
                pass
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _sync_session(session, graph_result):
    if not graph_result or not isinstance(graph_result, dict):
        return

    session.conversation = graph_result.get('conversation', session.conversation)
    session.scores = graph_result.get('scores', session.scores)
    session.question_number = graph_result.get('question_number', session.question_number)

    if graph_result.get('status') == 'completed':
        session.status = 'completed'
        report = graph_result.get('final_report') or {}
        session.final_report = report
        session.overall_score = report.get('overall_score')
    session.save()
