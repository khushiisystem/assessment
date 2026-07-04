"""DRF API endpoints mirroring the legacy AI_assessment Django views."""

import base64
import logging
import os
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime, timedelta
from io import BytesIO

import boto3
from django.conf import settings
from .s3_client import get_s3_client
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.mail import send_mail
from django.utils.crypto import constant_time_compare
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone as django_timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication  # ← ADD THIS
from mock_interview.models import Question as MockQuestion
from django.db.models import Count, Q


from AI_assessment.ai_utils import (
    derive_role_from_tech_stack,
    get_gemini_client,
    get_mixed_questions,
    #transcribe_audio,
    #transcribe_audio_chunk_realtime,
)
from AI_assessment.models import (
    AIAssessment,
    # AIVoiceAnalysis,
    AIInterviewResponse,
    CandidateAIAssessment,
    Profile,
    Question,
    QuestionProfile,
)
from AI_assessment.tasks import send_completion_emails_async
from core.background_dispatcher import dispatch_background_task
from .celery_handoff import (
    apply_celery_result,
    build_assessment_handoff,
    celery_system_context,
    extract_result_key,
    get_json as get_handoff_json,
)
from AI_assessment.utils import (
    send_ai_assessment_notification,
    send_ai_assessment_reminder,
)
# from AI_assessment.voice_flow_analysis import (
#     aggregate_voice_flow_for_assignment,
#     analyze_and_store_voice_flow,
#     voice_analysis_summary,
# )
from core.models import CandidateAssessment, User
from core.storage_utils import s3_handler

from .serializers import (
    AIAssessmentSerializer,
    AIInterviewResponseSerializer,
    CandidateAIAssessmentDetailSerializer,
    CandidateAIAssessmentSerializer,
    ProfileSerializer,
    QuestionSerializer,
)

def remux_webm_in_background(s3_client, bucket, file_key):
    """Download WebM from S3, remux with FFmpeg for seeking, re-upload."""
    def _remux():
        input_path = None
        output_path = None

        try:
            if not shutil.which("ffmpeg"):
                logger.error(
                    "FFmpeg executable not found in PATH; cannot remux WebM. "
                    "Install ffmpeg or ensure it is available on the system PATH."
                )
                return

            # 1. S3 se download
            obj = s3_client.get_object(Bucket=bucket, Key=file_key)
            original_bytes = obj["Body"].read()

            # 2. Temp files
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as inp:
                inp.write(original_bytes)
                input_path = inp.name

            output_path = input_path.replace(".webm", "_seekable.webm")

            # 3. FFmpeg remux — re-encode nahi, sirf index add karo
            result = subprocess.run([
                "ffmpeg", "-y",
                "-i", input_path,
                "-c", "copy",
                output_path
            ], capture_output=True, text=True, timeout=300)

            if result.returncode == 0:
                # 4. Re-upload same key pe
                with open(output_path, "rb") as f:
                    s3_client.upload_fileobj(
                        f, bucket, file_key,
                        ExtraArgs={"ContentType": "video/webm"}
                    )
                    logger.info(f"FFmpeg remux success: {file_key}")
            else:
                logger.error(f"FFmpeg remux failed: {result.stderr}")

        except FileNotFoundError as e:
            logger.exception(
                f"remux_webm_in_background error: {e}. "
                f"FFmpeg executable may be missing or not installed."
            )
        except Exception as e:
            logger.exception(f"remux_webm_in_background error: {e}")
        finally:
            for p in (input_path, output_path):
                if p:
                    try:
                        os.unlink(p)
                    except OSError:
                        pass

    threading.Thread(target=_remux, daemon=True).start()

logger = logging.getLogger(__name__)


def _audio_presigned_url(audio_field, expires=3600):
    """Return a presigned S3 URL for a private-bucket audio FileField."""
    key = getattr(audio_field, "name", None)
    if not key:
        return None
    try:
        s3 = get_s3_client()
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
            ExpiresIn=expires,
        )
    except Exception:
        logger.exception("Failed to generate presigned URL for audio key: %s", key)
        return None


def _question_source_counts(questions):
    counts = {}
    for question in questions or []:
        source = question.get('source', 'unknown') if isinstance(question, dict) else 'legacy'
        counts[source] = counts.get(source, 0) + 1
    return counts


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class RolePermissionMixin:
    """Mixin to enforce role-based access on top of authentication."""

    required_roles: tuple[str, ...] | None = None

    def initial(self, request, *args, **kwargs):  # pragma: no cover - DRF hook
        super().initial(request, *args, **kwargs)
        if self.required_roles and getattr(request.user, "role", None) not in self.required_roles:
            raise PermissionDenied("You do not have permission to perform this action.")


def can_access_ai_assessment(user, assessment) -> bool:
    """Object-level visibility for an AIAssessment, mirroring the list rules:
    super_admin -> any; org_admin -> same organization; manager -> only own."""
    role = getattr(user, "role", None)
    if role == "super_admin" or getattr(user, "is_superuser", False):
        return True
    if role == "org_admin":
        org_id = getattr(user, "organization_id", None)
        return org_id is not None and getattr(assessment, "organization_id", None) == org_id
    if role == "manager":
        return getattr(assessment, "created_by_id", None) == user.id
    return False


class BulkUploadQuestionsView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request):
        file_obj = request.FILES.get("file")
        file_format = request.data.get("file_format")
        skip_errors = str(request.data.get("skip_errors", "true")).lower() in {"true", "1"}

        if not file_obj:
            return Response(
                {"status": "error", "message": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_format not in {"csv", "excel"}:
            return Response(
                {"status": "error", "message": "Invalid file format. Use csv or excel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = {"success": [], "errors": [], "warnings": []}

        try:
            rows = []
            if file_format == "csv":
                import csv

                file_obj.seek(0)
                reader = csv.DictReader(file_obj.read().decode("utf-8").splitlines())
                rows = list(reader)
            else:
                import openpyxl

                workbook = openpyxl.load_workbook(file_obj)
                worksheet = workbook.active
                headers = [cell.value for cell in worksheet[1]]
                for row in worksheet.iter_rows(min_row=2, values_only=True):
                    rows.append(dict(zip(headers, row)))

            valid_levels = {
                "fresher",
                "0-2_years",
                "2-5_years",
                "5-8_years",
                "8+_years",
            }

            for row_num, row in enumerate(rows, start=2):
                try:
                    question_text = (row.get("question") or "").strip()
                    complexity_level = (row.get("complexity_level") or "").strip()
                    profiles_str = (row.get("profiles") or "").strip()
                    is_active_raw = (row.get("is_active", "true") or "").strip().lower()

                    if not question_text:
                        msg = f"Row {row_num}: Question is required"
                        results["errors"].append(msg)
                        if not skip_errors:
                            raise ValueError(msg)
                        continue

                    if not complexity_level:
                        msg = f"Row {row_num}: Complexity level is required"
                        results["errors"].append(msg)
                        if not skip_errors:
                            raise ValueError(msg)
                        continue

                    if complexity_level not in valid_levels:
                        msg = (
                            f"Row {row_num}: Invalid complexity level '{complexity_level}'. "
                            f"Allowed values: {', '.join(sorted(valid_levels))}"
                        )
                        results["errors"].append(msg)
                        if not skip_errors:
                            raise ValueError(msg)
                        continue

                    if not profiles_str:
                        msg = f"Row {row_num}: Profiles are required"
                        results["errors"].append(msg)
                        if not skip_errors:
                            raise ValueError(msg)
                        continue

                    is_active = is_active_raw in {"true", "1", "yes", "on"}

                    if Question.objects.filter(question=question_text).exists():
                        results["warnings"].append(
                            f"Row {row_num}: Question already exists, skipping"
                        )
                        continue

                    question = Question.objects.create(
                        question=question_text,
                        complexity_level=complexity_level,
                        is_active=is_active,
                        created_by=request.user,
                    )

                    profile_names = [name.strip() for name in profiles_str.split("|") if name.strip()]
                    linked_profiles = []

                    for profile_name in profile_names:
                        profile = (
                            Profile.objects.filter(name=profile_name).first()
                            or Profile.objects.filter(name__iexact=profile_name).first()
                            or Profile.objects.filter(
                                profile_key=profile_name.lower().replace(" ", "_")
                            ).first()
                        )

                        if not profile:
                            # 🔥 Auto-create missing profile instead of failing
                            profile_key = profile_name.strip().lower().replace(" ", "_")
                        
                            profile, created = Profile.objects.get_or_create(
                                profile_key=profile_key,
                                defaults={
                                    "name": profile_name.strip(),
                                    "description": f"Auto-created from bulk upload (row {row_num})"
                                }
                            )
                        
                            if created:
                                results["warnings"].append(
                                    f"Row {row_num}: Profile '{profile_name}' was auto-created"
                                )
                        

                        QuestionProfile.objects.get_or_create(question=question, profile=profile)
                        linked_profiles.append(profile.name)

                    if linked_profiles:
                        results["success"].append(
                            f"Row {row_num}: Question created and linked to {', '.join(linked_profiles)}"
                        )
                    else:
                        question.delete()
                        msg = f"Row {row_num}: No valid profiles found"
                        results["errors"].append(msg)
                        if not skip_errors:
                            raise ValueError(msg)

                except Exception as row_err:  # noqa: BLE001
                    results["errors"].append(f"Row {row_num}: {row_err}")
                    if not skip_errors:
                        raise

            return Response({"status": "success", "results": results})

        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get(self, request):
        return Response(
            {
                "status": "success",
                "profiles": ProfileSerializer(Profile.objects.all(), many=True).data,
            }
        )
        
class GetAllHardcodedQuestionsView(RolePermissionMixin, APIView):
    """Combined questions from both core.Question and AI_assessment.Question models"""
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")
    pagination_class = StandardResultsSetPagination
    
    def get(self, request):
        try:
            from core.models import Question as CoreQuestion
            from AI_assessment.models import Question as AIQuestion

            role_type = request.GET.get('role_type', '')
            experience_level = request.GET.get('experience_level', '')
            stack = request.GET.get('stack', '')
            difficulty = request.GET.get('difficulty', '')   
            search = request.GET.get('search', '') 

            # Core questions
            core_qs = CoreQuestion.objects.filter(
                question_type='coding'
            ).values('id', 'title', 'description', 'question_type', 'difficulty',
                     'sample_input', 'sample_output', 'marks', 'created_at')

            core_list = [
                {
                    'id': f"core_{q['id']}",
                    'title': q['title'],
                    'description': q['description'] or '',
                    'question_type': q['question_type'],
                    'difficulty': q['difficulty'],
                    'sample_input': q['sample_input'] or '',
                    'sample_output': q['sample_output'] or '',
                    'marks': q['marks'] or 0,
                    'source': 'core',
                    'created_at': q['created_at'].isoformat() if q.get('created_at') else None, 
                }
                for q in core_qs
            ]
            
            if difficulty:
                core_list = [q for q in core_list if (q.get('difficulty') or '').lower() == difficulty.lower()]

            if search:
                core_list = [q for q in core_list if search.lower() in q['title'].lower()]

           
            if stack == 'coding':
                    # sirf coding questions
                    return Response({
                        'status': 'success',
                        'questions': core_list,
                        'total': len(core_list),
                    })
                    

            if stack:
                    # specific stack → 
                    mock_qs = MockQuestion.objects.filter(
                        stack__iexact=stack
                    ).values('id', 'text', 'stack', 'difficulty','created_at')
                    mock_list = [
                        {
                            'id': f"mock_{q['id']}",
                            'title': q['text'],
                            'question_type': 'text',
                            'difficulty': q['difficulty'],
                            'stack': q['stack'],
                            'source': 'mock_interview',
                            'category_name': q['stack'],
                            'created_at': q['created_at'],  # ← ADD
                        }
                        for q in mock_qs
                    ]
                    if difficulty:
                        mock_list = [q for q in mock_list if (q.get('difficulty') or '').lower() == difficulty.lower()]

                    if search:
                        mock_list = [q for q in mock_list if search.lower() in q['title'].lower()]
                                        
                    return Response({
                        'status': 'success',
                        'questions': mock_list,
                        'total': len(mock_list),
                    })

                # All Categories (stack='')
            mock_qs = MockQuestion.objects.all().values('id', 'text', 'stack', 'difficulty','created_at')
            mock_list = [
                    {
                        'id': f"mock_{q['id']}",
                        'title': q['text'],
                        'question_type': 'text',
                        'difficulty': q['difficulty'],
                        'stack': q['stack'],
                        'source': 'mock_interview',
                        'category_name': q['stack'],
                        'created_at': q['created_at'], 
                    }
                    for q in mock_qs
                ]

            # Apply filters on mock_list before combining
            if difficulty:
                mock_list = [q for q in mock_list if (q.get('difficulty') or '').lower() == difficulty.lower()]

            if search:
                mock_list = [q for q in mock_list if search.lower() in q.get('title', '').lower()]

            all_questions = core_list + mock_list

            def get_sort_key(q):
              val = q.get('created_at')
              if val is None:
                return 0
              if isinstance(val, int):
                return val  # mock: Unix timestamp (integer)
              if isinstance(val, str):
                try:
                  from datetime import datetime
            # ISO string ko timestamp mein convert karo
                  dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
                  return dt.timestamp()
                except:
                  return 0
                return 0

            all_questions.sort(key=get_sort_key, reverse=True)

            # Apply pagination
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(all_questions, request)
            
            if page:
                return paginator.get_paginated_response({
                    'status': 'success',
                    'questions': page,
                    'total': len(all_questions),
                })

            return Response({
                    'status': 'success',
                    'questions': all_questions,
                    'total': len(all_questions),
                })

        except Exception as exc:
                logger.exception("Failed to fetch hardcoded questions")
                return Response(
                    {"status": "error", "message": str(exc)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )


class UpdateMockInterviewQuestionView(RolePermissionMixin, APIView):
    """GET and PUT for a single mock_interview.Question"""
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def get(self, request, question_id):
        try:
            q = MockQuestion.objects.get(id=question_id)
            return Response({
                'id': f"mock_{q.id}",
                'title': q.text,
                'description': q.ideal_answer or '',
                'question_type': 'text',
                'difficulty': q.difficulty,
                'stack': q.stack,
                'source': 'mock_interview',
                'marks': 1,
                'created_at': q.created_at,
            })
        except MockQuestion.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Mock question not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def put(self, request, question_id):
        try:
            q = MockQuestion.objects.get(id=question_id)
            q.text = request.data.get('title', q.text)
            q.ideal_answer = request.data.get('description', q.ideal_answer)
            q.difficulty = request.data.get('difficulty', q.difficulty)
            q.stack = request.data.get('stack', q.stack)
            q.save()
            return Response({
                'status': 'success',
                'id': f"mock_{q.id}",
                'message': 'Mock interview question updated successfully.',
            })
        except MockQuestion.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Mock question not found'},
                status=status.HTTP_404_NOT_FOUND
            )

class AIAssessmentListView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        role = getattr(request.user, 'role', None)
        base_qs = AIAssessment.objects.all_for_super_admin()

        if role == 'super_admin' or request.user.is_superuser:
            # super_admin sees only global assessments (organization=None / is_global)
            assessments = base_qs.filter(organization__isnull=True)
        elif role == 'org_admin':
            # org_admin sees every AI assessment across their organization
            org = request.user.organization
            assessments = base_qs.filter(organization=org) if org else base_qs.none()
        elif role == 'manager':
            # manager sees only the AI assessments they created (created_by is
            # the source of truth; no org filter so it's robust to legacy rows)
            assessments = base_qs.filter(created_by=request.user)
        else:
            assessments = base_qs.none()
        assessments = assessments.select_related("created_by").annotate(
            assigned_candidates_count=Count('candidateaiassessment'),
            completed_candidates_count=Count(
                'candidateaiassessment',
                filter=Q(candidateaiassessment__status='completed')
            )
        ).order_by("-created_at")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(assessments, request)

        if page is not None:
            serializer = AIAssessmentSerializer(page, many=True)
            return paginator.get_paginated_response({
                "status": "success",
                "data": serializer.data
            })

        serializer = AIAssessmentSerializer(assessments, many=True)
        return Response({"status": "success", "data": serializer.data})


class CreateAIAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request):
        # Top-level try/except ensures any unexpected error returns JSON
        # instead of a Django HTML 500 page.
        try:
            # --- validate hardcoded_question_ids shape before hitting the
            # serializer. Previously a string or dict slipped straight onto
            # the JSONField and broke downstream consumers. ---
            #
            # IMPORTANT: the IDs are SOURCE-PREFIXED ("core_5", "mock_3") —
            # the prefix is what get_mixed_questions() uses to decide whether
            # to load from core.Question or mock_interview.Question. Forcing
            # int() here silently dropped the prefix (and the FE, to satisfy
            # that, coerced them to NaN and sent an empty list), so the
            # admin-selected hardcoded questions never reached generation.
            # Keep them as normalized strings instead.
            raw_ids = request.data.get("hardcoded_question_ids", [])
            if raw_ids in (None, ""):
                hardcoded_ids = []
            elif isinstance(raw_ids, (list, tuple)):
                import re as _re

                hardcoded_ids = []
                for i in raw_ids:
                    if i in (None, ""):
                        continue
                    token = str(i).strip()
                    # Accept "core_<int>", "mock_<int>", or a legacy plain int
                    # (treated as core downstream). Reject anything else.
                    if not _re.fullmatch(r"(?:core_|mock_)?\d+", token):
                        return Response(
                            {
                                "status": "error",
                                "message": (
                                    "hardcoded_question_ids must be ids like "
                                    "'core_5', 'mock_3', or a plain integer."
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    hardcoded_ids.append(token)
            else:
                return Response(
                    {
                        "status": "error",
                        "message": "hardcoded_question_ids must be a list of ids.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Job Description, Tech Stack and Experience Level are the three
            # mandatory inputs that drive question generation. The JD is the
            # primary source of context, so none may be blank.
            missing = []
            if not str(request.data.get("description", "")).strip():
                missing.append("Job Description (description)")
            tech_stack_in = request.data.get("tech_stack")
            if not tech_stack_in or (isinstance(tech_stack_in, (list, tuple)) and len(tech_stack_in) == 0):
                missing.append("Tech Stack (tech_stack)")
            if not str(request.data.get("experience_level", "")).strip():
                missing.append("Experience Level (experience_level)")
            if missing:
                return Response(
                    {
                        "status": "error",
                        "message": "These fields are required to generate the assessment: "
                        + ", ".join(missing),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = AIAssessmentSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {"status": "error", "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # org_admin and manager both create within their own organization;
            # only super_admin creates global (org=None) assessments. Without
            # this, a manager's assessment got organization=None and then
            # matched neither the manager's nor the org_admin's list filter.
            creator_role = getattr(request.user, "role", None)
            org = request.user.organization if creator_role in ("org_admin", "manager") else None
            # Single save() — pass hardcoded_question_ids through the
            # serializer kwargs instead of doing assessment.save() twice.
            assessment = serializer.save(
                created_by=request.user,
                organization=org,
                hardcoded_question_ids=hardcoded_ids,
            )

            # Auto-derive role_type from the configured tech stack. Keep the
            # serializer's role_type default when no skills were provided.
            if assessment.tech_stack:
                assessment.role_type = derive_role_from_tech_stack(assessment.tech_stack)
                assessment.save(update_fields=["role_type"])

            return Response(
                {
                    "status": "success",
                    "message": "AI Assessment created successfully.",
                    "data": AIAssessmentSerializer(assessment).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except PermissionDenied:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "CreateAIAssessmentView unhandled error",
                extra={
                    "user_id": getattr(request.user, "id", None),
                    "role": getattr(request.user, "role", None),
                },
            )
            return Response(
                {
                    "status": "error",
                    "message": "Failed to create assessment due to a server error.",
                    "error": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIAssessmentDetailView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def get(self, request, ai_assessment_id):
        assessment = get_object_or_404(AIAssessment, id=ai_assessment_id)
        if not can_access_ai_assessment(request.user, assessment):
            return Response(
                {"status": "error", "message": "You do not have access to this assessment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        assigned = CandidateAIAssessment.objects.filter(ai_assessment=assessment).select_related("candidate")
        return Response(
            {
                "status": "success",
                "assessment": AIAssessmentSerializer(assessment).data,
                "assigned_candidates": CandidateAIAssessmentSerializer(assigned, many=True).data,
            }
        )

    def put(self, request, ai_assessment_id):
        assessment = get_object_or_404(AIAssessment, id=ai_assessment_id)

        # Permission first: managers may only edit their own assessment.
        if not can_access_ai_assessment(request.user, assessment):
            return Response(
                {"status": "error", "message": "You do not have access to this assessment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Job Description, Tech Stack and Experience Level remain mandatory on
        # edit — they may be updated but never blanked out.
        emptied = []
        if "description" in request.data and not str(request.data.get("description", "")).strip():
            emptied.append("Job Description (description)")
        if "tech_stack" in request.data:
            ts = request.data.get("tech_stack")
            if not ts or (isinstance(ts, (list, tuple)) and len(ts) == 0):
                emptied.append("Tech Stack (tech_stack)")
        if "experience_level" in request.data and not str(request.data.get("experience_level", "")).strip():
            emptied.append("Experience Level (experience_level)")
        if emptied:
            return Response(
                {
                    "status": "error",
                    "message": "These fields are required and cannot be empty: "
                    + ", ".join(emptied),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AIAssessmentSerializer(assessment, data=request.data, partial=True)
        if serializer.is_valid():
            assessment = serializer.save()

            # ✅ ADD THIS
            hardcoded_ids = request.data.get("hardcoded_question_ids", [])
            assessment.hardcoded_question_ids = hardcoded_ids
            assessment.save()

            # Auto-derive role_type from the configured tech stack. Keep the
            # existing role_type when no skills are set on the assessment.
            if assessment.tech_stack:
                assessment.role_type = derive_role_from_tech_stack(assessment.tech_stack)
                assessment.save(update_fields=["role_type"])

            return Response(
                {
                    "status": "success",
                    "message": "AI Assessment updated successfully.",
                    "data": AIAssessmentSerializer(assessment).data,
                }
            )
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class AssignAIAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, ai_assessment_id):
        assessment = get_object_or_404(AIAssessment, id=ai_assessment_id)
        if not can_access_ai_assessment(request.user, assessment):
            return Response(
                {"status": "error", "message": "You do not have access to this assessment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        candidate_ids = request.data.get("candidate_ids") or []
        resume_text = request.data.get("resume_text", "")

        if not isinstance(candidate_ids, list) or not candidate_ids:
            return Response(
                {"status": "error", "message": "candidate_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_assignments: list[CandidateAIAssessment] = []
        for candidate_id in candidate_ids:
            candidate = User.objects.filter(role="candidate", id=candidate_id).first()
            if not candidate:
                continue

            assignment, created = CandidateAIAssessment.objects.get_or_create(
                candidate=candidate,
                ai_assessment=assessment,
                defaults={"assigned_by": request.user, "resume_text": resume_text},
            )
            if created:
                created_assignments.append(assignment)
                try:
                    send_ai_assessment_notification(assignment)
                except Exception as email_error:  # noqa: BLE001
                    logger.exception(
                        "Failed to send AI assessment notification",
                        extra={
                            "assignment_id": assignment.id,
                            "candidate_id": assignment.candidate_id,
                            "ai_assessment_id": assignment.ai_assessment_id,
                        },
                    )

        return Response(
            {
                "status": "success",
                "message": f"Assessment assigned to {len(created_assignments)} candidates.",
                "assigned": CandidateAIAssessmentSerializer(created_assignments, many=True).data,
            }
        )


class UnassignAIAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, ai_assessment_id):
        assessment = get_object_or_404(AIAssessment, id=ai_assessment_id)
        if not can_access_ai_assessment(request.user, assessment):
            return Response(
                {"status": "error", "message": "You do not have access to this assessment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        candidate_assessment_ids = request.data.get("candidate_assessment_ids", [])

        if not isinstance(candidate_assessment_ids, list) or not candidate_assessment_ids:
            return Response(
                {"status": "error", "message": "candidate_assessment_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            assignments = CandidateAIAssessment.objects.filter(
                id__in=candidate_assessment_ids, ai_assessment=assessment
            )
            # Delete related interview responses
            AIInterviewResponse.objects.filter(candidate_assessment__in=assignments).delete()
            deleted, _ = assignments.delete()

        return Response(
            {
                "status": "success",
                "unassigned_count": deleted,
                "message": f"{deleted} candidate(s) unassigned successfully.",
            }
        )


class AIAssessmentResultsView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def get(self, request, ai_assessment_id):
        assessment = get_object_or_404(AIAssessment, id=ai_assessment_id)
        if not can_access_ai_assessment(request.user, assessment):
            return Response(
                {"status": "error", "message": "You do not have access to this assessment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        queryset = (
            CandidateAIAssessment.objects.filter(ai_assessment=assessment)
            .select_related("candidate")
            .order_by("-overall_score")
        )
        completed = queryset.filter(status="completed")

        def avg(values_queryset, field):
            values = list(values_queryset.values_list(field, flat=True))
            return round(sum(values) / len(values), 2) if values else 0

        return Response(
            {
                "status": "success",
                "assessment": AIAssessmentSerializer(assessment).data,
                "results": CandidateAIAssessmentSerializer(queryset, many=True).data,
                "summary": {
                    "total_candidates": queryset.count(),
                    "completed_count": completed.count(),
                    "pending_count": queryset.exclude(status="completed").count(),
                    "avg_technical": avg(completed, "technical_score"),
                    "avg_communication": avg(completed, "communication_score"),
                    "avg_problem_solving": avg(completed, "problem_solving_score"),
                    "avg_overall": avg(completed, "overall_score"),
                },
            }
        )


# class CandidateAssessmentDetailView(RolePermissionMixin, APIView):
#     permission_classes = [IsAuthenticated]
#     required_roles = ("super_admin", "faculty", "examiner")

#     def get(self, request, candidate_assessment_id):
#         assignment = get_object_or_404(CandidateAIAssessment, id=candidate_assessment_id)
#         return Response(
#             {
#                 "status": "success",
#                 "data": CandidateAIAssessmentDetailSerializer(assignment).data,
#             }
#         )


class GenerateCandidateReportView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def get(self, request, candidate_assessment_id):
        assignment = get_object_or_404(CandidateAIAssessment, id=candidate_assessment_id)
        responses = {
            response.question_number: response
            for response in AIInterviewResponse.objects.filter(candidate_assessment=assignment)
        }
        # voice_analyses = {
        #     analysis.question_number: analysis
        #     for analysis in AIVoiceAnalysis.objects.filter(candidate_assessment=assignment)
        # }

        generated_questions = assignment.generated_questions or []

        # Video Timestamps Calculat use
        responses_sorted = sorted(
          [r for r in responses.values()],
          key=lambda x: x.question_number
        )
        video_timestamps = {1: 0}
        for resp in responses_sorted:
          next_q = resp.question_number + 1
          if resp.response_time:
            video_timestamps[next_q] = resp.response_time


        questions_payload = []
        for index, question_data in enumerate(generated_questions, start=1):
            # generated_questions may contain plain strings (old format) or
            # dicts with 'text', 'type', 'source', 'question_id' keys (new format)
            if isinstance(question_data, dict):
                question_text = question_data.get('text', '')
                question_type = question_data.get('type', 'text')
            else:
                question_text = question_data
                question_type = 'text'

            response = responses.get(index)
            verification = None
            if assignment.question_wise_verification:
                verification = next(
                    (
                        item
                        for item in assignment.question_wise_verification
                        if item.get("question_number") == index
                    ),
                    None,
                )

            questions_payload.append(
                {
                    "question_number": index,
                    "question_text": question_text,
                    "question_type": question_type,
                    "answer_text": response.answer_text if response else "Not answered",
                    "audio_recording": _audio_presigned_url(response.audio_recording) if response and response.audio_recording else None,
                    "response_time": response.response_time if response else 0,
                    "answered": response is not None,
                    "verification": verification,
                    "video_timestamp": video_timestamps.get(index, 0),  # ← YE ADD KARO
                    "code_answer": response.code_answer if response else None,
                    "code_language": response.code_language if response else None,
                    "code_execution_results": response.code_execution_results if response else None,
                    "code_marks_earned": response.code_marks_earned if response else None,
                    "code_marks_total": response.code_marks_total if response else None,
                    # "voice_analysis": voice_analysis_summary(voice_analyses.get(index)),
                }
            )

        # Generate presigned URLs for video URLs
        introduction_video_url = assignment.introduction_video_url
        interview_video_url = assignment.interview_video_url

        try:
            s3_client = get_s3_client()

            # Generate presigned URL for introduction video (15 minutes)
            if introduction_video_url and 'amazonaws.com' in introduction_video_url:
                s3_key = introduction_video_url.split('amazonaws.com/')[-1]
                introduction_video_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                        'Key': s3_key
                    },
                    ExpiresIn=900  # 15 minutes expiry
                )

            # Generate presigned URL for interview video (30 minutes)
            if interview_video_url and 'amazonaws.com' in interview_video_url:
                s3_key = interview_video_url.split('amazonaws.com/')[-1]
                interview_video_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                        'Key': s3_key
                    },
                    ExpiresIn=1800  # 30 minutes expiry
                )
        except Exception as e:
            logger.exception(f"Failed to generate presigned URLs for videos: {e}")
            # Keep original URLs if presigned URL generation fails

        return Response(
    {
        "status": "success",
        "candidate": {
            "name": assignment.candidate.get_full_name() or assignment.candidate.username,
            "email": assignment.candidate.email,
        },
        "assessment": AIAssessmentSerializer(assignment.ai_assessment).data,

        "scores": {
            "technical_score": assignment.technical_score,
            "communication_score": assignment.communication_score,
            "problem_solving_score": assignment.problem_solving_score,
            "overall_score": assignment.overall_score,
        },
        "start_time": assignment.start_time,
        "end_time": assignment.end_time,

        "feedback": {
            "technical_feedback": assignment.technical_feedback,
            "communication_feedback": assignment.communication_feedback,
            "problem_solving_feedback": assignment.problem_solving_feedback,
            "strengths_feedback": assignment.strengths_feedback,
            "improvement_feedback": assignment.improvement_feedback,
            "overall_feedback": assignment.overall_feedback,
        },

        "questions": questions_payload,
        "cheating_alerts": assignment.cheating_alerts or [],
        "gesture_analysis": assignment.gesture_analysis or {},
        # "voice_flow_analysis": assignment.voice_flow_analysis or {},
        # "voice_flow_risk_score": assignment.voice_flow_risk_score,
        # "voice_flow_risk_level": assignment.voice_flow_risk_level,
        "introduction_video_url": introduction_video_url,
        "interview_video_url": interview_video_url,
        "certificate_eligible": (
            (assignment.ai_assessment.passing_percentage or 0) > 0
            and ((assignment.overall_score or 0) / 10 * 100) >= (assignment.ai_assessment.passing_percentage or 0)
        ),
        "passing_percentage": assignment.ai_assessment.passing_percentage or 0,
        "admin_feedback": assignment.admin_feedback or "",
    }
     )

    def patch(self, request, candidate_assessment_id):
        assignment = get_object_or_404(CandidateAIAssessment, id=candidate_assessment_id)
        feedback = request.data.get("admin_feedback", "")
        assignment.admin_feedback = feedback
        assignment.save(update_fields=["admin_feedback"])
        return Response({"status": "success"})




class DeleteAIAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, ai_assessment_id):
        assessment = get_object_or_404(AIAssessment, id=ai_assessment_id)
        if not can_access_ai_assessment(request.user, assessment):
            return Response(
                {"status": "error", "message": "You do not have access to this assessment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        title = assessment.title
        assessment.delete()
        return Response(
            {
                "status": "success",
                "message": f'AI Assessment "{title}" deleted successfully.',
            }
        )


class DeleteCandidateAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, candidate_assessment_id):
        assignment = get_object_or_404(CandidateAIAssessment, id=candidate_assessment_id)
        candidate_name = assignment.candidate.get_full_name() or assignment.candidate.username
        assignment.delete()
        return Response(
            {
                "status": "success",
                "message": f"Result for {candidate_name} deleted successfully.",
            }
        )


class AIAssessmentBulkDeleteView(RolePermissionMixin, APIView):
    """Bulk delete AI assessments (admin only)."""
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, *args, **kwargs):
        from .serializers import AIAssessmentBulkDeleteSerializer

        serializer = AIAssessmentBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment_ids = serializer.validated_data["ai_assessment_ids"]

        # Scope the delete to what the caller is allowed to see:
        #   super_admin -> any; org_admin -> their org; manager -> only own.
        delete_qs = AIAssessment.objects.all_for_super_admin().filter(id__in=assessment_ids)
        role = getattr(request.user, "role", None)
        if role == "org_admin":
            org_id = getattr(request.user, "organization_id", None)
            delete_qs = delete_qs.filter(organization_id=org_id) if org_id else delete_qs.none()
        elif role == "manager":
            delete_qs = delete_qs.filter(created_by=request.user)
        elif not (role == "super_admin" or request.user.is_superuser):
            delete_qs = delete_qs.none()

        deleted, _ = delete_qs.delete()
        return Response({"status": "success", "deleted": deleted})


class CandidateCompletedAssessmentsView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        from organization.context import set_tenant_context

        user = request.user
        is_individual = getattr(user, "is_individual", False)
        if is_individual:
            set_tenant_context(None, is_super_admin=True)

        try:
            regular_completed = CandidateAssessment.objects.filter(
                candidate=user, status="completed"
            ).select_related("assessment")
            ai_completed = CandidateAIAssessment.objects.filter(
                candidate=user, status="completed"
            ).select_related("ai_assessment")

            # Apply pagination to AI assessments
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(ai_completed, request)
            ai_serializer = CandidateAIAssessmentSerializer(page, many=True) if page else CandidateAIAssessmentSerializer(ai_completed, many=True)

            response_data = {
                "status": "success",
                "regular_completed": [
                    {
                        "candidate_assessment_id": ca.id,
                        "assessment_id": ca.assessment_id,
                        "title": ca.assessment.title,
                        "completed_at": ca.end_time.isoformat() if ca.end_time else None,
                        "score": ca.score,
                        "percentage": ca.percentage,
                    }
                    for ca in regular_completed
                ],
                "ai_completed": ai_serializer.data,
            }

            if page:
                return paginator.get_paginated_response(response_data)
            else:
                return Response(response_data)
        finally:
            if is_individual:
                set_tenant_context(organization_id=None, is_super_admin=False, is_individual=True)


class CandidateUpcomingAssessmentsView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        from organization.context import set_tenant_context

        user = request.user
        is_individual = getattr(user, "is_individual", False)
        if is_individual:
            set_tenant_context(None, is_super_admin=True)

        try:
            regular_assigned = CandidateAssessment.objects.filter(
                candidate=user, status="assigned"
            ).select_related("assessment")
            ai_assigned = CandidateAIAssessment.objects.filter(
                candidate=user, status="assigned"
            ).select_related("ai_assessment")

            # Apply pagination to AI assessments
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(ai_assigned, request)
            ai_serializer = CandidateAIAssessmentSerializer(page, many=True) if page else CandidateAIAssessmentSerializer(ai_assigned, many=True)

            response_data = {
                "status": "success",
                "regular_assigned": [
                    {
                        "candidate_assessment_id": ca.id,
                        "assessment_id": ca.assessment_id,
                        "title": ca.assessment.title,
                        "start_date": ca.assessment.start_date.isoformat(),
                        "end_date": ca.assessment.end_date.isoformat(),
                    }
                    for ca in regular_assigned
                ],
                "ai_assigned": ai_serializer.data,
            }

            if page:
                return paginator.get_paginated_response(response_data)
            else:
                return Response(response_data)
        finally:
            if is_individual:
                set_tenant_context(organization_id=None, is_super_admin=False, is_individual=True)


class CandidateMyAssessmentsCombinedView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        from organization.context import set_tenant_context, clear_tenant_context

        user = request.user
        is_individual = getattr(user, "is_individual", False)

        # Individual users have no organization, so tenant filtering returns
        # empty results.  Temporarily elevate to super_admin so the
        # TenantManager doesn't call .none().
        if is_individual:
            set_tenant_context(None, is_super_admin=True)

        try:
            regular_assigned = (
                CandidateAssessment.objects
                .filter(candidate=user, status__in=["assigned", "in_progress"])
                .select_related("assessment")
            )
            ai_assigned = (
                CandidateAIAssessment.objects
                .filter(candidate=user, status__in=["assigned", "in_progress"])
                .select_related("ai_assessment")
            )

            # Apply pagination to AI assessments
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(ai_assigned, request)
            ai_serializer = (
                CandidateAIAssessmentSerializer(page, many=True)
                if page
                else CandidateAIAssessmentSerializer(ai_assigned, many=True)
            )

            response_data = {
                "status": "success",
                "assigned_assessments": [
                    {
                        "candidate_assessment_id": ca.id,
                        "assessment_id": ca.assessment_id,
                        "title": ca.assessment.title,
                        "start_date": ca.assessment.start_date.isoformat(),
                        "end_date": ca.assessment.end_date.isoformat(),
                        "status": ca.status,
                        "total_questions": ca.assessment.questions.count(),
                        "duration_minutes": ca.assessment.duration,
                        "assessment_type": "regular",
                    }
                    for ca in regular_assigned
                ],
                "ai_assigned_assessments": ai_serializer.data,
                "summary": {
                    "regular_assigned_count": regular_assigned.count(),
                    "ai_assigned_count": ai_assigned.count(),
                    "total_assigned_count": regular_assigned.count() + ai_assigned.count(),
                },
            }

            if page:
                return paginator.get_paginated_response(response_data)
            else:
                return Response(response_data)

        finally:
            if is_individual:
                # Restore proper individual context
                set_tenant_context(
                    organization_id=None,
                    is_super_admin=False,
                    is_individual=True,
                )


class SendSelectionEmailView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, candidate_id):
        candidate = get_object_or_404(User, id=candidate_id)
        subject = "Congratulations! You are selected for the next round"
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = [candidate.email]

        html_message = render_to_string("emails/selection_email.html", {"candidate": candidate})
        plain_message = strip_tags(html_message)

        try:
            send_mail(subject, plain_message, from_email, recipient_list, html_message=html_message)
            return Response(
                {
                    "status": "success",
                    "message": f"Selection email sent to {candidate.email}.",
                }
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AssignAssessmentEmailView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, candidate_assessment_id):
        assignment = get_object_or_404(CandidateAIAssessment, id=candidate_assessment_id)
        if send_ai_assessment_notification(assignment):
            return Response(
                {
                    "status": "success",
                    "message": f"Assessment assigned and email sent to {assignment.candidate.email}.",
                }
            )
        return Response(
            {
                "status": "error",
                "message": "Failed to send assessment email. Please verify email configuration.",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class SendReminderEmailView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request, candidate_assessment_id):
        assignment = get_object_or_404(CandidateAIAssessment, id=candidate_assessment_id)
        if send_ai_assessment_reminder(assignment):
            return Response(
                {
                    "status": "success",
                    "message": f"Reminder email sent to {assignment.candidate.email}.",
                }
            )
        return Response(
            {
                "status": "error",
                "message": "Failed to send reminder email. Please verify email configuration.",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class AIAssessmentIntroductionView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    required_roles = ("candidate",)

    def get(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        if assignment.status == "completed":
            return Response(
                {
                    "status": "completed",
                    "message": "You have already completed this AI interview.",
                }
            )

        if assignment.introduction_video or assignment.introduction_video_url:
            return Response(
                {
                    "status": "recorded",
                    "message": "Introduction video already recorded.",
                }
            )

        return Response(
            {
                "status": "pending",
                "assessment": AIAssessmentSerializer(assignment.ai_assessment).data,
            }
        )

    def post(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )
        video_data = request.data.get("video_data")

        if not video_data:
            return Response(
                {"status": "error", "message": "video_data is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            task = dispatch_background_task(
                "process_intro_video",
                {"assignment_id": assignment.id, "video_data": video_data},
                user_role=getattr(request.user, "role", None),
            )

            return Response(
                {
                    "status": "success",
                    "message": "Introduction video upload queued for processing.",
                    "task_id": task["task_id"],
                }
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class TakeAIAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    def get(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )
        assessment = assignment.ai_assessment

        if assignment.status == "completed":
            return Response(
                {
                    "status": "completed",
                    "message": "You have already completed this AI interview.",
                }
            )

        if assessment.is_upcoming():
            return Response(
                {
                    "status": "upcoming",
                    "message": "This AI interview has not started yet.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if assessment.is_expired():
            assignment.status = "expired"
            assignment.save(update_fields=["status"])
            return Response(
                {
                    "status": "expired",
                    "message": "This AI interview has expired.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not assignment.introduction_video and not assignment.introduction_video_url:
            return Response(
                {
                    "status": "introduction_pending",
                    "message": "Introduction video required before starting the assessment.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if assignment.status == "assigned" and not assignment.start_time:
            assignment.status = "in_progress"
            assignment.start_time = timezone.now()
            assignment.end_time = None
            assignment.save(update_fields=["status", "start_time", "end_time"])

            # Track AI interview usage for subscription enforcement
            from core.usage_tracking import increment_ai_interview_usage
            increment_ai_interview_usage(request.user)

        hardcoded_count = len(assessment.hardcoded_question_ids or [])
        effective_total = max(assessment.num_questions, hardcoded_count)
        # OPT: if PrepareQuestionsAsync is already generating, do NOT run
        # a second synchronous generation here — that doubled the LLM cost
        # and could race the async thread. Tell the FE to keep polling.
        questions_status = getattr(assignment, 'questions_generation_status', 'pending')
        questions_short = (
            not assignment.generated_questions or
            len(assignment.generated_questions) < effective_total
        )
        # Stuck-status recovery: a 'processing' state with no questions
        # and a stale start_time means the background thread is dead
        # (process restart, Gemini hang, OOM). Reset to 'pending' and
        # let the sync generation below run so the candidate isn't stuck
        # on /take/ returning 202 forever.
        STUCK_THRESHOLD = timedelta(minutes=2)
        if questions_short and questions_status == 'processing':
            ref_time = assignment.start_time or assignment.assigned_date
            is_stuck = ref_time and (timezone.now() - ref_time > STUCK_THRESHOLD)
            if is_stuck:
                logger.warning(
                    "[AI QUESTIONS API] /take/ saw stale 'processing' status, resetting to 'pending': "
                    "assignment=%s ref_time=%s generated_count=%s",
                    assignment.id, ref_time, len(assignment.generated_questions or []),
                )
                assignment.questions_generation_status = 'pending'
                assignment.save(update_fields=['questions_generation_status'])
                questions_status = 'pending'
            else:
                return Response(
                    {
                        "status": "generating",
                        "message": "Questions are still being generated.",
                        "questions_generation_status": questions_status,
                        "generated_count": len(assignment.generated_questions or []),
                        "total_needed": effective_total,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )
        if questions_short:
            num_coding = getattr(assessment, 'num_coding_questions', 0) or 0
            try:
                logger.info(
                    "[AI QUESTIONS API] Candidate start generating questions: assignment=%s assessment=%s candidate=%s total=%s effective_total=%s existing_count=%s hardcoded_ids=%s coding=%s status=%s",
                    assignment.id,
                    assessment.id,
                    assignment.candidate_id,
                    assessment.num_questions,
                    effective_total,
                    len(assignment.generated_questions or []),
                    len(assessment.hardcoded_question_ids or []),
                    num_coding,
                    getattr(assignment, 'questions_generation_status', ''),
                )
                mixed_questions = get_mixed_questions(
                    role_type=assessment.role_type,
                    experience_level=assessment.experience_level,
                    total_questions=assessment.num_questions,
                    num_hardcoded=assessment.num_hardcoded_questions,
                    hardcoded_question_ids=assessment.hardcoded_question_ids or [],
                    resume_text=assignment.resume_text,
                    num_coding=num_coding,
                    tech_stack=", ".join(assessment.tech_stack or []),
                    job_description=assessment.description,
                )
                source_counts = _question_source_counts(mixed_questions)
                logger.info(
                    "[AI QUESTIONS API] get_mixed_questions returned: assignment=%s count=%s sources=%s",
                    assignment.id,
                    len(mixed_questions or []),
                    source_counts,
                )
                if mixed_questions and len(mixed_questions) >= effective_total:
                    assignment.generated_questions = mixed_questions[:effective_total]
                else:
                    raise ValueError(
                        f"Insufficient questions generated: got {len(mixed_questions or [])}, needed {effective_total}"
                    )
            except Exception as question_error:  # noqa: BLE001
                logger.exception(
                    "[AI QUESTIONS API] Mixed question generation failed; using hardcoded + generic fill",
                    extra={
                        "assignment_id": assignment.id,
                        "ai_assessment_id": assessment.id,
                    },
                )
                # Safety net: keep every admin-configured hardcoded
                # question, then top up with generic prompts until we hit
                # the configured num_questions count. Previously a single
                # LLM crash wiped the hardcoded list and left the
                # candidate with 5 random generic prompts even when the
                # admin had set up 8+ hardcoded ones.
                role_display = assessment.get_role_type_display()
                generic = [
                    {"text": f"Describe a challenging {role_display} problem you solved and the approach you took.", "type": "text", "source": "fallback"},
                    {"text": f"How would you design a scalable solution for a typical {role_display} task?", "type": "text", "source": "fallback"},
                    {"text": "What are your strongest technical skills and how have you applied them in real projects?", "type": "text", "source": "fallback"},
                    {"text": "Explain a time you optimized performance in a project. What was the impact?", "type": "text", "source": "fallback"},
                    {"text": "What are your go-to debugging strategies when facing complex issues?", "type": "text", "source": "fallback"},
                    {"text": f"What are the most important best practices in your {role_display} work and why?", "type": "text", "source": "fallback"},
                    {"text": f"Walk me through a recent {role_display} project you're proud of, end to end.", "type": "text", "source": "fallback"},
                    {"text": "How do you approach learning a new technology or framework when you need it for a project?", "type": "text", "source": "fallback"},
                ]
                hardcoded_only = []
                try:
                    hardcoded_only = get_mixed_questions(
                        role_type=assessment.role_type,
                        experience_level=assessment.experience_level,
                        # total = hardcoded count keeps the LLM out of
                        # this re-pull — if Gemini was the failure point,
                        # this call won't re-fire it.
                        total_questions=len(assessment.hardcoded_question_ids or []),
                        num_hardcoded=assessment.num_hardcoded_questions,
                        hardcoded_question_ids=assessment.hardcoded_question_ids or [],
                        resume_text=assignment.resume_text,
                        num_coding=0,
                        tech_stack=", ".join(assessment.tech_stack or []),
                        job_description=assessment.description,
                    )
                except Exception:
                    logger.exception("[AI QUESTIONS API] Hardcoded re-pull failed during fallback")
                hardcoded_only = [q for q in (hardcoded_only or []) if q.get('source') == 'hardcoded']
                need = max(0, effective_total - len(hardcoded_only))
                topped_up = [generic[i % len(generic)] for i in range(need)]
                assignment.generated_questions = (hardcoded_only + topped_up)[:effective_total]

            assignment.save(update_fields=["generated_questions"])
            logger.info(
                "[AI QUESTIONS API] Saved questions for candidate assessment: assignment=%s count=%s sources=%s",
                assignment.id,
                len(assignment.generated_questions or []),
                _question_source_counts(assignment.generated_questions),
            )

        # Backward compatibility: convert legacy string format to dict format
        questions = list(assignment.generated_questions or [])
        if questions and isinstance(questions[0], str):
            questions = [{"text": q, "type": "text", "source": "unknown"} for q in questions]
            assignment.generated_questions = questions
            assignment.save(update_fields=["generated_questions"])
            logger.info("[AI QUESTIONS API] Converted legacy generated questions to dicts: assignment=%s count=%s", assignment.id, len(questions))

        existing_responses = AIInterviewResponse.objects.filter(candidate_assessment=assignment)
        response_map = {
            response.question_number: {
                "answer_text": response.answer_text,
                "voice_recording_path": response.voice_recording_path,
                "audio_recording_url": _audio_presigned_url(response.audio_recording) if response.audio_recording else None,
                "response_time": response.response_time,
                "code_answer": response.code_answer,
                "code_language": response.code_language,
                "code_execution_results": response.code_execution_results,
                "code_marks_earned": response.code_marks_earned,
                "code_marks_total": response.code_marks_total,
            }
            for response in existing_responses
        }

        logger.info(
            "[AI QUESTIONS API] Returning questions to candidate screen: assignment=%s assessment=%s count=%s sources=%s responses=%s status=%s",
            assignment.id,
            assessment.id,
            len(questions),
            _question_source_counts(questions),
            len(response_map),
            getattr(assignment, 'questions_generation_status', ''),
        )

        return Response(
            {
                "status": "success",
                "assessment": AIAssessmentSerializer(assessment).data,
                "candidate_assessment": CandidateAIAssessmentSerializer(assignment).data,
                "questions": questions,
                "responses": response_map,
                "end_time": assignment.end_time.isoformat() if assignment.end_time else None,
            }
        )


class SubmitAIAssessmentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    def post(self, request, ai_assessment_id):
        # Top-level try/except ensures the response is ALWAYS JSON, even when
        # something throws before reaching the existing inner try below
        # (a NameError in the upload-precheck section, for example, used to
        # bubble out as Django's HTML 500 page).
        logger.info("SubmitAIAssessmentView Start ********")

        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        if assignment.status == "completed":
            return Response(
                {"status": "success", "message": "Assessment already submitted."}
            )

        # Check if all required components are uploaded
        has_intro = bool(assignment.introduction_video or assignment.introduction_video_url)
        has_interview_video = bool(assignment.interview_video or assignment.interview_video_url or assignment.assessment_video_url)
        responses_count = AIInterviewResponse.objects.filter(candidate_assessment=assignment).count()
        expected_questions = len(assignment.generated_questions or []) or assignment.ai_assessment.num_questions

        if not has_intro:
            return Response(
                {"status": "error", "message": "Introduction video is required before submitting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not has_interview_video:
            return Response(
                {"status": "error", "message": "Interview video is required before submitting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Commented this because of no use always true
        # if responses_count < expected_questions:
        #     return Response(
        #         {"status": "error", "message": f"All {expected_questions} questions must be answered before submitting."},
        #         status=status.HTTP_400_BAD_REQUEST,
        #     )

        try:
            logger.info("SubmitAIAssessmentView Start ********")

            candidate_ai_assignment = get_object_or_404(
                CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
            )

            if candidate_ai_assignment.status == "completed":
                return Response(
                    {"status": "success", "message": "Assessment already submitted."}
                )

            # Check if all required components are uploaded.
            # NOTE: previous version had a typo (`assignmcandidate_ai_assignmentent`)
            # which raised NameError for every submission, returning a Django
            # HTML 500 to the client. Fixed to read the actual variable.
            has_intro = bool(
                candidate_ai_assignment.introduction_video
                or candidate_ai_assignment.introduction_video_url
            )
            has_interview_video = bool(
                candidate_ai_assignment.interview_video
                or candidate_ai_assignment.interview_video_url
                or candidate_ai_assignment.assessment_video_url
            )

            if not has_intro:
                return Response(
                    {"status": "error", "message": "Introduction video is required before submitting."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not has_interview_video:
                return Response(
                    {"status": "error", "message": "Interview video is required before submitting."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                handoff_payload = build_assessment_handoff(candidate_ai_assignment)
                callback_base_url = getattr(settings, "CELERY_CALLBACK_BASE_URL", "").strip().rstrip("/")
                if callback_base_url:
                    callback_url = f"{callback_base_url}/v1/ai-assessment/celery-callback/"
                else:
                    callback_url = request.build_absolute_uri("/v1/ai-assessment/celery-callback/")
                webhook_secret = getattr(settings, "WEBHOOK_SECRET", "")
                if webhook_secret:
                    callback_url = f"{callback_url}?secret={webhook_secret}"
                handoff_payload["callback_url"] = callback_url

                logger.info("dispatch_background_task Start ********")
                task = dispatch_background_task(
                    "process_ai_assessment_s3_handoff",
                    {
                        "task_name": "process_ai_assessment_s3_handoff",
                        "payload": handoff_payload,
                    },
                    user_role=getattr(request.user, "role", None),
                )
                logger.info("dispatch_background_task END ********")
                logger.info("SubmitAIAssessmentView END ********")

                # Stamp the submission time so the assignment immediately drops
                # out of the candidate's "assigned / in-progress" list (the
                # assigned-assessments endpoint filters on end_time__isnull).
                # The report still generates asynchronously, but from the
                # candidate's side the assessment is done — no more Start/Resume.
                # We deliberately DON'T flip status to "completed" here: other
                # endpoints treat status=="completed" as "report ready", which
                # only the report callback should decide.
                candidate_ai_assignment.end_time = django_timezone.now()
                candidate_ai_assignment.save(update_fields=["end_time"])

                return Response(
                    {
                        "status": "processing",
                        "message": "Assessment submitted successfully! Report is being generated. Please wait...",
                        "task_id": task["task_id"],
                        "input_s3_key": handoff_payload["input_s3_key"],
                        "output_prefix": handoff_payload["output_prefix"],
                        "poll_endpoint": f"/api/ai-assessment/{ai_assessment_id}/status/",
                        "expected_wait_time": "2-5 minutes",
                    }
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Assessment handoff/dispatch failed",
                    extra={
                        "ai_assessment_id": ai_assessment_id,
                        "user_id": getattr(request.user, "id", None),
                    },
                )
                return Response(
                    {"status": "error", "message": str(exc)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Http404:
            # Let DRF render the standard 404 JSON for the missing assignment.
            raise
        except PermissionDenied:
            # Let DRF render the standard 403 JSON.
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "SubmitAIAssessmentView unhandled error",
                extra={
                    "ai_assessment_id": ai_assessment_id,
                    "user_id": getattr(request.user, "id", None),
                },
            )
            return Response(
                {
                    "status": "error",
                    "message": "Submission failed due to a server error. Your answers are safe — please contact support.",
                    "error": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIAssessmentResultView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    def get(self, request, ai_assessment_id):
        # select_related on `ai_assessment` avoids an N+1 hit later when the
        # serializer touches the FK during AIAssessmentSerializer(...).data.
        assignment = get_object_or_404(
            CandidateAIAssessment.objects.select_related("ai_assessment"),
            ai_assessment_id=ai_assessment_id,
            candidate=request.user,
        )
        generated_questions = assignment.generated_questions or []
        responses = {
            response.question_number: response
            for response in AIInterviewResponse.objects.filter(candidate_assessment=assignment)
        }

        # Build a verification lookup ONCE instead of scanning the full list
        # inside the per-question loop (was O(N²) — 20 Qs × 20 verifications
        # = 400 ops per request, scales quadratically with question count).
        verification_by_qnum = {}
        for item in (assignment.question_wise_verification or []):
            qnum = item.get("question_number")
            if qnum is not None:
                verification_by_qnum[qnum] = item

        payload = []
        for index, question_data in enumerate(generated_questions, start=1):
            response = responses.get(index)
            verification = verification_by_qnum.get(index)

            # Handle both legacy string format and new dict format
            if isinstance(question_data, str):
                q_text, q_type, q_id = question_data, "text", None
            else:
                q_text = question_data.get("text", "")
                q_type = question_data.get("type", "text")
                q_id = question_data.get("question_id")

            payload.append(
                {
                    "question_number": index,
                    "question_text": q_text,
                    "question_type": q_type,
                    "coding_question_id": q_id,
                    "answer_text": response.answer_text if response else "Not answered",
                    "code_answer": response.code_answer if response else "",
                    "code_language": response.code_language if response else "",
                    "code_execution_results": response.code_execution_results if response else [],
                    "code_marks_earned": response.code_marks_earned if response else 0,
                    "code_marks_total": response.code_marks_total if response else 0,
                    "audio_recording": _audio_presigned_url(response.audio_recording) if response and response.audio_recording else None,
                    "answered": response is not None,
                    "verification": verification,
                }
            )

        # Resolve candidate display name once (the previous `hasattr` ternary
        # called `get_full_name()` even when the `name` attribute existed, so
        # the chained branches were doing more work than necessary).
        candidate_name = (
            getattr(request.user, "name", None)
            or request.user.get_full_name()
            or request.user.username
        )

        return Response(
            {
                "status": "success",
                "assessment": AIAssessmentSerializer(assignment.ai_assessment).data,
                "candidate_assessment": CandidateAIAssessmentSerializer(assignment).data,
                "candidate_name": candidate_name,
                "responses": payload,
            }
        )


class SaveAIAnswerView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    required_roles = ("candidate",)
    
    def post(self, request):
        ai_assessment_id = request.data.get("ai_assessment_id")
        question_number = request.data.get("question_number")
        question_text = (request.data.get("question_text") or "").strip()
        answer_text = (request.data.get("answer") or "").strip()
        question_type = request.data.get("question_type", "text")

        # Coding-specific fields
        code_answer = (request.data.get("code_answer") or "").strip()
        code_language = (request.data.get("code_language") or "").strip()
        coding_question_id = request.data.get("coding_question_id")
        code_execution_results = request.data.get("code_execution_results", [])
        code_marks_earned = request.data.get("code_marks_earned", 0)
        code_marks_total = request.data.get("code_marks_total", 0)

        if not ai_assessment_id or question_number is None:
            return Response(
                {"status": "error", "message": "ai_assessment_id and question_number are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        response_obj, created = AIInterviewResponse.objects.get_or_create(
            candidate_assessment=assignment,
            question_number=question_number,
            defaults={"question_text": question_text},
        )

        if question_text:
            response_obj.question_text = question_text
        response_obj.question_type = question_type

        if question_type == "coding":
            response_obj.code_answer = code_answer
            response_obj.code_language = code_language
            response_obj.answer_text = code_answer  # for AI feedback

            # ✅ Fix: core_563 → 563
            if coding_question_id:
                cq_id_str = str(coding_question_id)
                if cq_id_str.startswith('core_'):
                    response_obj.coding_question_id = int(cq_id_str.replace('core_', ''))
                elif cq_id_str.startswith('ai_'):
                    response_obj.coding_question_id = None
                else:
                    try:
                        response_obj.coding_question_id = int(cq_id_str)
                    except ValueError:
                        response_obj.coding_question_id = None

            # ✅ Save execution results
            if code_execution_results:
                response_obj.code_execution_results = code_execution_results
                response_obj.code_marks_earned = code_marks_earned
                response_obj.code_marks_total = code_marks_total
        else:
            # ✅ Text/conceptual answer
            response_obj.answer_text = answer_text

        if created and assignment.start_time:
            response_obj.response_time = int((timezone.now() - assignment.start_time).total_seconds())

        response_obj.save()

        return Response({"status": "success"})

class TextToSpeechView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request):
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response(
                {"status": "error", "message": "Text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from gtts import gTTS  # noqa: WPS433

            tts = gTTS(text=text, lang="en", slow=False)
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
            tts.save(temp_file.name)
            audio_url = f"/media/tts/{os.path.basename(temp_file.name)}"

            return Response(
                {
                    "status": "success",
                    "url": audio_url,
                    "file_path": temp_file.name,
                }
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UploadAudioChunkView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    required_roles = ("candidate",)

    def post(self, request):
        audio_file = request.FILES.get("audio")
        chunk_index = request.data.get("chunk_index", "0")

        if not audio_file:
            return Response(
                {"status": "error", "message": "No audio chunk uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=os.path.splitext(audio_file.name)[1] or ".webm"
        ) as temp_file:
            for chunk in audio_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name

        try:
            file_size = os.path.getsize(temp_path)
            if file_size < 100:
                logger.warning(f"🎤 [CHUNK] FILE TOO SMALL — {file_size} bytes, skip")
                return Response({
                    "status": "success",
                    "transcript": "",
                    "message": "Audio chunk too small",
                    "chunk_index": chunk_index,
                })

            #transcript = transcribe_audio_chunk_realtime(temp_path)

            return Response({
                "status": "success",
                #"transcript": transcript or "",
                "message": "Real-time chunk transcribed" if transcript else "No speech detected in chunk",
                "chunk_index": chunk_index,
            })

        except Exception as exc:
            logger.error(f"🎤 [CHUNK] ERROR: {exc}")
            return Response(
                {"status": "error", "message": f"Chunk transcription failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            logger.info(f"🎤 [CHUNK] DELETING TEMP FILE: {temp_path}")
            try:
                os.unlink(temp_path)
                logger.info(f"🎤 [CHUNK] TEMP FILE DELETED ✅ — PERMANENTLY SAVE NAHI HUA ❌")
            except OSError:
                pass


class UploadAudioView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    required_roles = ("candidate",)

    def post(self, request):
        audio_file = request.FILES.get("audio")
        ai_assessment_id = request.data.get("ai_assessment_id")
        question_number_raw = request.data.get("question_number")

        if not audio_file:
            return Response(
                {"status": "error", "message": "No audio file uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not ai_assessment_id or not question_number_raw:
            return Response(
                {"status": "error", "message": "ai_assessment_id and question_number are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            question_number = int(question_number_raw)
            assignment = get_object_or_404(
                CandidateAIAssessment,
                ai_assessment_id=ai_assessment_id,
                candidate=request.user,
            )

            # Get question details
            questions = list(assignment.generated_questions or [])
            question_data = questions[question_number - 1] if 0 < question_number <= len(questions) else {}
            if isinstance(question_data, dict):
                question_text = question_data.get("text", "")
                question_type = question_data.get("type", "text")
            else:
                question_text = str(question_data or "")
                question_type = "text"

            response_obj, created = AIInterviewResponse.objects.get_or_create(
                candidate_assessment=assignment,
                question_number=question_number,
                defaults={"question_text": question_text},
            )
            if question_text:
                response_obj.question_text = question_text
            response_obj.question_type = question_type
            if assignment.start_time and (created or not response_obj.response_time):
                response_obj.response_time = int((timezone.now() - assignment.start_time).total_seconds())

            filename = f"ai_{assignment.id}_q{question_number}_{timezone.now().strftime('%Y%m%d%H%M%S')}.webm"
            file_key = f"ai_audio_recordings/{filename}"

            s3_client = get_s3_client()
            audio_file.seek(0)
            s3_client.upload_fileobj(
                audio_file,
                settings.AWS_STORAGE_BUCKET_NAME,
                file_key,
                ExtraArgs={"ContentType": "audio/webm"},
            )

            logger.info("Audio uploaded to S3: bucket=%s key=%s", settings.AWS_STORAGE_BUCKET_NAME, file_key)
            response_obj.audio_recording = file_key
            response_obj.save()

            return Response(
                {
                    "status": "success",
                    "message": "Audio uploaded. It will be transcribed after assessment submission.",
                    "question_number": question_number,
                }
            )

        except ValueError:
            return Response(
                {"status": "error", "message": "Invalid question_number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": f"Upload failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GetPresignedUrlView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [FormParser, MultiPartParser]
    required_roles = ("candidate", "super_admin", "org_admin", "manager")

    def post(self, request):
        ai_assessment_id = request.data.get("ai_assessment_id")
        file_name = request.data.get("file_name", "assessment.webm")
        file_type = request.data.get("file_type", "video/webm")
        use_multipart = str(request.data.get("use_multipart", "false")).lower() == "true"

        try:
            s3_client = get_s3_client()

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_key = f"{request.user.email}/assessment_videos/{ai_assessment_id}_{timestamp}.webm"

            assignment = get_object_or_404(
                CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
            )

            if use_multipart:
                multipart_upload = s3_client.create_multipart_upload(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=file_key,
                    ContentType=file_type,
                )
                upload_id = multipart_upload["UploadId"]
                s3_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"
                assignment.interview_video_url = s3_url
                assignment.save(update_fields=["interview_video_url"])

                return Response(
                    {
                        "upload_id": upload_id,
                        "file_key": file_key,
                        "s3_url": s3_url,
                        "multipart": True,
                    }
                )

            presigned_post = s3_client.generate_presigned_post(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                Fields={"Content-Type": file_type},
                Conditions=[["content-length-range", 0, 1024 * 1024 * 1024]],
                ExpiresIn=7200,
            )

            upload_url = presigned_post["url"]
            if settings.AWS_S3_REGION_NAME not in upload_url:
                upload_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/"

            s3_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"
            assignment.interview_video_url = s3_url
            assignment.save(update_fields=["interview_video_url"])

            return Response(
                {
                    "url": upload_url,
                    "fields": presigned_post["fields"],
                    "file_key": file_key,
                    "s3_url": s3_url,
                    "multipart": False,
                }
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

@method_decorator(csrf_exempt, name='dispatch')
class GetPresignedDownloadUrlView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    authentication_classes = [JWTAuthentication]  # JWT only, no CSRF
    required_roles = ("super_admin", "org_admin", "manager")

    def post(self, request):
        file_url = request.data.get("file_url")

        if not file_url:
            return Response(
                {"error": "file_url is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            s3_client = get_s3_client()

            if 'amazonaws.com/' in file_url:
                s3_key = file_url.split('amazonaws.com/')[-1]
                s3_key = s3_key.split('?')[0]
            else:
                return Response(
                    {"error": "Invalid S3 URL format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': s3_key,
                },
                ExpiresIn=300
            )

            return Response({"url": presigned_url})

        except Exception as exc:
            logger.exception("Failed to generate presigned download URL")
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
class CheckAssessmentStatusView(RolePermissionMixin, APIView):
    """Check the status of background tasks for an AI assessment"""
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    def get(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        # Check completion status
        has_intro = bool(assignment.introduction_video or assignment.introduction_video_url)
        has_interview_video = bool(assignment.interview_video or assignment.interview_video_url or assignment.assessment_video_url)
        responses_count = AIInterviewResponse.objects.filter(candidate_assessment=assignment).count()
        expected_questions = len(assignment.generated_questions or []) or assignment.ai_assessment.num_questions

        status_info = {
            "assignment_id": assignment.id,
            "assessment_status": assignment.status,
            "has_intro_video": has_intro,
            "has_interview_video": has_interview_video,
            "responses_count": responses_count,
            "expected_questions": expected_questions,
            "all_uploads_complete": has_intro and has_interview_video and responses_count >= expected_questions,
            "report_ready": assignment.status == "completed",
        }

        if assignment.status == "completed":
            status_info.update({
                "overall_score": assignment.overall_score,
                "technical_score": assignment.technical_score,
                "communication_score": assignment.communication_score,
                "problem_solving_score": assignment.problem_solving_score,
                "ai_feedback": assignment.ai_feedback,
                "message": "Report is ready! You can now view your detailed assessment results.",
            })
        elif assignment.status == "in_progress":
            status_info.update({
                "message": "Assessment is in progress. Report generation is underway. Please check back shortly.",
            })

        return Response({
            "status": "success",
            "data": status_info
        })


@method_decorator(csrf_exempt, name="dispatch")
class CeleryAssessmentCallbackView(APIView):
    """Receive S3-only Celery results and apply them through Django ORM."""

    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    authentication_classes = []

    def post(self, request):
        webhook_secret = getattr(settings, "WEBHOOK_SECRET", "")
        if webhook_secret:
            supplied = request.query_params.get("secret") or request.headers.get("X-Webhook-Secret", "")
            if not constant_time_compare(supplied, webhook_secret):
                return Response(
                    {"status": "error", "message": "Invalid webhook secret."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        callback_payload = request.data if isinstance(request.data, dict) else {}
        logger.info(
            "Celery assessment callback received",
            extra={"callback_keys": sorted(callback_payload.keys())},
        )
        result_key = extract_result_key(callback_payload)
        if callback_payload.get("error") and not result_key:
            metadata = callback_payload.get("metadata") or {}
            error_text = str(callback_payload.get("error") or "Unknown error")
            logger.error(
                "Celery assessment failure callback received",
                extra={
                    "error": error_text,
                    "metadata": metadata,
                },
            )

            # ---------------------------------------------------------
            # Mark the assignment as completed-with-fallback so the
            # frontend doesn't poll forever. Without this branch, every
            # Celery failure left the assignment in `in_progress` and
            # candidates were stuck on "Report is being generated".
            # ---------------------------------------------------------
            assignment_id = None
            for source in (metadata, callback_payload):
                if isinstance(source, dict):
                    for key in ("assignment_id", "assignmentId"):
                        if source.get(key) is not None:
                            try:
                                assignment_id = int(source[key])
                            except (TypeError, ValueError):
                                assignment_id = None
                            if assignment_id:
                                break
                if assignment_id:
                    break

            if assignment_id:
                try:
                    with celery_system_context(), transaction.atomic():
                        assignment = (
                            CandidateAIAssessment.objects
                            .all_for_super_admin()
                            .select_for_update()
                            .get(id=assignment_id)
                        )
                        if assignment.status != "completed":
                            assignment.status = "completed"
                            assignment.end_time = django_timezone.now()
                            # Preserve any partial scoring; fill in a friendly
                            # message so the result page renders something useful.
                            if not (assignment.ai_feedback or "").strip():
                                assignment.ai_feedback = (
                                    "Report generation encountered a temporary issue. "
                                    "Your answers have been recorded. Please contact "
                                    "support if you need a re-run."
                                )
                            assignment.save(update_fields=[
                                "status", "end_time", "ai_feedback",
                            ])
                            logger.info(
                                "Marked assignment %s completed via failure-callback fallback",
                                assignment_id,
                            )
                except CandidateAIAssessment.DoesNotExist:
                    logger.warning(
                        "Failure-callback referenced an unknown assignment_id=%s",
                        assignment_id,
                    )
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "Failed to apply failure-callback fallback for assignment_id=%s",
                        assignment_id,
                    )

            return Response(
                {
                    "status": "accepted",
                    "message": "Celery failure callback recorded.",
                    "assignment_id": assignment_id,
                    "error": error_text,
                },
                status=status.HTTP_202_ACCEPTED,
            )
        if not result_key:
            return Response(
                {"status": "error", "message": "No S3 result key found in callback payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            logger.info("Loading Celery assessment result from S3", extra={"result_s3_key": result_key})
            result_payload = get_handoff_json(result_key)
            nested_result_key = extract_result_key(result_payload)
            if nested_result_key and nested_result_key != result_key:
                logger.info(
                    "Loading nested Celery assessment result from S3",
                    extra={"result_s3_key": nested_result_key},
                )
                result_payload = get_handoff_json(nested_result_key)

            applied = apply_celery_result(result_payload)
            logger.info(
                "Celery assessment result applied",
                extra={"result_s3_key": result_key, "applied": applied},
            )
            return Response(
                {
                    "status": "success",
                    "message": "Celery result applied.",
                    "result_s3_key": result_key,
                    "applied": applied,
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to apply Celery assessment callback")
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GenerateAssessmentReportView(RolePermissionMixin, APIView):
    """Manually trigger report generation after all uploads are complete"""
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    def post(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        if assignment.status == "completed":
            return Response({
                "status": "success",
                "message": "Assessment already completed.",
                "data": {
                    "overall_score": assignment.overall_score,
                    "technical_score": assignment.technical_score,
                    "communication_score": assignment.communication_score,
                    "problem_solving_score": assignment.problem_solving_score,
                }
            })

        # Check if all required components are uploaded
        has_intro = bool(assignment.introduction_video or assignment.introduction_video_url)
        has_interview_video = bool(assignment.interview_video or assignment.interview_video_url or assignment.assessment_video_url)
        responses_count = AIInterviewResponse.objects.filter(candidate_assessment=assignment).count()
        expected_questions = len(assignment.generated_questions or []) or assignment.ai_assessment.num_questions

        if not (has_intro and has_interview_video and responses_count >= expected_questions):
            return Response({
                "status": "error",
                "message": "All uploads must be completed before generating report.",
                "details": {
                    "has_intro_video": has_intro,
                    "has_interview_video": has_interview_video,
                    "responses_count": responses_count,
                    "expected_questions": expected_questions,
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = dispatch_background_task(
                "generate_ai_report",
                {"assignment_id": assignment.id},
                user_role=getattr(request.user, "role", None),
            )

            return Response({
                "status": "success",
                "message": "Report generation queued.",
                "task_id": result['task_id'],
            })
        except Exception as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
# class UploadScreenshotView(RolePermissionMixin, APIView):
#     permission_classes = [IsAuthenticated]
#     parser_classes = [MultiPartParser, FormParser]
#     required_roles = ("candidate",)

#     def post(self, request):
#         ai_assessment_id = request.data.get("ai_assessment_id")
#         screenshot_file = request.FILES.get("screenshot")
#         timestamp_value = request.data.get("timestamp", "")

#         if not screenshot_file:
#             return Response(
#                 {"status": "error", "message": "No screenshot provided."},
#                 status=status.HTTP_400_BAD_REQUEST,
#             )

#         assignment = get_object_or_404(
#             CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
#         )

#         screenshot_url = None
#         if getattr(settings, "USE_S3", False):
#             screenshot_url = s3_handler.upload_periodic_image(screenshot_file, request.user.email)

#         if not screenshot_url:
#             filename = f"screenshots/{request.user.id}/{ai_assessment_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
#             filepath = default_storage.save(filename, screenshot_file)
#             screenshot_url = default_storage.url(filepath)

#         periodic = assignment.periodic_screenshots or []
#         periodic.append(
#             {
#                 "url": screenshot_url,
#                 "timestamp": timestamp_value,
#                 "captured_at": datetime.now().isoformat(),
#                 "storage_type": "s3" if getattr(settings, "USE_S3", False) else "local",
#             }
#         )
#         assignment.periodic_screenshots = periodic
#         assignment.save(update_fields=["periodic_screenshots"])

#         return Response(
#             {
#                 "status": "success",
#                 "screenshot_url": screenshot_url,
#                 "screenshot_count": len(periodic),
#             }
#         )


class UploadIntroductionVideoView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    required_roles = ("candidate",)

    def post(self, request):
        ai_assessment_id = request.data.get("ai_assessment_id")
        s3_url = request.data.get("s3_url")
        video_file = request.FILES.get("video_file")

        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        if s3_url:
            # S3 presigned URL flow — save the URL
            assignment.introduction_video_url = s3_url
            assignment.save(update_fields=["introduction_video_url"])
            return Response(
                {
                    "status": "success",
                    "message": "Introduction video URL saved successfully.",
                    "video_url": s3_url,
                }
            )
        elif video_file:
            # Direct file upload — try S3 first, fall back to local storage
            # Read file content into memory first to avoid "I/O operation on closed file" on Windows
            file_content = video_file.read()
            file_name = video_file.name or "introduction.webm"
            content_type = video_file.content_type or "video/webm"
            video_url = None

            if getattr(settings, "USE_S3", False):
                try:
                    s3_client = get_s3_client()
                    file_key = f"{request.user.email}/introduction_video/intro_{assignment.id}.webm"
                    from io import BytesIO
                    s3_client.upload_fileobj(
                        BytesIO(file_content),
                        settings.AWS_STORAGE_BUCKET_NAME,
                        file_key,
                        ExtraArgs={"ContentType": content_type},
                    )
                    video_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"
                except Exception as exc:
                    logger.warning(f"S3 upload failed, falling back to local storage: {exc}")
                    video_url = None

            if video_url:
                assignment.introduction_video_url = video_url
                assignment.save(update_fields=["introduction_video_url"])
            else:
                assignment.introduction_video.save(
                    file_name, ContentFile(file_content), save=True
                )
                video_url = request.build_absolute_uri(assignment.introduction_video.url)

            return Response(
                {
                    "status": "success",
                    "message": "Introduction video uploaded successfully.",
                    "video_url": video_url,
                }
            )
        else:
            return Response(
                {"status": "error", "message": "Either s3_url or video_file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class GetPresignedUrlIntroView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [FormParser, MultiPartParser]
    required_roles = ("candidate",)

    def post(self, request):
        ai_assessment_id = request.data.get("ai_assessment_id")
        file_name = request.data.get("file_name", "introduction.webm")
        file_type = request.data.get("file_type", "video/webm")

        if not getattr(settings, "USE_S3", False):
            return Response(
                {"error": "S3 is not configured. Use direct upload instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            s3_client = get_s3_client()

            assignment = get_object_or_404(
                CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
            )

            file_key = f"{request.user.email}/introduction_video/intro_{assignment.id}.webm"

            presigned_post = s3_client.generate_presigned_post(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                # Fields={"Content-Type": file_type},
                Conditions=[["content-length-range", 0, 100 * 1024 * 1024]],
                ExpiresIn=1800,
            )

            upload_url = presigned_post["url"]
            if settings.AWS_S3_REGION_NAME not in upload_url:
                upload_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/"

            s3_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"

            return Response(
                {
                    "url": upload_url,
                    "fields": presigned_post["fields"],
                    "file_key": file_key,
                    "s3_url": s3_url,
                }
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GetVideoPartPresignedUrlView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    required_roles = ("candidate",)

    def post(self, request):
        upload_id = request.data.get("upload_id")
        file_key = request.data.get("file_key")
        part_number = request.data.get("part_number")

        if not all([upload_id, file_key, part_number]):
            return Response(
                {"error": "upload_id, file_key, and part_number are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            part_number = int(part_number)
        except ValueError:
            return Response(
                {"error": "part_number must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            s3_client = get_s3_client()
            presigned_url = s3_client.generate_presigned_url(
                ClientMethod="upload_part",
                Params={
                    "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                    "Key": file_key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=3600,
            )

            return Response(
                {
                    "presigned_url": presigned_url,
                }
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UploadVideoChunkView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    required_roles = ("candidate",)

    def post(self, request):
        upload_id = request.data.get("upload_id")
        file_key = request.data.get("file_key")
        chunk_index = int(request.data.get("chunk_index", 1))
        chunk_file = request.FILES.get("chunk")

        if not all([upload_id, file_key, chunk_file]):
            return Response(
                {"error": "upload_id, file_key, and chunk are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            s3_client = get_s3_client()

            response = s3_client.upload_part(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                PartNumber=chunk_index,
                UploadId=upload_id,
                Body=chunk_file.read(),
            )

            return Response(
                {
                    "status": "success",
                    "chunk_index": chunk_index,
                    "etag": response["ETag"],
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Chunk Upload video upload failed due to :{exc}")

            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CompleteMultipartUploadView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    required_roles = ("candidate",)

    def post(self, request):
        upload_id = request.data.get("upload_id")
        file_key = request.data.get("file_key")
        parts = request.data.get("parts", [])
        ai_assessment_id = request.data.get("ai_assessment_id")

        if not all([upload_id, file_key, parts, ai_assessment_id]):
            return Response(
                {"error": "upload_id, file_key, parts, and ai_assessment_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            s3_client = get_s3_client()

            s3_client.complete_multipart_upload(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                UploadId=upload_id,
                MultipartUpload={"Parts": parts},
            )

            assignment = get_object_or_404(
                CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
            )
            s3_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"
            assignment.interview_video_url = s3_url
            assignment.save(update_fields=["interview_video_url"])
            
            logger.info("CompleteMultipartUploadView and remux_webm_in_background: job start *********")
            remux_webm_in_background(s3_client, settings.AWS_STORAGE_BUCKET_NAME, file_key)
            logger.info("CompleteMultipartUploadView and remux_webm_in_background: job start *********")

            return Response(
                {
                    "status": "success",
                    "s3_url": s3_url,
                }
            )
        except Exception as exc:  # noqa: BLE001
            try:
                s3_client.abort_multipart_upload(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=file_key,
                    UploadId=upload_id,
                )
            except Exception:  # pragma: no cover - best effort cleanup
                pass
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UploadAIVideoView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    required_roles = ("candidate",)

    def post(self, request):
        logger.info("UploadAIVideoView: job start *********")
        ai_assessment_id = request.data.get("ai_assessment_id")
        s3_url = request.data.get("s3_url")
        video_file = request.FILES.get("video_file")

        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )

        try:
            if s3_url:
                assignment.assessment_video_url = s3_url
                assignment.save(update_fields=["assessment_video_url"])
                return Response(
                    {
                        "status": "success",
                        "message": "Video URL saved successfully.",
                        "video_url": s3_url,
                    }
                )
            elif video_file:
                file_content = video_file.read()
                file_name = video_file.name or "interview.webm"
                content_type = video_file.content_type or "video/webm"
                video_url = None

                if getattr(settings, "USE_S3", False):
                    try:
                        s3_client = get_s3_client()
                        file_key = f"{request.user.email}/interview_video/interview_{assignment.id}.webm"
                        s3_client.upload_fileobj(
                            BytesIO(file_content),
                            settings.AWS_STORAGE_BUCKET_NAME,
                            file_key,
                            ExtraArgs={"ContentType": content_type},
                        )
                        video_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{file_key}"
                        logger.info("remux_webm_in_background: job start *********")
                        remux_webm_in_background(s3_client, settings.AWS_STORAGE_BUCKET_NAME, file_key)
                        logger.info("remux_webm_in_background: job END *********")
                    except Exception as exc:
                        logger.warning("S3 upload failed for interview video, using local storage: %s", exc)
                        video_url = None

                if video_url:
                    assignment.interview_video_url = video_url
                    assignment.save(update_fields=["interview_video_url"])
                else:
                    assignment.interview_video.save(file_name, ContentFile(file_content), save=True)
                    video_url = request.build_absolute_uri(assignment.interview_video.url)

                logger.info("UploadAIVideoView: job END *********")

                return Response(
                    {
                        "status": "success",
                        "message": "Interview video uploaded successfully.",
                        "video_url": video_url,
                    }
                )
            else:
                return Response(
                    {"status": "error", "message": "Either s3_url or video_file is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# class AnalyzeFrameView(RolePermissionMixin, APIView):
#     permission_classes = [IsAuthenticated]
#     parser_classes = [JSONParser]
#     required_roles = ("candidate",)

#     def post(self, request):
#         ai_assessment_id = request.data.get("ai_assessment_id")
#         image_data = request.data.get("image_data")

#         if not image_data:
#             return Response(
#                 {"status": "error", "message": "image_data is required."},
#                 status=status.HTTP_400_BAD_REQUEST,
#             )

#         assignment = get_object_or_404(
#             CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
#         )

#         try:
#             from AI_assessment.gesture_analysis import get_detector  # noqa: WPS433

#             detector = get_detector()
#             result = detector.analyze_frame(image_data)

#             if result.get("status") == "success":
#                 analysis = result.get("analysis")
#                 alerts = result.get("alerts", [])

#                 if alerts:
#                     cheating_alerts = assignment.cheating_alerts or []
#                     cheating_alerts.extend(alerts)
#                     assignment.cheating_alerts = cheating_alerts
#                     assignment.save(update_fields=["cheating_alerts"])

#                 communication_metrics = assignment.communication_metrics or {}
#                 communication_metrics.setdefault("frame_analyses", []).append(analysis)
#                 communication_metrics["frame_analyses"] = communication_metrics["frame_analyses"][-100:]
#                 assignment.communication_metrics = communication_metrics
#                 assignment.save(update_fields=["communication_metrics"])

#             return Response(result)
#         except Exception as exc:  # noqa: BLE001
#             return Response(
#                 {"status": "error", "message": str(exc)},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             )

class PrepareQuestionsAsyncView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    # Stuck-status recovery: if a background generation has been
    # 'processing' for longer than this and no questions have landed,
    # treat the thread as dead (process restart, OOM, Gemini hang) and
    # let the next /prepare/ call re-trigger. Without this the
    # candidate is stuck on the loader forever.
    STUCK_THRESHOLD = timedelta(minutes=2)

    def _is_stuck(self, assignment) -> bool:
        if assignment.questions_generation_status != 'processing':
            return False
        if assignment.generated_questions:  # got at least some, not stuck
            return False
        ref = assignment.start_time or assignment.assigned_date
        if not ref:
            return False
        return timezone.now() - ref > self.STUCK_THRESHOLD

    def post(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )
        current_status = getattr(assignment, 'questions_generation_status', 'pending')

        # Auto-recovery: a stale 'processing' state means the background
        # thread is dead. Reset to 'pending' so the trigger below fires
        # again on the same call instead of returning already_started
        # and trapping the candidate on the loader.
        if current_status == 'processing' and self._is_stuck(assignment):
            logger.warning(
                "[AI QUESTIONS API] Stale 'processing' status detected, resetting to 'pending' for re-trigger: "
                "assignment=%s ref_time=%s generated_count=%s",
                assignment.id,
                (assignment.start_time or assignment.assigned_date),
                len(assignment.generated_questions or []),
            )
            assignment.questions_generation_status = 'pending'
            assignment.save(update_fields=['questions_generation_status'])
            current_status = 'pending'

        if current_status == 'pending':
            assignment.questions_generation_status = 'processing'
            assignment.save(update_fields=['questions_generation_status'])

            from AI_assessment.tasks import generate_questions_async
            threading.Thread(
                target=generate_questions_async,
                args=(assignment.id,),
                daemon=True
            ).start()

            print(f"🚀 [EARLY] Generation started for assignment {assignment.id}")
            logger.info(
                "[AI QUESTIONS API] Early async question generation triggered: assignment=%s assessment=%s candidate=%s existing_count=%s",
                assignment.id,
                assignment.ai_assessment_id,
                assignment.candidate_id,
                len(assignment.generated_questions or []),
            )
            return Response({'status': 'triggered'})

        logger.info(
            "[AI QUESTIONS API] Early async question generation not triggered: assignment=%s current_status=%s existing_count=%s",
            assignment.id,
            current_status,
            len(assignment.generated_questions or []),
        )
        return Response({'status': 'already_started', 'current': current_status})


class CheckQuestionsReadyView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("candidate",)

    def get(self, request, ai_assessment_id):
        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=ai_assessment_id, candidate=request.user
        )
        ai = assignment.ai_assessment
        effective_total = max(ai.num_questions, len(ai.hardcoded_question_ids or []))
        questions_status = getattr(assignment, 'questions_generation_status', 'pending')
        has_enough = (
            assignment.generated_questions and
            len(assignment.generated_questions) >= effective_total
        )

        # Auto-fix: questions exist but status stuck
        if has_enough and questions_status != 'completed':
            assignment.questions_generation_status = 'completed'
            assignment.save(update_fields=['questions_generation_status'])
            questions_status = 'completed'

        logger.info(
            "[AI QUESTIONS API] Candidate readiness check: assignment=%s ready=%s status=%s generated_count=%s total_needed=%s sources=%s",
            assignment.id,
            bool(has_enough and questions_status == 'completed'),
            questions_status,
            len(assignment.generated_questions or []),
            effective_total,
            _question_source_counts(assignment.generated_questions),
        )

        return Response({
            'ready': has_enough and questions_status == 'completed',
            'status': questions_status,
            'generated_count': len(assignment.generated_questions or []),
            'total_needed': effective_total,
        })




class SaveProctoringIncidentView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    required_roles = ("candidate",)

    def post(self, request):
        assessment_id = request.data.get("assessment_id")
        incident_type = request.data.get("incident_type")
        details = request.data.get("details")
        severity = request.data.get("severity", "medium")
        send_email_flag = str(request.data.get("send_email", "false")).lower() == "true"
        screenshot = request.FILES.get("screenshot")

        # Only ignore purely object-detection "phone" related incidents by default.
        # Camera-based incidents (multiple_faces, looking_away, no_face, gaze) should be recorded.
        disabled_types = {"phone_detected", "phone_usage"}
        if incident_type in disabled_types:
            return Response(
                {
                    "status": "ignored",
                    "message": f"Incident '{incident_type}' ignored (type disabled).",
                }
            )

        assignment = get_object_or_404(
            CandidateAIAssessment, ai_assessment_id=assessment_id, candidate=request.user
        )

        # If the assessment has camera-based proctoring disabled, ignore camera incidents
        camera_incidents = {"multiple_faces", "gaze", "looking_away", "no_face", "suspicious_eye_movement"}
        if not getattr(assignment.ai_assessment, "enable_camera", True) and incident_type in camera_incidents:
            return Response(
                {
                    "status": "ignored",
                    "message": f"Camera-based proctoring disabled for assessment {assignment.ai_assessment.id}. Incident '{incident_type}' ignored.",
                }
            )

        screenshot_url = None
        if screenshot and getattr(settings, "USE_S3", False):
            s3_client = get_s3_client()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            s3_key = f"{request.user.email}/proctoring_screenshots/{incident_type}_{timestamp}.jpg"
            try:
                s3_client.upload_fileobj(
                    screenshot,
                    settings.AWS_STORAGE_BUCKET_NAME,
                    s3_key,
                    ExtraArgs={"ContentType": "image/jpeg"},
                )
                screenshot_url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{s3_key}"
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Screenshot upload failed",
                    extra={
                        "assignment_id": assignment.id,
                        "ai_assessment_id": assignment.ai_assessment_id,
                    },
                )

        if screenshot and not screenshot_url:
            filename = f"proctoring/ai_{assessment_id}_{request.user.id}_{timezone.now().timestamp()}.jpg"
            saved_path = default_storage.save(filename, screenshot)
            screenshot_url = default_storage.url(saved_path)

        cheating_alerts = assignment.cheating_alerts or []
        alert_payload = {
            "type": incident_type,
            "severity": severity,
            "message": details,
            "timestamp": timezone.now().isoformat(),
            "screenshot_url": screenshot_url,
        }
        cheating_alerts.append(alert_payload)
        assignment.cheating_alerts = cheating_alerts

        if screenshot_url:
            screenshots = assignment.screenshots or []
            screenshots.append(screenshot_url)
            assignment.screenshots = screenshots

        # Update counters based on incident type
        # Accept both 'gaze' and frontend 'looking_away' as gaze violations
        update_fields = ["cheating_alerts", "screenshots", "total_proctor_warnings"]

        if incident_type == "multiple_faces":
            assignment.multiple_faces_count += 1
            update_fields.append("multiple_faces_count")

        elif incident_type in {"gaze", "looking_away", "suspicious_eye_movement"}:
            assignment.gaze_violation_count += 1
            update_fields.append("gaze_violation_count")

        elif incident_type == "no_face":
            # newly added field to track no-face detections
            assignment.no_face_detection_count += 1
            update_fields.append("no_face_detection_count")

        # increment total warnings for any recorded incident
        assignment.total_proctor_warnings += 1

        # Save only updated fields
        assignment.save(update_fields=update_fields)

        if send_email_flag:
            subject_candidate = f"⚠️ Proctoring Alert - {incident_type.replace('_', ' ').title()}"
            message_candidate = (
                "Dear {name},\n\n"
                "A proctoring incident has been detected during your AI Assessment: {assessment}\n\n"
                "Incident Type: {incident}\nDetails: {details}\nTime: {time}\n\n"
                "Please ensure you follow the assessment guidelines.\n\nBest regards,\nAssessment Team"
            ).format(
                name=assignment.candidate.get_full_name(),
                assessment=assignment.ai_assessment.title,
                incident=incident_type.replace("_", " ").title(),
                details=details,
                time=timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
            )

            try:
                send_mail(
                    subject_candidate,
                    message_candidate,
                    settings.DEFAULT_FROM_EMAIL,
                    [assignment.candidate.email],
                    fail_silently=False,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Failed to send candidate proctoring email",
                    extra={
                        "assignment_id": assignment.id,
                        "candidate_id": assignment.candidate_id,
                        "ai_assessment_id": assignment.ai_assessment_id,
                    },
                )

            admin_subject = f"🚨 Proctoring Alert - {assignment.candidate.get_full_name()}"
            admin_message = (
                "Assessment: {assessment}\n"
                "Candidate: {candidate} ({email})\n"
                "Incident Type: {incident}\n"
                "Severity: {severity}\n"
                "Details: {details}\n"
                "Time: {time}\n"
                "Screenshot: {screenshot}\n"
                "Report: {report_url}"
            ).format(
                assessment=assignment.ai_assessment.title,
                candidate=assignment.candidate.get_full_name(),
                email=assignment.candidate.email,
                incident=incident_type.replace("_", " ").title(),
                severity=severity.upper(),
                details=details,
                time=timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
                screenshot=screenshot_url or "Not available",
                report_url=request.build_absolute_uri(
                    f"/my-admin/ai-assessments/candidate/{assignment.id}/report/"
                ),
            )

            try:
                send_mail(
                    admin_subject,
                    admin_message,
                    settings.DEFAULT_FROM_EMAIL,
                    [assignment.ai_assessment.created_by.email],
                    fail_silently=False,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Failed to send admin proctoring email",
                    extra={
                        "assignment_id": assignment.id,
                        "ai_assessment_id": assignment.ai_assessment_id,
                    },
                )

        return Response(
            {
                "status": "success",
                "message": "Proctoring incident saved successfully.",
                "screenshot_url": screenshot_url,
                "multiple_faces_count": getattr(assignment, "multiple_faces_count", 0),
                "gaze_violation_count": getattr(assignment, "gaze_violation_count", 0),
                "no_face_detection_count": getattr(assignment, "no_face_detection_count", 0),
                "total_proctor_warnings": getattr(assignment, "total_proctor_warnings", 0),
            }
        )


class CreateHardcodedQuestionView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")
    
    def post(self, request):
        print(" Request user role:", getattr(request.user, 'role', 'No role'))
        
        data = request.data
        title = data.get('title', '').strip()
        stack = data.get('stack', '').strip()
        description = data.get('description', '').strip()
        difficulty = data.get('difficulty', 'medium')
        
        # Validation
        if not title:
            
            return Response(
                {'error': 'Question title is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            
            question = MockQuestion.objects.create(
                text=title,
                ideal_answer=description,
                stack=stack,
                difficulty=difficulty
            )
            
            return Response(
                {
                    'id': question.id,
                    'message': 'AI Mock question created successfully'
                }, 
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DeleteAIMockQuestionView(RolePermissionMixin, APIView):
    permission_classes = [IsAuthenticated]
    required_roles = ("super_admin", "org_admin", "manager")
    
    def delete(self, request, question_id):
        from mock_interview.models import Question as MockQuestion
        from django.shortcuts import get_object_or_404
        
        question = get_object_or_404(MockQuestion, id=question_id)
        question.delete()
        return Response({"status": "success"}, status=200)
