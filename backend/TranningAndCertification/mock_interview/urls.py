from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'questions', views.QuestionViewSet, basename='question')
router.register(r'templates', views.InterviewTemplateViewSet, basename='template')
router.register(r'sessions', views.MockSessionViewSet, basename='session')
router.register(r'candidates', views.CandidateViewSet, basename='candidate')

urlpatterns = [
    # Tech Stacks
    path('stacks/', views.get_tech_stacks, name='get-stacks'),
    path('stacks/', views.add_tech_stack, name='add-stack'),

    # Analytics
    path('analytics/candidate/<int:candidate_id>/', views.get_candidate_analytics, name='candidate-analytics'),

    # Candidate-facing: view own completed mock sessions
    path('my-sessions/', views.CandidateMockSessionsView.as_view(), name='candidate-mock-sessions'),
    path('my-mock-sessions/', views.CandidateMyMockSessionsView.as_view(), name='candidate-my-mock-sessions'),
    path('interviewer-mock-sessions/', views.InterviewerMockSessionsView.as_view(), name='interviewer-mock-sessions'),

    # ViewSet routes
    path('', include(router.urls)),
]
