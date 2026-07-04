from django.urls import path, include

from . import celery_task_views
from . import views
from .payment_views import (
    CreatePaymentOrderView,
    RazorpayWebhookView,
    VerifyPaymentView,
)
from .shared_content_views import (
    OrganizationListForSharingView,
    SharedAssessmentsView,
    SharedQuestionsView,
    SharedTechnologiesView,
    TenantAssessmentsCatalogView,
    TenantQuestionsCatalogView,
    TenantTechnologiesCatalogView,
    UpdateAssessmentVisibilityView,
    UpdateQuestionVisibilityBulkView,
    UpdateTechnologyVisibilityView,
)
from .subscription_views import (
    CancelSubscriptionView,
    MySubscriptionView,
    OrgAdminCreateUserView,
    OrgAdminListUsersView,
    SubscriptionPlanListView,
    UnifiedRegisterAPIView,
    UpgradeSubscriptionView,
)

urlpatterns = [
    path("", views.APIRootView.as_view(), name="api_core_home"),
    path("background-tasks/", celery_task_views.DynamicBackgroundTaskListView.as_view(), name="api_background_task_list"),
    path("background-tasks/run/", celery_task_views.DynamicBackgroundTaskRunView.as_view(), name="api_background_task_run"),
    path("background-tasks/<str:task_id>/status/", celery_task_views.DynamicBackgroundTaskStatusView.as_view(), name="api_background_task_status"),
    path("register/", views.CandidateRegisterAPIView.as_view(), name="api_core_register"), # done 
    path("verify-otp/<int:otp_id>/",views.VerifyRegistrationOTPAPI.as_view(),name="api_core_verify_registration",), # done
    path("resend-otp/<int:otp_id>/",views.ResendRegistrationOTPAPIView.as_view(),name="api_core_resend_registration",), # done 
    
    
    path("my-admin/dashboard/", views.AdminDashboardView.as_view(), name="api_core_admin_dashboard"), # done
    path("candidate-dashboard/", views.CandidateDashboardView.as_view(), name="api_core_candidate_dashboard"), # done


    path("my-admin/candidates/add/", views.CandidateCreateView.as_view(), name="api_core_candidate_add"), # done
    path("my-admin/candidates/import/", views.CandidateImportView.as_view(), name="api_core_candidate_import"), # done

    path("my-admin/candidates/", views.CandidateListView.as_view(), name="api_core_candidate_list"), # done
    path("my-admin/candidates/<int:pk>/details/", views.CandidateDetailView.as_view(), name="api_core_candidate_details"), # done
    path("my-admin/candidates/<int:pk>/resume/", views.ResumePresignedURLView.as_view(), name="api_core_candidate_resume"),
    path("candidates/<int:pk>/delete/", views.CandidateDeleteView.as_view(), name="api_core_candidate_delete"), # done
    path("candidates/bulk-delete/", views.CandidateBulkDeleteView.as_view(), name="api_core_candidate_bulk_delete"), # done
    

    path("my-admin/questions/", views.QuestionListView.as_view(), name="api_core_question_list"), # done
    path("my-admin/questions/add/", views.QuestionCreateView.as_view(), name="api_core_question_add"), # done
    path("my-admin/questions/import/", views.QuestionImportView.as_view(), name="api_core_question_import"), # done
    path("my-admin/export/questions/",views.ExportQuestionsView.as_view(),name="api_core_export_questions",), # done
    path("my-admin/questions/<int:question_id>/", views.QuestionDetailView.as_view(), name="api_core_question_detail"), # done
    path("my-admin/questions/<int:question_id>/edit/",views.QuestionEditView.as_view(),name="api_core_question_edit",), # done
    path("my-admin/questions/<int:question_id>/delete/",views.QuestionDeleteView.as_view(),name="api_core_question_delete",), # done
    path("questions/bulk-delete/", views.QuestionBulkDeleteView.as_view(), name="api_core_question_bulk_delete"), # done
    path("questions/import/template/xlsx/",views.DownloadQuestionTemplateXLSXView.as_view(),name="api_core_question_template_xlsx",), # done
    path("questions/import/template/csv/",views.DownloadQuestionTemplateCSVView.as_view(),name="api_core_question_template_csv",), # done
    

    path("my-admin/assessments/", views.AssessmentListView.as_view(), name="api_core_assessment_list"), # done
    path("my-admin/assessments/create/", views.AssessmentCreateView.as_view(), name="api_core_assessment_create"), # done
    path("my-admin/assessments/<int:assessment_id>/",views.AssessmentDetailView.as_view(),name="api_core_assessment_detail",), # done
    path("my-admin/assessments/<int:assessment_id>/autofill-questions/", views.AssessmentAutofillQuestionsView.as_view(), name="api_core_assessment_autofill"),
    path("my-admin/assessments/<int:assessment_id>/edit/",views.AssessmentUpdateView.as_view(),name="api_core_assessment_edit",), # done
    path("my-admin/assessments/<int:assessment_id>/candidates/",views.AssessmentCandidatesView.as_view(),name="api_core_assessment_candidates",), # done
    path("my-admin/assessments/<int:assessment_id>/candidates/status/",views.AssessmentCandidatesStatusView.as_view(),name="api_core_assessment_candidates_status",),
    path("my-admin/assessments/<int:assessment_id>/candidates-score/", views.AssessmentCandidatesWithScoreView.as_view(), name="api_core_assessment_candidates_score"),
    path("my-admin/assessments/<int:assessment_id>/assign/",views.AssessmentAssignView.as_view(),name="api_core_assessment_assign",), # done
    path("my-admin/assessments/<int:assessment_id>/unassign/",views.AssessmentUnassignView.as_view(),name="api_core_assessment_unassign",),
    path("my-admin/assessments/<int:assessment_id>/duplicate/",views.AssessmentDuplicateView.as_view(),name="api_core_assessment_duplicate",), # done
    path("assessments/bulk-delete/", views.AssessmentBulkDeleteView.as_view(), name="api_core_assessment_bulk_delete"),

    path("candidates/import/template/xlsx/",views.DownloadCandidateTemplateXLSXView.as_view(),name="api_core_candidate_template_xlsx",), # done
    path("candidates/import/template/csv/",views.DownloadCandidateTemplateCSVView.as_view(),name="api_core_candidate_template_csv",), # done

    path("check-assessment-status/",views.AssessmentStatusView.as_view(),name="api_core_check_assessment_status",), # done
    path("my-admin/results/", views.ResultsDashboardView.as_view(), name="api_core_results_dashboard"), # half-tested


    path("forgot-password/", views.ForgotPasswordView.as_view(), name="api_core_forgot_password"), # done
    path("verify-reset-otp/<int:otp_id>/",views.VerifyResetOTPView.as_view(),name="api_core_verify_reset_otp",), # done
    path("reset-password/<int:otp_id>/",views.ResetPasswordView.as_view(),name="api_core_reset_password",), # done 
    path("profile/", views.CandidateProfileView.as_view(), name="api_core_profile"), # done
    path("change-password/", views.ChangePasswordView.as_view(), name="api_core_change_password"), # done


    path("my-admin/bulk-upload/", views.BulkUploadView.as_view(), name="api_core_bulk_upload"), # done
    path("my-admin/export/candidates/",views.ExportCandidatesView.as_view(),name="api_core_export_candidates"), # done
    path("my-admin/export/results/<int:assessment_id>/",views.ExportAssessmentResultsView.as_view(),name="api_core_export_assessment_results",), # done


    path("candidates/<int:candidate_id>/quick-assign/",views.CandidateQuickAssignView.as_view(),name="api_core_candidate_quick_assign",), # done 
    path("my-admin/results/assessment/<int:assessment_id>/",views.AssessmentResultsView.as_view(),name="api_core_results_assessment",), # done 
    path("my-admin/results/candidate/<int:candidate_id>/",views.CandidateResultsView.as_view(),name="api_core_results_candidate",), # done 
    path("my-admin/candidate-assessment/<int:candidate_assessment_id>/result/",views.AdminCandidateAssessmentResultView.as_view(),name="api_core_candidate_assessment_result",), # done
    path("assessment/<int:assessment_id>/print/",views.PrintAssessmentResultsView.as_view(),name="api_core_assessment_print",), # done
    path("assessment/<int:assessment_id>/take/",views.TakeAssessmentView.as_view(),name="api_core_take_assessment",), # done
    path("candidate-assessment/<int:candidate_assessment_id>/take/", views.TakeAssessmentView.as_view(), name="api_core_take_assessment_by_candidate"),
    path("assessment/<int:assessment_id>/submit/",views.SubmitAssessmentView.as_view(),name="api_core_submit_assessment",), # done 
    path("candidate-assessment/<int:candidate_assessment_id>/submit/", views.SubmitAssessmentView.as_view(), name="api_core_submit_assessment_by_ca"),
    # path("assessment/<int:assessment_id>/submit-and-logout/",views.SubmitAndLogoutView.as_view(),name="api_core_submit_and_logout",),
    path("assessment/<int:assessment_id>/result/",views.CandidateAssessmentResultView.as_view(),name="api_core_assessment_result",), # done 
    path("candidate-assessment/<int:candidate_assessment_id>/result/", views.CandidateResultByCandidateAssessmentView.as_view(), name="api_core_candidate_assessment_result_candidate"),
    path("my-admin/assessment/<int:assessment_id>/candidate/<int:candidate_id>/",views.CandidateSubmissionsView.as_view(),name="api_core_candidate_submissions",), # done 
    
    path("api/v1/save-answer/", views.SaveAnswerView.as_view(), name="api_core_save_answer"), # done 
    path("api/run-code/", views.RunCodeView.as_view(), name="api_core_run_code"), # done
    path("api/proctoring-incident/",views.ProctoringIncidentView.as_view(),name="api_core_proctoring_incident",), # done
    path("test/email/", views.TestEmailView.as_view(), name="api_core_test_email"), # done
    path("test/code/", views.TestCodeExecutionView.as_view(), name="api_core_test_code"), # done 
    path("api/sql/run/", views.SQLRunView.as_view(), name="api_core_sql_run"), # done
    path("api/sql/grade/", views.SQLGradeView.as_view(), name="api_core_sql_grade"), # done 



    path('my-admin/category/', views.CategoryListCreateView.as_view(), name='category_list_create'),
    path('my-admin/category/<int:category_id>/', views.CategoryDetailView.as_view(), name='category_detail'),

    path("my-admin/sql/dataset/create/",views.SQLDatasetCreateView.as_view(),name="api_core_sql_dataset_create",), # done 
    path("my-admin/sql-datasets/", views.SQLDatasetListView.as_view(), name="sql_dataset_list"),
    path("my-admin/sql-datasets/<int:pk>/", views.SQLDatasetDetailView.as_view(), name="sql_dataset_detail"),

    # Candidate Assessment Views
    path("candidate/assessments/assigned/", views.CandidateAssignedAssessmentsView.as_view(), name="api_candidate_assigned_assessments"),
    path("candidate/assessments/completed/", views.CandidateCompletedAssessmentsView.as_view(), name="api_candidate_completed_assessments"),
    path("candidate/assessments/upcoming/", views.CandidateUpcomingAssessmentsView.as_view(), name="api_candidate_upcoming_assessments"),

    # Subscription & registration (org + individual)
    path("register/unified/", UnifiedRegisterAPIView.as_view(), name="unified_register"),
    path("subscription/plans/", SubscriptionPlanListView.as_view(), name="subscription_plans"),
    path("subscription/me/", MySubscriptionView.as_view(), name="my_subscription"),
    path("subscription/upgrade/", UpgradeSubscriptionView.as_view(), name="upgrade_subscription"),
    path("subscription/cancel/", CancelSubscriptionView.as_view(), name="cancel_subscription"),
    path("subscription/create-order/", CreatePaymentOrderView.as_view(), name="create_payment_order"),
    path("subscription/verify-payment/", VerifyPaymentView.as_view(), name="verify_payment"),
    path("subscription/webhook/razorpay/", RazorpayWebhookView.as_view(), name="razorpay_webhook"),

    # Shared content / visibility management
    path("tenancy/admin/assessments/", SharedAssessmentsView.as_view(), name="shared_assessments"),
    path(
        "tenancy/admin/assessments/<int:assessment_id>/visibility/",
        UpdateAssessmentVisibilityView.as_view(),
        name="update_assessment_visibility",
    ),
    path("tenancy/admin/technologies/", SharedTechnologiesView.as_view(), name="shared_technologies"),
    path(
        "tenancy/admin/technologies/<str:technology_id>/visibility/",
        UpdateTechnologyVisibilityView.as_view(),
        name="update_technology_visibility",
    ),
    path("tenancy/admin/questions/", SharedQuestionsView.as_view(), name="shared_questions"),
    path(
        "tenancy/admin/questions/bulk-visibility/",
        UpdateQuestionVisibilityBulkView.as_view(),
        name="update_question_visibility_bulk",
    ),
    path(
        "tenancy/admin/organizations/",
        OrganizationListForSharingView.as_view(),
        name="organizations_for_sharing",
    ),
    path("tenancy/tenant/assessments/", TenantAssessmentsCatalogView.as_view(), name="tenant_assessments_catalog"),
    path(
        "tenancy/tenant/catalog/technologies/",
        TenantTechnologiesCatalogView.as_view(),
        name="tenant_technologies_catalog",
    ),
    path(
        "tenancy/tenant/catalog/questions/",
        TenantQuestionsCatalogView.as_view(),
        name="tenant_questions_catalog",
    ),

    # Organization admin user management
    path("org/users/", OrgAdminListUsersView.as_view(), name="org_users_list"),
    path("org/users/create/", OrgAdminCreateUserView.as_view(), name="org_users_create"),

    path('new_ai_assessment/', include('AI_assessment.urls')),
]
