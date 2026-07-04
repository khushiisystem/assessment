from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models.functions import Lower
import time
from django.db import models
import logging

from core.views import CandidatePermission
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import CandidateInterviewer, Question, InterviewTemplate, Candidate, MockSession
from .serializers import (
    QuestionSerializer, QuestionCreateSerializer,
    InterviewTemplateSerializer, InterviewTemplateCreateSerializer,
    CandidateSerializer, CandidateCreateSerializer,
    MockSessionSerializer, MockSessionCreateSerializer, MockSessionUpdateSerializer,
    CandidateAnalyticsSerializer
)
logger = logging.getLogger(__name__)


def is_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_superuser
            or getattr(user, "role", None) == "super_admin"
        )
    )


def tenant_queryset(model, request):
    if is_super_admin(request.user):
        return model.objects.all_for_super_admin()
    return model.objects.filter(organization_id=request.user.organization_id)


# --- Tech Stacks ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tech_stacks(request):
    """Get distinct tech stacks from questions (case-insensitive deduplicated)"""
    logger.info("Fetching distinct tech stacks")
    all_stacks = tenant_queryset(Question, request).values_list('stack', flat=True)
    seen = {}
    for s in all_stacks:
        if s:
            key = s.strip().lower()
            if key not in seen:
                seen[key] = s.strip()
    stacks = sorted(seen.values(), key=str.lower)
    logger.info(f"Returning {len(stacks)} tech stacks")
    return Response(stacks)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_tech_stack(request):
    """Dummy endpoint - stacks are derived from questions"""
    name = request.data.get('name', '')
    logger.info(f"Add tech stack requested", extra={"user_id": request.user.id, "stack_name": name})
    return Response({"message": f"Stack '{name}' noted. Stacks are managed via questions."})


# --- Questions ---
class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return QuestionCreateSerializer
        return QuestionSerializer

    def get_queryset(self):
        return tenant_queryset(Question, self.request)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data
        if not isinstance(ids, list):
            return Response({"error": "Expected list of IDs"}, status=status.HTTP_400_BAD_REQUEST)
        deleted_count = Question.objects.filter(id__in=ids).delete()[0]
        logger.info(f"Questions bulk deleted", extra={"user_id": request.user.id, "deleted_count": deleted_count})
        return Response({"ok": True, "deleted": deleted_count})

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create(self, request):
        if not isinstance(request.data, list):
            logger.warning("Invalid JSON format for bulk create", extra={"user_id": request.user.id})
            return Response(
                {"error": "Invalid JSON format. Please ensure it is a valid array of objects."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = QuestionCreateSerializer(data=request.data, many=True)
        if serializer.is_valid():
            questions = serializer.save(organization=request.user.organization)
            logger.info(f"Questions bulk created", extra={"user_id": request.user.id, "created_count": len(questions)})
            return Response(QuestionSerializer(questions, many=True).data, status=status.HTTP_201_CREATED)
        logger.warning("Question bulk create validation failed", extra={"user_id": request.user.id, "errors": serializer.errors})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- Templates ---
class InterviewTemplateViewSet(viewsets.ModelViewSet):
    queryset = InterviewTemplate.objects.all()
    serializer_class = InterviewTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewTemplateCreateSerializer
        return InterviewTemplateSerializer

    def get_queryset(self):
        return tenant_queryset(InterviewTemplate, self.request)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        logger.info("Interview template create attempt", extra={"user_id": request.user.id, "template_name": name})
        if not name:
            logger.warning("Template name missing", extra={"user_id": request.user.id})
            return Response({"error": "Template name is required"}, status=status.HTTP_400_BAD_REQUEST)
        logger.info(f"Interview template created successfully", extra={"user_id": request.user.id, "template_name": name})
        return super().create(request, *args, **kwargs)


# --- Sessions ---
class MockSessionViewSet(viewsets.ModelViewSet):
    queryset = MockSession.objects.all()
    serializer_class = MockSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return tenant_queryset(MockSession, self.request)

    def create(self, request, *args, **kwargs):
        logger.info("Mock session create attempt", extra={"user_id": request.user.id})
        serializer = MockSessionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("Mock session create validation failed", extra={"user_id": request.user.id, "errors": serializer.errors})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Resolve registered user if user_id provided
        User = get_user_model()
        user_id = data.get('user_id')
        registered_user = None
        if user_id:
            try:
                registered_user = User.objects.get(id=user_id)
                # Override candidate name/email with registered user's data
                name = getattr(registered_user, 'name', '') or registered_user.get_full_name() or registered_user.username
                data['candidate_name'] = name
                data['candidate_email'] = registered_user.email
                logger.info(f"Registered user found", extra={"user_id": request.user.id, "registered_user_id": user_id})
            except User.DoesNotExist:
                logger.warning(f"Registered user not found", extra={"user_id": request.user.id, "registered_user_id": user_id})

        candidate_name = data.get('candidate_name') or 'Unknown'
        candidate = None

        candidate_interviewer_name = data.get('candidate_interviewer_name') or 'Unknown Interviewer'
        candidate_interviewer_email = data.get('candidate_interviewer_email') or None
        candidate_interviewer = None

        # Check if candidate exists by email first
        if data.get('candidate_email'):
            candidate = Candidate.objects.filter(email=data['candidate_email']).first()

        if data.get('candidate_interviewer_email'):
            candidate_interviewer = CandidateInterviewer.objects.filter(email=data['candidate_interviewer_email']).first()

        # Try to find by name (case-insensitive)
        if not candidate and candidate_name:
            candidate = Candidate.objects.annotate(
                name_lower=Lower('name')
            ).filter(name_lower=candidate_name.lower()).first()

        if not candidate_interviewer and candidate_interviewer_name:
            candidate_interviewer = CandidateInterviewer.objects.annotate(
                name_lower=Lower('name')
            ).filter(name_lower=candidate_interviewer_name.lower()).first()

        # Create new candidate if not found
        if not candidate:
            email = data.get('candidate_email') or f"{candidate_name.lower().replace(' ', '.')}@example.com"
            candidate = Candidate.objects.create(
                name=candidate_name,
                email=email,
                organization=request.user.organization,
            )
            logger.info(f"New candidate created", extra={"user_id": request.user.id, "candidate_name": candidate_name})

        if not candidate_interviewer:
            email = data.get('candidate_interviewer_email') or f"{candidate_interviewer_name.lower().replace(' ', '.')}@example.com"
            candidate_interviewer = CandidateInterviewer.objects.create(
                name=candidate_interviewer_name,
                email=email,
                organization=request.user.organization,
            )
            logger.info(f"New interviewer created", extra={"user_id": request.user.id, "interviewer_name": candidate_interviewer_name})

        # Create the session
        session = MockSession.objects.create(
            candidate_name=candidate_name,
            candidate_email=data.get('candidate_email'),
            candidate=candidate,
            candidate_interviewer_name=candidate_interviewer_name,
            candidate_interviewer_email=candidate_interviewer_email,
            candidate_interviewer=candidate_interviewer,
            registered_user=registered_user,
            scheduled_at=data.get('scheduled_at'),
            stack=data['stack'],
            version_label=data['version_label'],
            questions=data['questions'],
            responses={},
            organization=request.user.organization,
        )

        logger.info(f"Mock session created successfully", extra={"user_id": request.user.id, "session_id": session.id})
        return Response(MockSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = MockSessionUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("Mock session update validation failed", extra={"user_id": request.user.id, "errors": serializer.errors})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        instance.status = data.get('status', instance.status)
        instance.overall_feedback = data.get('overall_feedback', instance.overall_feedback)
        instance.responses = data.get('responses', instance.responses)
        instance.updated_at = int(time.time())
        instance.save()

        logger.info(f"Mock session updated successfully", extra={"user_id": request.user.id, "session_id": instance.id})
        return Response(MockSessionSerializer(instance).data)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        logger.info("Mock session bulk delete attempt", extra={"user_id": request.user.id})
        ids = request.data
        if not isinstance(ids, list):
            logger.warning("Invalid IDs format for session bulk delete", extra={"user_id": request.user.id})
            return Response({"error": "Expected list of IDs"}, status=status.HTTP_400_BAD_REQUEST)
        deleted_count = MockSession.objects.filter(id__in=ids).delete()[0]
        logger.info(f"Mock sessions bulk deleted", extra={"user_id": request.user.id, "deleted_count": deleted_count})
        return Response({"ok": True, "deleted": deleted_count})


# --- Candidates ---
class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return tenant_queryset(Candidate, self.request)

    def get_serializer_class(self):
        if self.action == 'create':
            return CandidateCreateSerializer
        return CandidateSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Delete all sessions for this candidate
        MockSession.objects.filter(candidate=instance).delete()
        instance.delete()
        logger.info(f"Candidate deleted successfully", extra={"user_id": request.user.id, "candidate_id": instance.id})
        return Response({"ok": True})

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data
        if not isinstance(ids, list):
            logger.warning("Invalid IDs format for candidate bulk delete", extra={"user_id": request.user.id})
            return Response({"error": "Expected list of IDs"}, status=status.HTTP_400_BAD_REQUEST)

        # Delete associated sessions first
        MockSession.objects.filter(candidate_id__in=ids).delete()
        deleted_count = Candidate.objects.filter(id__in=ids).delete()[0]
        logger.info(f"Candidates bulk deleted", extra={"user_id": request.user.id, "deleted_count": deleted_count})
        return Response({"ok": True, "deleted": deleted_count})


# --- Analytics ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_candidate_analytics(request, candidate_id):
    """Get analytics for a specific candidate"""
    try:
        logger.info(f"Fetching analytics for candidate", extra={"user_id": request.user.id, "candidate_id": candidate_id})
        candidate = tenant_queryset(Candidate, request).get(id=candidate_id)
    except Candidate.DoesNotExist:
        logger.warning(f"Candidate not found for analytics", extra={"user_id": request.user.id, "candidate_id": candidate_id})
        return Response({"error": "Candidate not found"}, status=status.HTTP_404_NOT_FOUND)

    sessions = tenant_queryset(MockSession, request).filter(candidate=candidate)

    history = []
    skills = {}
    skill_counts = {}

    for session in sessions:
        if session.status == 'completed' and session.responses:
            total_score = sum(
                r['rating'] if isinstance(r, dict) else r.rating
                for r in session.responses.values()
            )
            avg_score = total_score / len(session.responses) if session.responses else 0
            history.append({
                "stack": session.stack,
                "created_at": session.created_at,
                "score": round(avg_score, 1)
            })

            if session.stack not in skills:
                skills[session.stack] = 0
                skill_counts[session.stack] = 0

            skills[session.stack] += avg_score
            skill_counts[session.stack] += 1

    final_skills = {
        stack: round(total / skill_counts[stack], 1)
        for stack, total in skills.items()
    }

    logger.info(f"Candidate analytics fetched successfully", extra={"user_id": request.user.id, "candidate_id": candidate_id})
    data = {
        "candidate": CandidateSerializer(candidate).data,
        "history": sorted(history, key=lambda x: x['created_at'], reverse=True),
        "skills": final_skills
    }

    return Response(data)


class CandidateMockSessionsView(APIView):
    """Returns completed mock sessions for the logged-in candidate (matched via registered_user FK)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info("Fetching completed mock sessions for candidate", extra={"user_id": request.user.id})
        sessions = MockSession.objects.filter(
            status='completed'
        ).filter(
            models.Q(registered_user=request.user) | 
            models.Q(candidate_email__iexact=request.user.email)
        ).order_by('-created_at')
        
        result = []
        for s in sessions:
            responses = s.responses or {}
            scores = [
                v.get('rating', 0)
                for v in responses.values()
                if isinstance(v, dict) and v.get('rating')
            ]
            avg = round(sum(scores) / len(scores), 1) if scores else 0
            result.append({
                'id': s.id,
                'stack': s.stack,
                'total_questions': len(s.questions or []),
                'attempted_questions': len(scores),
                'average_score': avg,
                'overall_feedback': s.overall_feedback or '',
                'status': s.status,
                'created_at': s.created_at,
                'updated_at': s.updated_at,
                'scheduled_at': s.scheduled_at,
            })
        logger.info(f"Returning {len(result)} completed mock sessions", extra={"user_id": request.user.id})
        return Response(result)


class CandidateMyMockSessionsView(APIView):
    """
    Returns upcoming or in-progress mock sessions for the logged-in candidate
    (excluding completed mocks).
    """

    permission_classes = [CandidatePermission]

    def get(self, request):

        logger.info("Fetching upcoming mock sessions for candidate", extra={"user_id": request.user.id})
        sessions = (
            MockSession.objects.filter(
                models.Q(registered_user=request.user) |
                models.Q(candidate_email__iexact=request.user.email)
            )
            .exclude(status="completed")
            .order_by("-created_at")
        )

        result = []

        for s in sessions:
            responses = s.responses or {}
            attempted = len([v for v in responses.values() if isinstance(v, dict) and v.get("rating")])
            result.append(
                {
                    "id": s.id,
                    "stack": s.stack,
                    "status": s.status,  # upcoming / in_progress
                    "total_questions": len(s.questions or []),
                    "attempted_questions": attempted,
                    "created_at": s.created_at,
                    "updated_at": s.updated_at,
                    "scheduled_at": s.scheduled_at,
                }
            )

        return Response(result)


class InterviewerMockSessionsView(APIView):
    """
    Returns mock sessions for the logged-in interviewer
    """

    permission_classes = [CandidatePermission]

    def get(self, request):

        logger.info("Fetching mock sessions for interviewer", extra={"user_id": request.user.id, "email": request.user.email})
        sessions = (
            MockSession.objects.filter(
                models.Q(candidate_interviewer_email__iexact=request.user.email)
            )
            .order_by("-created_at")
        )

        result = []

        for s in sessions:
            responses = s.responses or {}
            attempted = len([v for v in responses.values() if isinstance(v, dict) and v.get("rating")])
            result.append(
                {
                    "id": s.id,
                    "candidate_name": s.candidate_name,
                    "candidate_email": s.candidate_email,
                    "candidate_id": s.candidate_id,
                    "candidate_interviewer_name": s.candidate_interviewer_name,
                    "candidate_interviewer_email": s.candidate_interviewer_email,
                    "candidate_interviewer_id": s.candidate_interviewer_id,
                    "stack": s.stack,
                    "status": s.status,  # upcoming / in_progress
                    "total_questions": len(s.questions or []),
                    "attempted_questions": attempted,
                    "questions": s.questions,
                    "responses": s.responses,
                    "overall_feedback": s.overall_feedback,
                    "created_at": s.created_at,
                    "updated_at": s.updated_at,
                    "scheduled_at": s.scheduled_at,
                }
            )

        logger.info(f"Returning {len(result)} formatted session results for interviewer", extra={"user_id": request.user.id})
        return Response(result)
