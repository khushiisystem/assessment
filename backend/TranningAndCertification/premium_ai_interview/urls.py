from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_interview, name='start-interview'),
    path('parse-resume/', views.parse_resume, name='parse-resume'),
    path('transcribe/', views.transcribe_audio, name='transcribe-audio'),
    path('roles/', views.get_roles, name='get-roles'),
    path('tts/', views.tts_view, name='tts'),
    path(
        '<uuid:session_id>/upload-audio/',
        views.UploadAnswerAudioView.as_view(),
        name='upload-answer-audio'
    ),
    path(
        '<uuid:session_id>/get-video-upload-url/',
        views.GetInterviewVideoUploadUrlView.as_view(),
        name='get-interview-video-upload-url'
    ),
    path(
        '<uuid:session_id>/upload-video-chunk/',
        views.UploadInterviewVideoChunkView.as_view(),
        name='upload-interview-video-chunk'
    ),
    path(
        '<uuid:session_id>/complete-video-upload/',
        views.CompleteInterviewVideoUploadView.as_view(),
        name='complete-interview-video-upload'
    ),
    # Dynamic routes AFTER static
    path(
        '<uuid:session_id>/intro/',
        views.get_interview_intro,
        name='interview-intro'
    ),

    path(
        '<uuid:session_id>/answer/',
        views.answer_question,
        name='answer-question'
    ),

    path(
        '<uuid:session_id>/end/',
        views.end_interview,
        name='end-interview'
    ),

    path(
        '<uuid:session_id>/',
        views.get_session,
        name='get-session'
    ),

    # List route LAST
    path('', views.list_sessions, name='list-sessions'),
]
