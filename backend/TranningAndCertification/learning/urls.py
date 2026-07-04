from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseCertificateEmailView,
    LockTechnologyAPIView,
    TechnologyViewSet,
    TechnologyBulkDeleteAPIView,
    QuestionViewSet,
    CompletionViewSet,
    AssignmentListCreateView,
    AssignmentDeleteView,
    UserTechnologyProgressViewSet,
    ImportQuestionsAPIView,
    DownloadQuestionTemplateAPIView,
    SubmitUserNotesAPIView,
    SendReminderEmailAPIView,
    TechnologyCandidatesAPIView,
    AllCandidatesActivityView,
    AssignmentUpdateDueDateView,
    UnlockTechnologyAPIView,
    LockTechnologyAPIView,
)
# from .views import TechnologyCandidatesAPIView

router = DefaultRouter()

router.register('technologies', TechnologyViewSet, basename='technology')

    
router.register(
    r'technologies/(?P<technology_id>[^/.]+)/questions',
    QuestionViewSet,
    basename='technology-questions'
)
router.register(r'completions', CompletionViewSet, basename='completion')
router.register(r'progress', UserTechnologyProgressViewSet, basename='progress')


urlpatterns = [
    # NEW ENDPOINTS ADDED (must be above router to work)
    path(
    'technologies/<uuid:technology_id>/candidates/',
    TechnologyCandidatesAPIView.as_view(),
    name='technology-candidates'
),
    
    # Bulk Delete Technologies API
    path(
        'technologies/bulk-delete/',
        TechnologyBulkDeleteAPIView.as_view(),
        name='technology-bulk-delete'
    ),

    # Import Questions API
    path(
        r'technologies/<uuid:technology_id>/questions/import/',
        ImportQuestionsAPIView.as_view(),
        name='import-questions'
    ),
    
    path('activities/', AllCandidatesActivityView.as_view(), name='all-candidates-activity'),

    # Download CSV Template API
    path(
        r'questions/template/download/',
        DownloadQuestionTemplateAPIView.as_view(),
        name='question-template-download'
    ),

    path(
        'progress/<uuid:technology_id>/submit-notes/',
        SubmitUserNotesAPIView.as_view(),
        name='submit-user-notes'
    ),

 path(
        'candidates/<int:candidate_id>/assignments/<int:assignment_id>/send-reminder-email/',
        SendReminderEmailAPIView.as_view(),
        name='send-reminder-email'
    ),
 
 path(
    'course-complete-email/',
    CourseCertificateEmailView.as_view(),
    name='course-complete-email'
),

path(
        'technologies/unlock/',
        UnlockTechnologyAPIView.as_view(),
        name='unlock-technology'
    ),
    path(
        'technologies/lock/',
        LockTechnologyAPIView.as_view(),
        name='lock-technology'
    ),

    # Your original URLs (unchanged)
    path('', include(router.urls)),
    path('assignments/', AssignmentListCreateView.as_view(), name='assignment-list-create'),
    path('assignments/<int:pk>/', AssignmentDeleteView.as_view(), name='assignment-delete'),
    path('assignments/<int:assignment_id>/update-due-date/', AssignmentUpdateDueDateView.as_view(), name='assignment-update-due-date'),
]