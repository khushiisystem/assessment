"""
Shared Content / Visibility Management APIs.

Allows super_admin and org_admin users to:
- View global and shared content catalog (assessments, technologies, questions, SQL datasets)
- Update visibility settings (mark as global, share with specific organizations)
- Browse the content catalogue available to a tenant
"""
import logging

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Assessment, Category, Question, SQLDataset
from learning.models import Technology
from organization.models import Organization

logger = logging.getLogger(__name__)


class IsSuperAdminOrOrgAdmin(permissions.BasePermission):
    """Allow super_admin or org_admin users."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role in ("super_admin", "org_admin") or user.is_superuser


# ─────────────────────────────────────────────────────────────────────
# Super Admin: Manage Global/Shared Content
# ─────────────────────────────────────────────────────────────────────


class SharedAssessmentsView(APIView):
    """
    GET  /v1/api/tenancy/admin/assessments/
         List all assessments with their visibility info.
    
    PATCH /v1/api/tenancy/admin/assessments/<id>/visibility/
          Update visibility for an assessment.
          Body: { "is_global": bool, "visible_to_organization_ids": [int, ...] }
    """

    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrOrgAdmin]

    def get(self, request):
        user = request.user
        if user.role == "super_admin" or user.is_superuser:
            assessments = Assessment.objects.all()
        else:
            assessments = Assessment.objects.filter(
                Q(organization=user.organization) | Q(is_global=True)
            )

        data = []
        for a in assessments.select_related("organization").prefetch_related(
            "visible_to_organizations"
        )[:100]:
            data.append(
                {
                    "id": a.id,
                    "title": a.title,
                    "is_global": a.is_global,
                    "organization_id": a.organization_id,
                    "organization_name": (
                        a.organization.name if a.organization else None
                    ),
                    "visible_to_organizations": [
                        {"id": org.id, "name": org.name}
                        for org in a.visible_to_organizations.all()
                    ],
                    "created_at": a.created_at.isoformat(),
                }
            )

        return Response(data)


class UpdateAssessmentVisibilityView(APIView):
    """
    PATCH /v1/api/tenancy/admin/assessments/<id>/visibility/
    Body: { "is_global": bool, "visible_to_organization_ids": [int] }
    """

    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrOrgAdmin]

    def patch(self, request, assessment_id):
        user = request.user
        try:
            if user.role == "super_admin" or user.is_superuser:
                assessment = Assessment.objects.get(id=assessment_id)
            else:
                assessment = Assessment.objects.get(
                    id=assessment_id, organization=user.organization
                )
        except Assessment.DoesNotExist:
            return Response(
                {"error": "Assessment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_global = request.data.get("is_global")
        org_ids = request.data.get("visible_to_organization_ids")

        if is_global is not None:
            # Only super_admin can set global
            if is_global and not (user.role == "super_admin" or user.is_superuser):
                return Response(
                    {"error": "Only super admins can set content as global."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            assessment.is_global = bool(is_global)
            assessment.save(update_fields=["is_global"])

        if org_ids is not None:
            if not isinstance(org_ids, list):
                return Response(
                    {"error": "visible_to_organization_ids must be a list."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            valid_orgs = Organization.objects.filter(id__in=org_ids, is_active=True)
            assessment.visible_to_organizations.set(valid_orgs)

        return Response(
            {
                "message": "Visibility updated successfully.",
                "id": assessment.id,
                "is_global": assessment.is_global,
                "visible_to_organizations": list(
                    assessment.visible_to_organizations.values_list("id", flat=True)
                ),
            }
        )


class SharedTechnologiesView(APIView):
    """
    GET /v1/api/tenancy/admin/technologies/
    List all technologies with visibility info.
    """

    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrOrgAdmin]

    def get(self, request):
        user = request.user
        if user.role == "super_admin" or user.is_superuser:
            technologies = Technology.objects.all()
        else:
            technologies = Technology.objects.filter(
                Q(organization=user.organization) | Q(is_global=True)
            )

        data = []
        for t in technologies.prefetch_related("visible_to_organizations")[:100]:
            data.append(
                {
                    "id": str(t.id),
                    "name": t.name,
                    "category": t.category,
                    "is_global": t.is_global,
                    "organization_id": t.organization_id,
                    "visible_to_organizations": [
                        {"id": org.id, "name": org.name}
                        for org in t.visible_to_organizations.all()
                    ],
                }
            )

        return Response(data)


class UpdateTechnologyVisibilityView(APIView):
    """
    PATCH /v1/api/tenancy/admin/technologies/<id>/visibility/
    Body: { "is_global": bool, "visible_to_organization_ids": [int] }
    """

    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrOrgAdmin]

    def patch(self, request, technology_id):
        user = request.user
        try:
            if user.role == "super_admin" or user.is_superuser:
                technology = Technology.objects.get(id=technology_id)
            else:
                technology = Technology.objects.get(
                    id=technology_id, organization=user.organization
                )
        except Technology.DoesNotExist:
            return Response(
                {"error": "Technology not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_global = request.data.get("is_global")
        org_ids = request.data.get("visible_to_organization_ids")

        if is_global is not None:
            if is_global and not (user.role == "super_admin" or user.is_superuser):
                return Response(
                    {"error": "Only super admins can set content as global."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            technology.is_global = bool(is_global)
            technology.save(update_fields=["is_global"])

        if org_ids is not None:
            if not isinstance(org_ids, list):
                return Response(
                    {"error": "visible_to_organization_ids must be a list."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            valid_orgs = Organization.objects.filter(id__in=org_ids, is_active=True)
            technology.visible_to_organizations.set(valid_orgs)

        return Response(
            {
                "message": "Visibility updated successfully.",
                "id": str(technology.id),
                "is_global": technology.is_global,
                "visible_to_organizations": list(
                    technology.visible_to_organizations.values_list("id", flat=True)
                ),
            }
        )


class SharedQuestionsView(APIView):
    """
    GET /v1/api/tenancy/admin/questions/
    List questions with visibility info (paginated).
    """

    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrOrgAdmin]

    def get(self, request):
        user = request.user
        page = int(request.query_params.get("page", 1))
        page_size = min(int(request.query_params.get("page_size", 50)), 100)

        if user.role == "super_admin" or user.is_superuser:
            questions = Question.objects.all()
        else:
            questions = Question.objects.filter(
                Q(organization=user.organization) | Q(is_global=True)
            )

        total = questions.count()
        offset = (page - 1) * page_size
        qs = questions.select_related("category")[offset : offset + page_size]

        data = []
        for q in qs:
            data.append(
                {
                    "id": q.id,
                    "title": q.title,
                    "question_type": q.question_type,
                    "category": q.category.name if q.category else None,
                    "difficulty": q.difficulty,
                    "is_global": getattr(q, "is_global", False),
                    "organization_id": q.organization_id,
                }
            )

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": data,
            }
        )


class UpdateQuestionVisibilityBulkView(APIView):
    """
    POST /v1/api/tenancy/admin/questions/bulk-visibility/
    Body: {
        "question_ids": [int],
        "is_global": bool,
        "visible_to_organization_ids": [int]  (only for assessments/technologies that have M2M)
    }
    
    For questions that don't have visible_to_organizations M2M, only is_global applies.
    """

    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrOrgAdmin]

    def post(self, request):
        user = request.user
        question_ids = request.data.get("question_ids", [])
        is_global = request.data.get("is_global")

        if not question_ids or not isinstance(question_ids, list):
            return Response(
                {"error": "question_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_global and not (user.role == "super_admin" or user.is_superuser):
            return Response(
                {"error": "Only super admins can set content as global."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.role == "super_admin" or user.is_superuser:
            questions = Question.objects.filter(id__in=question_ids)
        else:
            questions = Question.objects.filter(
                id__in=question_ids, organization=user.organization
            )

        updated = 0
        if is_global is not None and hasattr(Question, "is_global"):
            updated = questions.update(is_global=bool(is_global))

        return Response(
            {
                "message": f"Updated visibility for {updated} questions.",
                "updated_count": updated,
            }
        )


# ─────────────────────────────────────────────────────────────────────
# Tenant Catalog: What's available to the current tenant
# ─────────────────────────────────────────────────────────────────────


class TenantAssessmentsCatalogView(APIView):
    """
    GET /v1/api/tenancy/tenant/assessments/
    Returns assessments visible to the current user's tenant.
    Includes: own org assessments + global + shared with org.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_id = getattr(user, "organization_id", None)

        if user.role == "super_admin" or user.is_superuser:
            assessments = Assessment.objects.all()
        elif org_id:
            assessments = Assessment.objects.filter(
                Q(organization_id=org_id)
                | Q(is_global=True)
                | Q(visible_to_organizations=org_id)
            ).distinct()
        else:
            # Individual user - only global content
            assessments = Assessment.objects.filter(
                Q(is_global=True) | Q(organization__isnull=True)
            )

        data = [
            {
                "id": a.id,
                "title": a.title,
                "is_global": a.is_global,
                "source_organization": (
                    a.organization.name if a.organization else "Platform"
                ),
                "is_own": a.organization_id == org_id if org_id else False,
            }
            for a in assessments.select_related("organization")[:200]
        ]

        return Response(data)


class TenantTechnologiesCatalogView(APIView):
    """
    GET /v1/api/tenancy/tenant/catalog/technologies/
    Technologies available to the current tenant.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_id = getattr(user, "organization_id", None)

        if user.role == "super_admin" or user.is_superuser:
            techs = Technology.objects.all()
        elif org_id:
            techs = Technology.objects.filter(
                Q(organization_id=org_id)
                | Q(is_global=True)
                | Q(visible_to_organizations=org_id)
            ).distinct()
        else:
            techs = Technology.objects.filter(
                Q(is_global=True) | Q(organization__isnull=True)
            )

        data = [
            {
                "id": str(t.id),
                "name": t.name,
                "category": t.category,
                "is_global": t.is_global,
                "source_organization_id": t.organization_id,
            }
            for t in techs[:200]
        ]

        return Response(data)


class TenantQuestionsCatalogView(APIView):
    """
    GET /v1/api/tenancy/tenant/catalog/questions/
    Questions available to the current tenant.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_id = getattr(user, "organization_id", None)

        if user.role == "super_admin" or user.is_superuser:
            questions = Question.objects.all()
        elif org_id:
            questions = Question.objects.filter(
                Q(organization_id=org_id) | Q(is_global=True)
            )
        else:
            questions = Question.objects.filter(
                Q(is_global=True) | Q(organization__isnull=True)
            )

        page = int(request.query_params.get("page", 1))
        page_size = min(int(request.query_params.get("page_size", 50)), 100)
        total = questions.count()
        offset = (page - 1) * page_size

        data = [
            {
                "id": q.id,
                "title": q.title,
                "question_type": q.question_type,
                "difficulty": q.difficulty,
                "category": q.category.name if q.category else None,
            }
            for q in questions.select_related("category")[offset : offset + page_size]
        ]

        return Response({"count": total, "page": page, "page_size": page_size, "results": data})


class OrganizationListForSharingView(APIView):
    """
    GET /v1/api/tenancy/admin/organizations/
    List all active organizations (for sharing picker UI).
    Only super_admin can access.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.role == "super_admin" or user.is_superuser):
            return Response(
                {"error": "Only super admins can list all organizations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        orgs = Organization.objects.filter(is_active=True).order_by("name")
        data = [{"id": o.id, "name": o.name, "slug": o.slug} for o in orgs]
        return Response(data)
