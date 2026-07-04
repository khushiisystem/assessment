// Store
export { store } from "./store";
export type { RootState, AppDispatch } from "./store";

// Hooks
export { useAppDispatch, useAppSelector } from "./hooks";

// Auth slice
export { setCredentials, updateUser, logout, selectCurrentUser, selectIsAuthenticated, selectIsAdmin, selectIsEmployee } from "./slices/authSlice";

// Upload helper (for progress tracking - cannot use RTK Query)
export { uploadWithProgress } from "./api/baseQuery";

// API hooks - Auth
export {
  useLoginMutation,
  useLazyGoogleLoginQuery,
  useLazyGoogleCallbackQuery,
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useVerifyResetOtpMutation,
  useResetPasswordMutation,
  useGetProfileQuery,
  useLazyGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from "./api/authApi";

// API hooks - Candidates
export {
  useGetCandidatesQuery,
  useLazyGetCandidatesQuery,
  useGetCandidateDetailsQuery,
  useLazyGetCandidateDetailsQuery,
  useLazyGetCandidateResumeQuery,
  useAddCandidateMutation,
  useDeleteCandidateMutation,
  useBulkDeleteCandidatesMutation,
  useLazyExportCandidatesQuery,
  useQuickAssignAssessmentMutation,
} from "./api/candidatesApi";

// API hooks - Assessments
export {
  useLazyGetAssessmentsQuery,
  useGetAssessmentByIdQuery,
  useLazyGetAssessmentByIdQuery,
  useLazyGetAssessmentCandidatesByStatusQuery,
  useLazyGetAssessmentDetailPageQuery,
  useCreateAssessmentMutation,
  useUpdateAssessmentMutation,
  useBulkDeleteAssessmentsMutation,
  useAssignAssessmentMutation,
  useUnassignAssessmentMutation,
  useLazyGetAiAssessmentsQuery,
  useGetAiAssessmentByIdQuery,
  useLazyGetAiAssessmentByIdQuery,
  useCreateAiAssessmentMutation,
  useUpdateAiAssessmentMutation,
  useBulkDeleteAiAssessmentsMutation,
  useAssignAiAssessmentMutation,
  useUnassignAiAssessmentMutation,
  useLazyGetHardcodedQuestionsQuery,
  useDeleteAiAssessmentCandidateMutation,
  useGetCategoriesQuery,
  useLazyGetAssessmentResultsQuery,
  useGetCandidateAssessmentResultQuery,
  useLazyTakeAssessmentQuery,
  useSubmitAssessmentMutation,
  useSaveAnswerMutation,
  useGetCandidateResultQuery,
  useLazyGetCandidateResultQuery,
  useSubmitCandidateFeedbackMutation,
  useGetAiIntroductionQuery,
  useLazyGetAiIntroductionQuery,
  useSubmitAiIntroductionMutation,
  useSaveAiAnswerMutation,
  useSubmitAiAssessmentMutation,
  useLazyCheckAiAssessmentStatusQuery,
  useGetPresignedUrlMutation,
  useUploadVideoChunkMutation,
  useGetVideoPartUrlMutation,
  useCompleteMultipartUploadMutation,
  useUploadVideoMutation,
  useUploadVideoFormMutation,
  useUploadAudioMutation,
  useGetSignedUrlMutation,
  useLazyTakeAiAssessmentQuery,
  useLazyCheckQuestionsReadyQuery,
  usePrepareQuestionsAsyncMutation,
  useSaveProctoringIncidentMutation,
  useLazyGetAiAssessmentResultsQuery,
  useLazyGetAiAssessmentCandidateReportQuery,
  useLazyGetAiInterviewResultsQuery,
  useLazyGetAssessmentQuestionsQuery,
  useLazyGetQuestionsByRuleQuery,
  useSendAssessmentEmailsMutation,
  useAutofillAssessmentQuestionsMutation,
  useSendReminderEmailMutation,
  useGetPresignedUrlIntroMutation,
  useUploadIntroductionVideoMutation,
  useGetAdminDashboardQuery,
  useLazyGetAdminDashboardQuery,
  usePatchAdminFeedbackMutation,
  useLazyGetAssessmentCandidatesWithScoreQuery,
} from "./api/assessmentsApi";

// API hooks - Questions
export {
  useLazyGetQuestionsQuery,
  useGetQuestionByIdQuery,
  useLazyGetQuestionByIdQuery,
  useAddQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useBulkDeleteQuestionsMutation,
  useLazyExportQuestionsQuery,
  useGetSqlDatasetsQuery,
  useCreateSqlDatasetMutation,
  useRunSqlMutation,
  useGradeSqlMutation,
  useRunCodeMutation,
  useLazyGetAiMockQuestionsQuery,
  useLazyGetAiMockQuestionByIdQuery,
  useUpdateAiMockQuestionMutation,
  useAddAiMockQuestionMutation, 
  useDeleteAiMockQuestionMutation,
} from "./api/questionsApi";

// API hooks - Organizations
export {
  useGetOrganizationsQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
} from "./api/organizationsApi";

// API hooks - Technologies
export {
  useGetTechnologiesQuery,
  useLazyGetTechnologiesQuery,
  useGetTechnologyByIdQuery,
  useLazyGetTechnologyByIdQuery,
  useLazyGetTechnologyQuestionsQuery,
  useCreateTechnologyMutation,
  useUpdateTechnologyMutation,
  useDeleteTechnologyMutation,
  useBulkDeleteTechnologiesMutation,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
  useUnassignAssignmentMutation,
  useGetProgressQuery,
  useLazyGetProgressQuery,
  useLazyGetCompletionsQuery,
  useCreateCompletionMutation,
  useCompleteModuleMutation,
  useSendCourseCompleteEmailMutation,
  useLazyDownloadQuestionTemplateQuery,
  useUploadQuestionsMutation,
  useAddTechQuestionMutation,
  useUpdateTechQuestionMutation,
  useDeleteTechQuestionMutation,
  useLazyGetAssignmentsForCandidateQuery,
  useUpdateAssignmentDueDateMutation,
} from "./api/technologiesApi";

// API hooks - Mock Interview
export {
  useGetSessionsQuery,
  useLazyGetSessionsQuery,
  useLazyGetSessionByIdQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
  useBulkDeleteSessionsMutation,
  useGetMockQuestionsQuery,
  useLazyGetMockQuestionsQuery,
  useCreateMockQuestionMutation,
  useUpdateMockQuestionMutation,
  useDeleteMockQuestionMutation,
  useBulkDeleteMockQuestionsMutation,
  useBulkCreateMockQuestionsMutation,
  useGetTemplatesQuery,
  useLazyGetTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useGetMockCandidatesQuery,
  useLazyGetMockCandidatesQuery,
  useDeleteMockCandidateMutation,
  useGetCandidateAnalyticsQuery,
  useLazyGetCandidateAnalyticsQuery,
  useGetStacksQuery,
  useLazyGetCandidateMockInterviewsQuery,
} from "./api/mockInterviewApi";

// API hooks - Bulk Upload
export {
  useBulkUploadMutation,
  useLazyDownloadTemplateQuery,
} from "./api/bulkUploadApi";
