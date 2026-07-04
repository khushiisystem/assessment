from django.urls import path

from . import views
from .views import DeleteAIMockQuestionView

urlpatterns = [
    path("api/save-answer/", views.SaveAIAnswerView.as_view(), name="api_save_ai_answer"),
    path('my-admin/ai-assessments/hardcoded-questions/', 
         views.GetAllHardcodedQuestionsView.as_view(), 
         name='ai-hardcoded-questions'),
    path('my-admin/ai-assessments/mock-questions/<int:question_id>/',
         views.UpdateMockInterviewQuestionView.as_view(),
         name='update-mock-question'),
    path("api/ai/tts/", views.TextToSpeechView.as_view(), name="api_ai_tts"),
    path("api/ai/upload-audio/", views.UploadAudioView.as_view(), name="api_ai_upload_audio"),
    path("api/ai/upload-video/", views.UploadAIVideoView.as_view(), name="api_upload_ai_video"),
    path("api/ai/get-presigned-url/", views.GetPresignedUrlView.as_view(), name="api_get_presigned_url"),
    path("api/ai/get-presigned-download-url/", views.GetPresignedDownloadUrlView.as_view(), name="api_get_presigned_download_url"),

    path(
        "api/ai/get-presigned-url-intro/",
        views.GetPresignedUrlIntroView.as_view(),
        name="api_get_presigned_url_intro",
    ),
    path(
        "api/ai/get-video-part-url/",
        views.GetVideoPartPresignedUrlView.as_view(),
        name="api_get_video_part_url",
    ),
    path(
        "api/ai/upload-video-chunk/",
        views.UploadVideoChunkView.as_view(),
        name="api_upload_video_chunk",
    ),
    path(
        "api/ai/complete-multipart-upload/",
        views.CompleteMultipartUploadView.as_view(),
        name="api_complete_multipart_upload",
    ),
    path("ai-assessment/save-answer/", views.SaveAIAnswerView.as_view(), name="api_ai_assessment_save_answer"),
    path("ai-assessment/upload-audio/", views.UploadAudioView.as_view(), name="api_ai_assessment_upload_audio"),
    path(
        "ai-assessment/upload-audio-chunk/",
        views.UploadAudioChunkView.as_view(),
        name="api_ai_assessment_upload_audio_chunk",
    ),

    # path(
    #     "ai-assessment/upload-screenshot/",
    #     views.UploadScreenshotView.as_view(),
    #     name="upload_screenshot",
    # ),

    path(
        "ai-assessment/upload-introduction-video/",
        views.UploadIntroductionVideoView.as_view(),
        name="api_upload_introduction_video",
    ),
    
    # path("ai-assessment/analyze-frame/", views.AnalyzeFrameView.as_view(), name="analyze_frame"),
    
    path("ai-assessment/tts/", views.TextToSpeechView.as_view(), name="api_ai_assessment_tts"),
    
    path(
        "ai-assessment/save-proctoring-incident/",
        views.SaveProctoringIncidentView.as_view(),
        name="save_proctoring_incident",
    ),

    path(
        "my-admin/questions/bulk-upload/",
        views.BulkUploadQuestionsView.as_view(),
        name="api_bulk_upload_questions",
    ),          # bulk upload questions for ai assessments
    path("my-admin/ai-assessments/", views.AIAssessmentListView.as_view(), name="api_ai_assessment_list"),
    path(
        "my-admin/ai-assessments/create/",
        views.CreateAIAssessmentView.as_view(),
        name="api_create_ai_assessment",
    ),          # 1 create ai assessment
    path(
        "my-admin/ai-assessments/<int:ai_assessment_id>/",
        views.AIAssessmentDetailView.as_view(),
        name="api_ai_assessment_detail",
    ),          # 2 view ai assessment details
    path(
        "my-admin/ai-assessments/<int:ai_assessment_id>/assign/",
        views.AssignAIAssessmentView.as_view(),
        name="api_assign_ai_assessment",
    ),          # 3 assign ai assessment to candidates
    path(
        "my-admin/ai-assessments/<int:ai_assessment_id>/unassign/",
        views.UnassignAIAssessmentView.as_view(),
        name="api_unassign_ai_assessment",
    ),          # 4 unassign candidates from ai assessment
    path(
        "my-admin/ai-assessments/<int:ai_assessment_id>/results/",
        views.AIAssessmentResultsView.as_view(),
        name="api_ai_assessment_results",
    ),        #  view ai assessment results

    # path(
    #     "my-admin/ai-assessments/candidate/<int:candidate_assessment_id>/details/",
    #     views.CandidateAssessmentDetailView.as_view(),
    #     name="get_candidate_details",
    # ),
    
    path(
        "my-admin/ai-assessments/candidate/<int:candidate_assessment_id>/report/",
        views.GenerateCandidateReportView.as_view(),
        name="api_candidate_report",
    ),      # generate candidate report
    path(
        "my-admin/ai-assessments/candidate/<int:candidate_assessment_id>/remind/",
        views.SendReminderEmailView.as_view(),
        name="api_send_reminder",
    ),         # send reminder email to candidate for a particular assessment
    path(
        "my-admin/ai-assessments/<int:ai_assessment_id>/delete/",
        views.DeleteAIAssessmentView.as_view(),
        name="api_delete_ai_assessment",
    ),
    path(
        "my-admin/ai-assessments/candidate/<int:candidate_assessment_id>/delete/",
        views.DeleteCandidateAssessmentView.as_view(),
        name="api_delete_candidate_assessment",
    ),         # delete a candidate assessment
    path(
        "my-admin/ai-assessments/bulk-delete/",
        views.AIAssessmentBulkDeleteView.as_view(),
        name="api_ai_assessment_bulk_delete",
    ),
    path(
        "ai-assessment/<int:ai_assessment_id>/introduction/",
        views.AIAssessmentIntroductionView.as_view(),
        name="api_ai_assessment_introduction",
    ),          # ai assessment introduction page
    path(
        "ai-assessment/<int:ai_assessment_id>/take/",
        views.TakeAIAssessmentView.as_view(),
        name="api_take_ai_assessment",
    ),          # take ai assessment  
    path(
        "ai-assessment/<int:ai_assessment_id>/submit/",
        views.SubmitAIAssessmentView.as_view(),
        name="api_submit_ai_assessment",
    ),          # submit ai assessment
    path(
        "ai-assessment/<int:ai_assessment_id>/result/",
        views.AIAssessmentResultView.as_view(),
        name="api_ai_assessment_result",
    ),          # view ai assessment result

    path(
        "candidate/my-assessments/",
        views.CandidateMyAssessmentsCombinedView.as_view(),
        name="api_candidate_my_assessments",
    ),
    path(
        "candidate/completed/",
        views.CandidateCompletedAssessmentsView.as_view(),
        name="api_candidate_completed_combined",
    ),
    path(
        "candidate/upcoming/",
        views.CandidateUpcomingAssessmentsView.as_view(),
        name="api_candidate_upcoming_combined",
    ),
    path(
        "send-selection-email/<int:candidate_id>/",
        views.SendSelectionEmailView.as_view(),
        name="api_send_selection_email",
    ),
    path(
        "my-admin/ai-assessments/candidate/<int:candidate_assessment_id>/assign/",
        views.AssignAssessmentEmailView.as_view(),
        name="api_assign_assessment",
    ),
    path(
        "candidate/api/assessment/<int:ai_assessment_id>/prepare-questions/",
        views.PrepareQuestionsAsyncView.as_view(),
        name="api_prepare_questions_async",
    ),
    path(
        "candidate/api/assessment/<int:ai_assessment_id>/check-questions/",
        views.CheckQuestionsReadyView.as_view(),
        name="api_check_questions_ready",
    ),

    #ai_mock questions added
    path('my-admin/ai-assessments/hardcoded-questions/create/', 
     views.CreateHardcodedQuestionView.as_view(), 
     name='create_hardcoded_question'),

    #new added
    path('my-admin/ai-assessments/mock-questions/<int:question_id>/delete/', 
     DeleteAIMockQuestionView.as_view(), 
     name='delete_ai_mock_question'),

    path(
        "ai-assessment/<int:ai_assessment_id>/status/",
        views.CheckAssessmentStatusView.as_view(),
        name="api_check_assessment_status",
    ),
    path(
        "ai-assessment/celery-callback/",
        views.CeleryAssessmentCallbackView.as_view(),
        name="api_ai_assessment_celery_callback",
    ),
    path(
        "ai-assessment/<int:ai_assessment_id>/generate-report/",
        views.GenerateAssessmentReportView.as_view(),
        name="api_generate_assessment_report",
    ),


]

