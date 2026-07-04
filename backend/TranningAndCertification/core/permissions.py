from rest_framework import permissions

# Staff roles that can create/manage assessments and candidates.
# super_admin = platform owner, org_admin = organization owner, manager =
# assessment creator scoped to their own assessments.
ADMIN_ROLES = ['super_admin', 'org_admin', 'manager']


class IsAdmin(permissions.BasePermission):
    """
    Permission class to check if user is staff (super_admin, org_admin, or manager)
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ADMIN_ROLES


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission class to check if user is super admin
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role == 'super_admin'


class IsCandidate(permissions.BasePermission):
    """
    Permission class to check if user is candidate
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role == 'candidate'


class IsAdminOrCandidate(permissions.BasePermission):
    """
    Permission class to allow both admin and candidate access
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ADMIN_ROLES + ['candidate']


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission class to check if user is the owner of the object or is admin
    """
    def has_object_permission(self, request, view, obj):
        # Admin can access any object
        if request.user.role in ADMIN_ROLES:
            return True

        # Check if user is the owner
        if hasattr(obj, 'candidate'):
            return obj.candidate == request.user
        elif hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False


class IsAssessmentOwnerOrAdmin(permissions.BasePermission):
    """
    Permission class for assessment-related objects
    Allows access if user is assigned to the assessment or is admin
    """
    def has_object_permission(self, request, view, obj):
        # Admin can access any object
        if request.user.role in ADMIN_ROLES:
            return True

        # For CandidateAssessment, check if user is the candidate
        if hasattr(obj, 'candidate'):
            return obj.candidate == request.user
        
        # For Response, check if user is the candidate
        if hasattr(obj, 'candidate'):
            return obj.candidate == request.user
        
        # For Assessment, check if user is assigned
        if hasattr(obj, 'candidateassessment_set'):
            from .models import CandidateAssessment
            return CandidateAssessment.objects.filter(
                candidate=request.user,
                assessment=obj
            ).exists()
        
        return False


class CanModifyAssessment(permissions.BasePermission):
    """
    Permission class to check if user can modify assessment
    Only creator or super admin can modify
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'super_admin':
            return True
        
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return False


class CanTakeAssessment(permissions.BasePermission):
    """
    Permission class to check if candidate can take assessment
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role != 'candidate':
            return False
        
        return True
    
    def has_object_permission(self, request, view, obj):
        from .models import CandidateAssessment
        
        # Check if candidate is assigned to this assessment
        try:
            ca = CandidateAssessment.objects.get(
                candidate=request.user,
                assessment=obj
            )
            # Check if assessment is available (assigned or in_progress)
            return ca.status in ['assigned', 'in_progress']
        except CandidateAssessment.DoesNotExist:
            return False


class IsReadOnlyOrAdmin(permissions.BasePermission):
    """
    Permission class that allows read-only access to all users,
    but write access only to admins
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        return request.user and request.user.is_authenticated and \
               request.user.role in ADMIN_ROLES

